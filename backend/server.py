from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hmac
import hashlib
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

import razorpay
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from auth import (  # noqa: E402
    User,
    RegisterRequest,
    LoginRequest,
    hash_password,
    verify_password,
    make_jwt,
    new_user_id,
    exchange_emergent_session,
    get_current_user_id,
)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
RAZORPAY_KEY_ID = os.environ["RAZORPAY_KEY_ID"]
RAZORPAY_KEY_SECRET = os.environ["RAZORPAY_KEY_SECRET"]

rzp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

app = FastAPI()
app.state.db = db
api_router = APIRouter(prefix="/api")

# ---------- Market Rates ----------
MARKET_BEST_RATES = {"home": 8.4, "car": 8.8, "personal": 11.0}

# ---------- Credit Card Catalog ----------
CREDIT_CARDS = [
    {"id": "hdfc_regalia", "name": "HDFC Regalia Gold", "issuer": "HDFC", "color": "#1B3A6B", "annual_fee": 2500,
     "rewards": {"grocery": 1.33, "travel": 4.0, "fuel": 1.0, "dining": 5.0},
     "highlight": "5x points on dining & travel via SmartBuy"},
    {"id": "icici_amazon_pay", "name": "ICICI Amazon Pay", "issuer": "ICICI", "color": "#FF9900", "annual_fee": 0,
     "rewards": {"grocery": 5.0, "travel": 2.0, "fuel": 2.0, "dining": 2.0},
     "highlight": "5% back on Amazon (Prime), 2% on bill-pay"},
    {"id": "amex_platinum_travel", "name": "Amex Platinum Travel", "issuer": "American Express", "color": "#0B1F3A", "annual_fee": 5000,
     "rewards": {"grocery": 1.0, "travel": 6.0, "fuel": 0.5, "dining": 1.5},
     "highlight": "Milestone vouchers worth ₹40k+ a year"},
    {"id": "sbi_simplyclick", "name": "SBI SimplyClick", "issuer": "SBI", "color": "#22409A", "annual_fee": 499,
     "rewards": {"grocery": 2.5, "travel": 5.0, "fuel": 0.25, "dining": 1.25},
     "highlight": "10x on online partners (BookMyShow, Cleartrip)"},
    {"id": "axis_magnus", "name": "Axis Magnus Burgundy", "issuer": "Axis", "color": "#97144D", "annual_fee": 12500,
     "rewards": {"grocery": 1.2, "travel": 8.0, "fuel": 1.0, "dining": 4.8},
     "highlight": "25k EDGE miles every ₹1L spent"},
    {"id": "hdfc_millennia", "name": "HDFC Millennia", "issuer": "HDFC", "color": "#0F3057", "annual_fee": 1000,
     "rewards": {"grocery": 2.5, "travel": 1.0, "fuel": 1.0, "dining": 2.5},
     "highlight": "5% cashback on Swiggy, Zomato, Amazon, Flipkart"},
]

# ---------- Models ----------
class LoanInput(BaseModel):
    loan_type: str
    amount: float
    rate: float
    tenure_months: int

class ProfileCreate(BaseModel):
    annual_income: float
    loans: List[LoanInput] = []
    investments_80c: float = 0
    investments_80d: float = 0
    investments_nps: float = 0

class RefinanceRequest(BaseModel):
    loan_type: str
    amount: float
    rate: float
    tenure_months: int
    extra_emi: float = 0

class TaxRequest(BaseModel):
    annual_income: float
    investments_80c: float = 0
    investments_80d: float = 0
    investments_nps: float = 0

class CardRankRequest(BaseModel):
    category: str
    monthly_spend: float

class AdvisorRequest(BaseModel):
    message: str
    model: str = "claude-sonnet-4-5"  # or "gemini-3-flash"
    language: str = "en"  # en, hi, ta, te, bn, mr, gu, kn
    session_id: Optional[str] = None
    context: Optional[dict] = None

class PaymentOrderRequest(BaseModel):
    plan: str  # 'monthly' | 'yearly'

class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class GoogleSessionRequest(BaseModel):
    session_id: str

class LeakageSnapshot(BaseModel):
    monthly_leakage: float
    annual_leakage: float
    breakdown: dict
    annual_income: float
    loans_count: int

class WhatsAppPrefs(BaseModel):
    enabled: bool
    phone: Optional[str] = None  # E.164 e.g. +91xxxxxxxxxx

# ---------- Helpers ----------
def emi(principal, rate, months):
    if months <= 0:
        return 0
    r = (rate / 100) / 12
    if r == 0:
        return principal / months
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)

