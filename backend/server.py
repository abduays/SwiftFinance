from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Market Rates (Module A) ----------
MARKET_BEST_RATES = {
    "home": 8.4,
    "car": 8.8,
    "personal": 11.0,
}

# ---------- Credit Card Catalog (Module B) ----------
# Net reward % per ₹100 spend per category (cashback equivalent)
CREDIT_CARDS = [
    {
        "id": "hdfc_regalia",
        "name": "HDFC Regalia Gold",
        "issuer": "HDFC",
        "color": "#1B3A6B",
        "annual_fee": 2500,
        "rewards": {"grocery": 1.33, "travel": 4.0, "fuel": 1.0, "dining": 5.0},
        "highlight": "5x points on dining & travel via SmartBuy",
    },
    {
        "id": "icici_amazon_pay",
        "name": "ICICI Amazon Pay",
        "issuer": "ICICI",
        "color": "#FF9900",
        "annual_fee": 0,
        "rewards": {"grocery": 5.0, "travel": 2.0, "fuel": 2.0, "dining": 2.0},
        "highlight": "5% back on Amazon (Prime), 2% on bill-pay",
    },
    {
        "id": "amex_platinum_travel",
        "name": "Amex Platinum Travel",
        "issuer": "American Express",
        "color": "#0B1F3A",
        "annual_fee": 5000,
        "rewards": {"grocery": 1.0, "travel": 6.0, "fuel": 0.5, "dining": 1.5},
        "highlight": "Milestone vouchers worth ₹40k+ a year",
    },
    {
        "id": "sbi_simplyclick",
        "name": "SBI SimplyClick",
        "issuer": "SBI",
        "color": "#22409A",
        "annual_fee": 499,
        "rewards": {"grocery": 2.5, "travel": 5.0, "fuel": 0.25, "dining": 1.25},
        "highlight": "10x on online partners (BookMyShow, Cleartrip)",
    },
    {
        "id": "axis_magnus",
        "name": "Axis Magnus Burgundy",
        "issuer": "Axis",
        "color": "#97144D",
        "annual_fee": 12500,
        "rewards": {"grocery": 1.2, "travel": 8.0, "fuel": 1.0, "dining": 4.8},
        "highlight": "25k EDGE miles every ₹1L spent",
    },
    {
        "id": "hdfc_millennia",
        "name": "HDFC Millennia",
        "issuer": "HDFC",
        "color": "#0F3057",
        "annual_fee": 1000,
        "rewards": {"grocery": 2.5, "travel": 1.0, "fuel": 1.0, "dining": 2.5},
        "highlight": "5% cashback on Swiggy, Zomato, Amazon, Flipkart",
    },
]

# ---------- Models ----------
class LoanInput(BaseModel):
    loan_type: str  # 'home' | 'car' | 'personal'
    amount: float
    rate: float  # annual %
    tenure_months: int

class Profile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    annual_income: float
    loans: List[LoanInput] = []
    investments_80c: float = 0
    investments_80d: float = 0
    investments_nps: float = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    category: str  # grocery, travel, fuel, dining
    monthly_spend: float

# ---------- Helpers ----------
def emi(principal: float, annual_rate: float, months: int) -> float:
    if months <= 0:
        return 0
    r = (annual_rate / 100) / 12
    if r == 0:
        return principal / months
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def total_interest(principal: float, annual_rate: float, months: int) -> float:
    return emi(principal, annual_rate, months) * months - principal