def total_interest(p, r, m):
    return emi(p, r, m) * m - p

def amortization(p, r, m, points=12):
    rate_m = (r / 100) / 12
    monthly = emi(p, r, m)
    bal, cp, ci = p, 0, 0
    series, step = [], max(1, m // points)
    for i in range(1, m + 1):
        i_m = bal * rate_m
        p_m = monthly - i_m
        bal -= p_m
        cp += p_m
        ci += i_m
        if i % step == 0 or i == m:
            series.append({"month": i, "principal_paid": round(max(cp, 0), 2),
                           "interest_paid": round(max(ci, 0), 2), "balance": round(max(bal, 0), 2)})
    return series

def tax_new_regime(income):
    taxable = max(income - 75000, 0)
    slabs = [(400000, 0), (800000, 0.05), (1200000, 0.10), (1600000, 0.15),
             (2000000, 0.20), (2400000, 0.25), (float("inf"), 0.30)]
    tax, prev = 0, 0
    for upper, rate in slabs:
        if taxable > upper:
            tax += (upper - prev) * rate
            prev = upper
        else:
            tax += (taxable - prev) * rate
            break
    if taxable <= 1200000:
        tax = 0
    return round(tax * 1.04, 2)

def tax_old_regime(income, c80, d80, nps):
    c80 = min(c80, 150000); d80 = min(d80, 25000); nps = min(nps, 50000)
    taxable = max(income - 50000 - c80 - d80 - nps, 0)
    slabs = [(250000, 0), (500000, 0.05), (1000000, 0.20), (float("inf"), 0.30)]
    tax, prev = 0, 0
    for upper, rate in slabs:
        if taxable > upper:
            tax += (upper - prev) * rate; prev = upper
        else:
            tax += (taxable - prev) * rate; break
    if taxable <= 500000:
        tax = 0
    return round(tax * 1.04, 2)

# ---------- Public endpoints ----------
@api_router.get("/")
async def root():
    return {"message": "LeakStop API", "version": "2.0"}

@api_router.get("/market-rates")
async def market_rates():
    return MARKET_BEST_RATES

@api_router.get("/cards")
async def list_cards():
    return CREDIT_CARDS

@api_router.post("/cards/rank")
async def rank_cards(req: CardRankRequest):
    cat = req.category.lower()
    if cat not in {"grocery", "travel", "fuel", "dining"}:
        raise HTTPException(status_code=400, detail="invalid category")
    out = []
    for c in CREDIT_CARDS:
        pct = c["rewards"].get(cat, 0)
        mb = req.monthly_spend * pct / 100
        out.append({"id": c["id"], "name": c["name"], "issuer": c["issuer"], "color": c["color"],
                    "reward_pct": pct, "monthly_back": round(mb, 2),
                    "annual_net_value": round(mb * 12 - c["annual_fee"], 2),
                    "highlight": c["highlight"], "annual_fee": c["annual_fee"]})
    out.sort(key=lambda x: x["annual_net_value"], reverse=True)
    return out

@api_router.post("/loan/refinance")
async def loan_refinance(req: RefinanceRequest):
    lt = req.loan_type.lower()
    if lt not in MARKET_BEST_RATES:
        raise HTTPException(status_code=400, detail="invalid loan_type")
    best = MARKET_BEST_RATES[lt]
    cur_emi = emi(req.amount, req.rate, req.tenure_months)
    new_emi = emi(req.amount, best, req.tenure_months)
    cti = total_interest(req.amount, req.rate, req.tenure_months)
    nti = total_interest(req.amount, best, req.tenure_months)
    pre_m = req.tenure_months
    if req.extra_emi > 0:
        import math
        target = new_emi + req.extra_emi
        r = (best / 100) / 12
        if r > 0 and target > req.amount * r:
            pre_m = math.ceil(math.log(target / (target - req.amount * r)) / math.log(1 + r))
    return {
        "current": {"rate": req.rate, "emi": round(cur_emi, 2), "total_interest": round(cti, 2)},
        "switched": {"rate": best, "emi": round(new_emi, 2), "total_interest": round(nti, 2)},
        "savings": {"monthly_emi": round(cur_emi - new_emi, 2), "lifetime_interest": round(cti - nti, 2)},
        "prepay": {"extra_emi": req.extra_emi, "months_after_prepay": pre_m, "months_saved": max(req.tenure_months - pre_m, 0)},
        "series_current": amortization(req.amount, req.rate, req.tenure_months),
        "series_switched": amortization(req.amount, best, req.tenure_months),
    }

@api_router.post("/tax/calculate")
async def tax_calculate(req: TaxRequest):
    nt = tax_new_regime(req.annual_income)
    ot = tax_old_regime(req.annual_income, req.investments_80c, req.investments_80d, req.investments_nps)
    optimal = "new" if nt <= ot else "old"
    gap = max(150000 - req.investments_80c, 0)
    save = 0
    if gap > 0 and optimal == "old":
        if req.annual_income > 1000000: save = gap * 0.312
        elif req.annual_income > 500000: save = gap * 0.208
        else: save = gap * 0.052
    return {"fy": "2026-27", "new_regime_tax": nt, "old_regime_tax": ot,
            "optimal_regime": optimal, "leakage": round(abs(nt - ot), 2),
            "elss_gap": round(gap, 2), "elss_save": round(save, 2)}

@api_router.post("/leakage")
async def compute_leakage(p: ProfileCreate):
    loan_leak = 0.0
    for ln in p.loans:
        lt = ln.loan_type.lower()
        if lt in MARKET_BEST_RATES:
            cur = emi(ln.amount, ln.rate, ln.tenure_months)
            best = emi(ln.amount, MARKET_BEST_RATES[lt], ln.tenure_months)
            loan_leak += max(cur - best, 0)
    nt = tax_new_regime(p.annual_income)
    ot = tax_old_regime(p.annual_income, p.investments_80c, p.investments_80d, p.investments_nps)
    tax_leak_m = abs(nt - ot) / 12
    card_leak = 6000 * 4.5 / 100
    total = loan_leak + tax_leak_m + card_leak
    return {"monthly_leakage": round(total, 2), "annual_leakage": round(total * 12, 2),
            "breakdown": {"loans_monthly": round(loan_leak, 2),
                          "tax_monthly": round(tax_leak_m, 2),
                          "cards_monthly": round(card_leak, 2)}}

# Legacy unauth profile (for backward-compat)
class Profile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    annual_income: float
    loans: List[LoanInput] = []
    investments_80c: float = 0
    investments_80d: float = 0
    investments_nps: float = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.post("/profile", response_model=Profile)
async def create_profile(p: ProfileCreate):
    obj = Profile(**p.dict())
    await db.profiles.insert_one(obj.dict())
    return obj

@api_router.get("/profile/{pid}", response_model=Profile)
async def get_profile(pid: str):
    doc = await db.profiles.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    return doc

# ---------- Auth ----------
@api_router.post("/auth/register")
async def register(body: RegisterRequest):
    existing = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="email already registered")
    uid = new_user_id()
    await db.users.insert_one({
        "user_id": uid,
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": hash_password(body.password),
        "auth_provider": "password",
        "picture": None,
        "subscription": None,
        "created_at": datetime.now(timezone.utc),
    })
    return {"token": make_jwt(uid), "user": {"user_id": uid, "email": body.email.lower(),
                                              "name": body.name, "auth_provider": "password"}}

@api_router.post("/auth/login")
async def login(body: LoginRequest):
    doc = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not doc or not doc.get("password_hash") or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="invalid email or password")
    return {"token": make_jwt(doc["user_id"]),
            "user": {"user_id": doc["user_id"], "email": doc["email"], "name": doc["name"],
                     "auth_provider": doc["auth_provider"], "picture": doc.get("picture")}}

@api_router.post("/auth/google/session")
async def google_session(body: GoogleSessionRequest, response: Response):
    data = await exchange_emergent_session(body.session_id)
    email = data.get("email", "").lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        uid = existing["user_id"]
    else:
        uid = new_user_id()
        await db.users.insert_one({
            "user_id": uid, "email": email, "name": data.get("name", "User"),
            "picture": data.get("picture"), "auth_provider": "google",
            "subscription": None,
            "created_at": datetime.now(timezone.utc),
        })

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie(
        "session_token", session_token,
        max_age=7 * 24 * 3600, path="/", secure=True, samesite="none", httponly=True,
    )
    return {"token": session_token,
            "user": {"user_id": uid, "email": email, "name": data.get("name"),
                     "picture": data.get("picture"), "auth_provider": "google"}}

@api_router.get("/auth/me")
async def me(user_id: str = Depends(get_current_user_id)):
    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="user not found")
    return doc

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response,
                 user_id: str = Depends(get_current_user_id)):
    response.delete_cookie("session_token", path="/")
    # Best-effort: drop the session
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}

# ---------- User-scoped profile ----------
@api_router.get("/me/profile")
async def get_my_profile(user_id: str = Depends(get_current_user_id)):
    doc = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    return doc or {}