def amortization(principal: float, annual_rate: float, months: int, points: int = 12):
    """Return sample principal-vs-interest cumulative points (one per year)."""
    r = (annual_rate / 100) / 12
    monthly = emi(principal, annual_rate, months)
    balance = principal
    cum_interest = 0
    cum_principal = 0
    series = []
    step = max(1, months // points)
    for m in range(1, months + 1):
        interest_m = balance * r
        principal_m = monthly - interest_m
        balance -= principal_m
        cum_interest += interest_m
        cum_principal += principal_m
        if m % step == 0 or m == months:
            series.append({
                "month": m,
                "principal_paid": round(max(cum_principal, 0), 2),
                "interest_paid": round(max(cum_interest, 0), 2),
                "balance": round(max(balance, 0), 2),
            })
    return series


# Tax Calculations FY 2026-27
def tax_new_regime(income: float) -> float:
    # Standard deduction 75k
    taxable = max(income - 75000, 0)
    slabs = [
        (400000, 0.00),
        (800000, 0.05),
        (1200000, 0.10),
        (1600000, 0.15),
        (2000000, 0.20),
        (2400000, 0.25),
        (float("inf"), 0.30),
    ]
    tax = 0
    prev = 0
    for upper, rate in slabs:
        if taxable > upper:
            tax += (upper - prev) * rate
            prev = upper
        else:
            tax += (taxable - prev) * rate
            break
    # Rebate u/s 87A — zero tax up to ₹12L taxable
    if taxable <= 1200000:
        tax = 0
    cess = tax * 0.04
    return round(tax + cess, 2)


def tax_old_regime(income: float, c80: float, d80: float, nps: float) -> float:
    c80 = min(c80, 150000)
    d80 = min(d80, 25000)
    nps = min(nps, 50000)
    taxable = max(income - 50000 - c80 - d80 - nps, 0)
    slabs = [
        (250000, 0.00),
        (500000, 0.05),
        (1000000, 0.20),
        (float("inf"), 0.30),
    ]
    tax = 0
    prev = 0
    for upper, rate in slabs:
        if taxable > upper:
            tax += (upper - prev) * rate
            prev = upper
        else:
            tax += (taxable - prev) * rate
            break
    # Rebate up to ₹5L taxable
    if taxable <= 500000:
        tax = 0
    cess = tax * 0.04
    return round(tax + cess, 2)


# ---------- Endpoints ----------
@api_router.get("/")
async def root():
    return {"message": "Money-Making Dashboard API", "version": "1.0"}


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
    ranked = []
    for c in CREDIT_CARDS:
        pct = c["rewards"].get(cat, 0)
        monthly_back = req.monthly_spend * pct / 100
        annual_back = monthly_back * 12 - c["annual_fee"]
        ranked.append({
            "id": c["id"],
            "name": c["name"],
            "issuer": c["issuer"],
            "color": c["color"],
            "reward_pct": pct,
            "monthly_back": round(monthly_back, 2),
            "annual_net_value": round(annual_back, 2),
            "highlight": c["highlight"],
            "annual_fee": c["annual_fee"],
        })
    ranked.sort(key=lambda x: x["annual_net_value"], reverse=True)
    return ranked


@api_router.post("/loan/refinance")
async def loan_refinance(req: RefinanceRequest):
    lt = req.loan_type.lower()
    if lt not in MARKET_BEST_RATES:
        raise HTTPException(status_code=400, detail="invalid loan_type")
    best = MARKET_BEST_RATES[lt]
    current_emi = emi(req.amount, req.rate, req.tenure_months)
    new_emi = emi(req.amount, best, req.tenure_months)
    current_total_interest = total_interest(req.amount, req.rate, req.tenure_months)
    new_total_interest = total_interest(req.amount, best, req.tenure_months)

    # Prepayment scenario — adds extra_emi each month to principal portion → reduces tenure
    pre_months = req.tenure_months
    if req.extra_emi > 0:
        target_emi = new_emi + req.extra_emi
        # solve months for principal at best rate, with target_emi
        r = (best / 100) / 12
        if r > 0 and target_emi > req.amount * r:
            import math
            pre_months = math.ceil(
                math.log(target_emi / (target_emi - req.amount * r)) / math.log(1 + r)
            )

    series = amortization(req.amount, req.rate, req.tenure_months)
    new_series = amortization(req.amount, best, req.tenure_months)

    return {
        "current": {
            "rate": req.rate,
            "emi": round(current_emi, 2),
            "total_interest": round(current_total_interest, 2),
        },
        "switched": {
            "rate": best,
            "emi": round(new_emi, 2),
            "total_interest": round(new_total_interest, 2),
        },
        "savings": {
            "monthly_emi": round(current_emi - new_emi, 2),
            "lifetime_interest": round(current_total_interest - new_total_interest, 2),
        },
        "prepay": {
            "extra_emi": req.extra_emi,
            "months_after_prepay": pre_months,
            "months_saved": max(req.tenure_months - pre_months, 0),
        },
        "series_current": series,
        "series_switched": new_series,
    }


@api_router.post("/tax/calculate")
async def tax_calculate(req: TaxRequest):
    new_tax = tax_new_regime(req.annual_income)
    old_tax = tax_old_regime(
        req.annual_income, req.investments_80c, req.investments_80d, req.investments_nps
    )
    optimal = "new" if new_tax <= old_tax else "old"
    leakage = abs(new_tax - old_tax)

    # ELSS suggestion
    elss_gap = max(150000 - req.investments_80c, 0)
    elss_save = 0
    if elss_gap > 0 and optimal == "old":
        # marginal saving estimate
        if req.annual_income > 1000000:
            elss_save = elss_gap * 0.312
        elif req.annual_income > 500000:
            elss_save = elss_gap * 0.208
        else:
            elss_save = elss_gap * 0.052

    return {
        "fy": "2026-27",
        "new_regime_tax": new_tax,
        "old_regime_tax": old_tax,
        "optimal_regime": optimal,
        "leakage": round(leakage, 2),
        "elss_gap": round(elss_gap, 2),
        "elss_save": round(elss_save, 2),
    }


@api_router.post("/profile", response_model=Profile)
async def create_profile(p: ProfileCreate):
    obj = Profile(**p.dict())
    doc = obj.dict()
    await db.profiles.insert_one(doc)
    return obj


@api_router.get("/profile/{pid}", response_model=Profile)
async def get_profile(pid: str):
    doc = await db.profiles.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="profile not found")
    return doc


@api_router.post("/leakage")
async def compute_leakage(p: ProfileCreate):
    """Compute total monthly wealth leakage from loans + tax sub-optimisation."""
    loan_leak = 0.0
    for ln in p.loans:
        lt = ln.loan_type.lower()
        if lt not in MARKET_BEST_RATES:
            continue
        cur = emi(ln.amount, ln.rate, ln.tenure_months)
        best = emi(ln.amount, MARKET_BEST_RATES[lt], ln.tenure_months)
        loan_leak += max(cur - best, 0)

    new_tax = tax_new_regime(p.annual_income)
    old_tax = tax_old_regime(p.annual_income, p.investments_80c, p.investments_80d, p.investments_nps)
    tax_leak_monthly = max(abs(new_tax - old_tax), 0) / 12

    # Card leakage rough proxy: assume avg 6k monthly spend ineffectively earning 0.5% vs best 5%
    card_leak = 6000 * (5.0 - 0.5) / 100

    total = loan_leak + tax_leak_monthly + card_leak

    return {
        "monthly_leakage": round(total, 2),
        "annual_leakage": round(total * 12, 2),
        "breakdown": {
            "loans_monthly": round(loan_leak, 2),
            "tax_monthly": round(tax_leak_monthly, 2),
            "cards_monthly": round(card_leak, 2),
        },
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