@api_router.post("/me/profile")
async def save_my_profile(p: ProfileCreate, user_id: str = Depends(get_current_user_id)):
    payload = p.dict()
    payload["user_id"] = user_id
    payload["updated_at"] = datetime.now(timezone.utc)
    await db.user_profiles.update_one({"user_id": user_id}, {"$set": payload}, upsert=True)
    return {"ok": True}

# ---------- AI Advisor ----------
LANG_NAMES = {
    "en": "English", "hi": "Hindi (हिन्दी)",
    "ta": "Tamil (தமிழ்)", "te": "Telugu (తెలుగు)",
    "bn": "Bengali (বাংলা)", "mr": "Marathi (मराठी)",
    "gu": "Gujarati (ગુજરાતી)", "kn": "Kannada (ಕನ್ನಡ)",
}

def _model_spec(name: str):
    if name.startswith("gemini"):
        return ("gemini", "gemini-3-flash-preview")
    return ("anthropic", "claude-sonnet-4-5-20250929")

SYSTEM_TEMPLATE = """You are LeakStop's personal-finance advisor for Indian middle-class users (₹7L+ income).
Be crisp, friendly and concrete. Use Indian rupee (₹), lakhs/crores, and real Indian instruments (PPF, ELSS, NPS, EPF, FD).
Always reply in {language}. If user mixes English with their language, still reply mostly in {language}.
Never give legal/SEBI-registered advice — keep it educational. Cite numeric reasoning with one short example."""

@api_router.post("/advisor/chat")
async def advisor_chat(req: AdvisorRequest):
    provider, model = _model_spec(req.model)
    sess = req.session_id or f"sess_{uuid.uuid4().hex[:10]}"
    lang_name = LANG_NAMES.get(req.language, "English")
    sys_msg = SYSTEM_TEMPLATE.format(language=lang_name)

    if req.context:
        sys_msg += "\n\nUser's leakage snapshot:\n" + str(req.context)[:1200]

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=sess, system_message=sys_msg).with_model(provider, model)

    try:
        reply = await chat.send_message(UserMessage(text=req.message))
    except Exception as e:
        logger.exception("advisor failed")
        raise HTTPException(status_code=502, detail=f"advisor unavailable: {e}")

    await db.advisor_messages.insert_one({
        "session_id": sess, "model": model, "language": req.language,
        "user_text": req.message, "assistant_text": reply,
        "created_at": datetime.now(timezone.utc),
    })
    return {"session_id": sess, "reply": reply, "model": model, "language": req.language}

# ---------- Razorpay ----------
PLAN_PRICES = {"monthly": 9900, "yearly": 89900}  # in paise

@api_router.post("/payments/order")
async def create_order(body: PaymentOrderRequest,
                       user_id: str = Depends(get_current_user_id)):
    if body.plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="invalid plan")
    amount = PLAN_PRICES[body.plan]
    receipt = f"ls_{uuid.uuid4().hex[:16]}"
    order = rzp.order.create({
        "amount": amount, "currency": "INR",
        "receipt": receipt,
        "notes": {"user_id": user_id, "plan": body.plan},
        "payment_capture": 1,
    })
    await db.orders.insert_one({
        "order_id": order["id"], "user_id": user_id,
        "plan": body.plan, "amount": amount, "status": "created",
        "created_at": datetime.now(timezone.utc),
    })
    return {"order_id": order["id"], "amount": amount, "currency": "INR",
            "key_id": RAZORPAY_KEY_ID, "plan": body.plan, "receipt": receipt}

@api_router.post("/payments/verify")
async def verify_payment(body: PaymentVerifyRequest,
                         user_id: str = Depends(get_current_user_id)):
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="signature mismatch")

    order = await db.orders.find_one({"order_id": body.razorpay_order_id}, {"_id": 0})
    plan = (order or {}).get("plan", "monthly")
    expires = datetime.now(timezone.utc) + timedelta(days=365 if plan == "yearly" else 30)

    await db.orders.update_one(
        {"order_id": body.razorpay_order_id},
        {"$set": {"status": "paid", "payment_id": body.razorpay_payment_id, "paid_at": datetime.now(timezone.utc)}},
    )
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"subscription": {"plan": plan, "expires_at": expires, "active": True}}},
    )
    return {"ok": True, "plan": plan, "expires_at": expires.isoformat()}


# ---------- Razorpay Webhook ----------
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", RAZORPAY_KEY_SECRET)

@api_router.post("/payments/webhook")
async def razorpay_webhook(request: Request):
    """Razorpay posts async settlement events here. Configure URL in Razorpay
    dashboard → Webhooks. Verifies X-Razorpay-Signature against shared secret."""
    raw = await request.body()
    sig = request.headers.get("x-razorpay-signature", "")
    expected = hmac.new(RAZORPAY_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=400, detail="bad signature")
    try:
        evt = json.loads(raw.decode())
    except Exception:
        raise HTTPException(status_code=400, detail="bad payload")

    event = evt.get("event", "")
    payload = evt.get("payload", {})
    payment = payload.get("payment", {}).get("entity", {})
    order_id = payment.get("order_id")

    # store every event for auditability
    await db.webhook_events.insert_one({
        "event": event,
        "payment_id": payment.get("id"),
        "order_id": order_id,
        "amount": payment.get("amount"),
        "status": payment.get("status"),
        "method": payment.get("method"),
        "received_at": datetime.now(timezone.utc),
    })

    if event == "payment.captured" and order_id:
        order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
        if order:
            plan = order.get("plan", "monthly")
            expires = datetime.now(timezone.utc) + timedelta(days=365 if plan == "yearly" else 30)
            await db.orders.update_one(
                {"order_id": order_id},
                {"$set": {"status": "captured", "payment_id": payment.get("id"),
                          "captured_at": datetime.now(timezone.utc)}},
            )
            await db.users.update_one(
                {"user_id": order["user_id"]},
                {"$set": {"subscription": {"plan": plan, "expires_at": expires, "active": True}}},
            )
            # Queue a WhatsApp notification for premium activation
            await _queue_whatsapp(order["user_id"], "subscription_active",
                                  f"🎉 LeakStop Premium is now active. Plan: {plan.upper()}. We'll WhatsApp your next leakage audit on the quarterly check-in.")
    elif event == "payment.failed" and order_id:
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": {"status": "failed", "failure_reason": payment.get("error_description")}},
        )

    return {"ok": True, "event": event}


# ---------- Leakage History (Timeline) ----------
@api_router.post("/me/leakage-history")
async def add_history(snap: LeakageSnapshot,
                      user_id: str = Depends(get_current_user_id)):
    doc = snap.dict()
    doc["user_id"] = user_id
    doc["created_at"] = datetime.now(timezone.utc)
    await db.leakage_history.insert_one(doc)
    return {"ok": True}


@api_router.get("/me/leakage-history")
async def get_history(user_id: str = Depends(get_current_user_id)):
    docs = await db.leakage_history.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return docs


# ---------- WhatsApp (mock, ready for Twilio/Meta plug-in) ----------
WHATSAPP_PROVIDER = os.environ.get("WHATSAPP_PROVIDER", "mock")

async def _queue_whatsapp(user_id: str, kind: str, message: str):
    user = await db.users.find_one({"user_id": user_id},
                                   {"_id": 0, "whatsapp_prefs": 1, "name": 1})
    prefs = (user or {}).get("whatsapp_prefs") or {}
    if not prefs.get("enabled") or not prefs.get("phone"):
        return False

    queued = {
        "user_id": user_id,
        "to": prefs["phone"],
        "kind": kind,
        "message": message,
        "provider": WHATSAPP_PROVIDER,
        "status": "queued",
        "created_at": datetime.now(timezone.utc),
    }
    # Plug Twilio/Meta here when keys are available — see /app/auth_testing.md style notes.
    if WHATSAPP_PROVIDER == "mock":
        queued["status"] = "sent"
        queued["sent_at"] = datetime.now(timezone.utc)

    await db.whatsapp_outbox.insert_one(queued)
    return True


@api_router.post("/me/whatsapp")
async def set_whatsapp(prefs: WhatsAppPrefs,
                       user_id: str = Depends(get_current_user_id)):
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"whatsapp_prefs": prefs.dict()}},
    )
    if prefs.enabled and prefs.phone:
        await _queue_whatsapp(user_id, "welcome",
                              "Welcome to LeakStop on WhatsApp! 🟢 We'll ping you every quarter with your wealth-audit summary.")
    return {"ok": True}


@api_router.get("/me/whatsapp")
async def get_whatsapp(user_id: str = Depends(get_current_user_id)):
    user = await db.users.find_one({"user_id": user_id},
                                   {"_id": 0, "whatsapp_prefs": 1})
    return (user or {}).get("whatsapp_prefs") or {"enabled": False, "phone": None}


@api_router.get("/me/whatsapp/outbox")
async def whatsapp_outbox(user_id: str = Depends(get_current_user_id)):
    docs = await db.whatsapp_outbox.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return docs


# ---------- Wiring ----------
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
