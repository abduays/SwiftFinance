"""Comprehensive backend test suite for PaisaBachao backend.

Targets the external REACT_APP_BACKEND_URL (EXPO_PUBLIC_BACKEND_URL) and exercises
all /api endpoints listed in the review request.
"""
from __future__ import annotations

import os
import sys
import json
import time
import uuid
import random
import string
import hmac
import hashlib
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import requests
from dotenv import load_dotenv

# ---- Resolve backend URL --------------------------------------------------
load_dotenv(Path("/app/frontend/.env"))
BACKEND_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or ""
).rstrip("/")
if not BACKEND_URL:
    print("FATAL: backend URL not found in /app/frontend/.env")
    sys.exit(1)
BASE = f"{BACKEND_URL}/api"

print(f"Testing backend at: {BASE}")

# ---- Counters & helpers ---------------------------------------------------
PASS, FAIL = 0, 0
FAILURES: list[str] = []
DETAILS: list[str] = []


def _log(ok: bool, name: str, detail: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        DETAILS.append(f"PASS  {name}  {detail}".rstrip())
        print(f"PASS  {name}  {detail}".rstrip())
    else:
        FAIL += 1
        msg = f"FAIL  {name}  {detail}".rstrip()
        FAILURES.append(msg)
        DETAILS.append(msg)
        print(msg)


def post(path: str, body: Optional[Dict[str, Any]] = None,
         token: Optional[str] = None, headers: Optional[Dict[str, str]] = None,
         raw: bool = False, timeout: int = 60):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if headers:
        h.update(headers)
    if raw and body is not None:
        return requests.post(f"{BASE}{path}", data=body, headers=h, timeout=timeout)
    return requests.post(f"{BASE}{path}", json=body or {}, headers=h, timeout=timeout)


def get(path: str, token: Optional[str] = None, timeout: int = 30):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{BASE}{path}", headers=h, timeout=timeout)


# ============================================================================
# 1. PUBLIC ENDPOINTS
# ============================================================================
print("\n----- 1. PUBLIC ENDPOINTS -----")

# 1a. Root brand
try:
    r = get("/")
    j = r.json()
    _log(
        r.status_code == 200 and j.get("message") == "PaisaBachao API",
        "GET /api/ brand-renamed",
        f"status={r.status_code} message={j.get('message')!r}",
    )
except Exception as e:
    _log(False, "GET /api/", f"exception: {e}")

# 1b. Market rates
try:
    r = get("/market-rates")
    j = r.json()
    ok = r.status_code == 200 and {"home", "car", "personal"}.issubset(j.keys())
    _log(ok, "GET /api/market-rates", f"keys={list(j.keys())}")
except Exception as e:
    _log(False, "GET /api/market-rates", f"exception: {e}")

# 1c. List cards
try:
    r = get("/cards")
    j = r.json()
    ok = r.status_code == 200 and isinstance(j, list) and len(j) == 6
    _log(ok, "GET /api/cards (6 cards)", f"count={len(j) if isinstance(j, list) else 'N/A'}")
except Exception as e:
    _log(False, "GET /api/cards", f"exception: {e}")

# 1d. Rank cards
for cat in ["grocery", "travel", "fuel", "dining"]:
    try:
        r = post("/cards/rank", {"category": cat, "monthly_spend": 15000})
        j = r.json()
        if r.status_code != 200 or not isinstance(j, list):
            _log(False, f"POST /api/cards/rank [{cat}]", f"status={r.status_code} body={j}")
            continue
        # sorted desc by annual_net_value
        vals = [c["annual_net_value"] for c in j]
        sorted_ok = vals == sorted(vals, reverse=True)
        # schema present
        first = j[0]
        keys = {"reward_pct", "highlight", "issuer", "annual_fee", "annual_net_value"}
        schema_ok = keys.issubset(first.keys())
        _log(
            sorted_ok and schema_ok,
            f"POST /api/cards/rank [{cat}]",
            f"sorted={sorted_ok} schema={schema_ok} top={first['name']} net={first['annual_net_value']}",
        )
    except Exception as e:
        _log(False, f"POST /api/cards/rank [{cat}]", f"exception: {e}")

# 1e. Invalid category
try:
    r = post("/cards/rank", {"category": "groceriez", "monthly_spend": 15000})
    _log(r.status_code == 400, "POST /api/cards/rank invalid category -> 400", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/cards/rank invalid category", f"exception: {e}")

# 1f. Loan refinance
try:
    r = post("/loan/refinance", {
        "loan_type": "home", "amount": 3500000, "rate": 9.2,
        "tenure_months": 240, "extra_emi": 5000,
    })
    j = r.json()
    if r.status_code != 200:
        _log(False, "POST /api/loan/refinance", f"status={r.status_code} body={j}")
    else:
        cond = (
            j["savings"]["lifetime_interest"] > 0
            and isinstance(j["series_current"], list) and len(j["series_current"]) > 0
            and isinstance(j["series_switched"], list) and len(j["series_switched"]) > 0
            and abs(j["switched"]["rate"] - 8.4) < 1e-6
            and j["prepay"]["months_saved"] >= 0
        )
        _log(
            cond, "POST /api/loan/refinance",
            f"lifetime_save={j['savings']['lifetime_interest']} months_saved={j['prepay']['months_saved']} switched_rate={j['switched']['rate']}",
        )
except Exception as e:
    _log(False, "POST /api/loan/refinance", f"exception: {e}")

# 1g. Tax calculate
try:
    r = post("/tax/calculate", {
        "annual_income": 1200000, "investments_80c": 150000,
        "investments_80d": 25000, "investments_nps": 50000,
    })
    j = r.json()
    cond = (
        r.status_code == 200
        and "new_regime_tax" in j and "old_regime_tax" in j
        and j["optimal_regime"] in {"new", "old"}
        and "elss_gap" in j and "elss_save" in j
    )
    _log(cond, "POST /api/tax/calculate", f"new={j.get('new_regime_tax')} old={j.get('old_regime_tax')} opt={j.get('optimal_regime')}")
except Exception as e:
    _log(False, "POST /api/tax/calculate", f"exception: {e}")

# 1h. Leakage — CRITICAL — cards_monthly real
try:
    payload = {
        "annual_income": 1200000,
        "loans": [{"loan_type": "home", "amount": 3500000, "rate": 9.2, "tenure_months": 240}],
        "investments_80c": 0, "investments_80d": 0, "investments_nps": 0,
    }
    r = post("/leakage", payload)
    j = r.json()
    if r.status_code != 200:
        _log(False, "POST /api/leakage real cards_monthly", f"status={r.status_code} body={j}")
    else:
        bd = j["breakdown"]
        cm = bd["cards_monthly"]
        # cards_monthly bound check: > 0 and < 5000
        cards_ok = 0 < cm < 5000
        # totals reconcile (±2 tolerance)
        s = round(bd["loans_monthly"] + bd["tax_monthly"] + bd["cards_monthly"], 2)
        total_ok = abs(s - j["monthly_leakage"]) <= 2
        _log(
            cards_ok and total_ok,
            "POST /api/leakage (income=12L, home loan)",
            f"breakdown={bd} monthly={j['monthly_leakage']} sum={s} cards_ok={cards_ok} total_ok={total_ok}",
        )
except Exception as e:
    _log(False, "POST /api/leakage real cards_monthly", f"exception: {e}")

# 1i. Leakage zero income -> cards_monthly = 0
try:
    r = post("/leakage", {"annual_income": 0, "loans": []})
    j = r.json()
    cm = j["breakdown"]["cards_monthly"]
    _log(
        r.status_code == 200 and cm == 0,
        "POST /api/leakage zero income graceful",
        f"cards_monthly={cm} breakdown={j['breakdown']}",
    )
except Exception as e:
    _log(False, "POST /api/leakage zero income", f"exception: {e}")


# ============================================================================
# 2. AUTH FLOWS
# ============================================================================
print("\n----- 2. AUTH FLOWS -----")

# Try existing demo user; otherwise create new
TC_PATH = Path("/app/memory/test_credentials.md")
existing_email = "demo@leakstop.in"
existing_password = "demo12345"

# Attempt login with existing
demo_token: Optional[str] = None
try:
    r = post("/auth/login", {"email": existing_email, "password": existing_password})
    if r.status_code == 200:
        demo_token = r.json()["token"]
        _log(True, "Login pre-existing demo user", f"email={existing_email}")
    else:
        _log(True, "Demo user not available; will create fresh user", f"status={r.status_code}")
except Exception as e:
    _log(False, "Login pre-existing demo", f"exception: {e}")

# Fresh user
rand = uuid.uuid4().hex[:8]
new_email = f"qa_stress_{rand}@paisabachao.in"
new_password = "Qa!Stress#2026"
new_name = f"QA Stress {rand}"

try:
    r = post("/auth/register", {"email": new_email, "password": new_password, "name": new_name})
    j = r.json()
    cond = (
        r.status_code == 200
        and j.get("token")
        and j.get("user", {}).get("email") == new_email
    )
    _log(cond, "POST /api/auth/register fresh user", f"status={r.status_code} email={new_email}")
    new_token = j["token"] if cond else None
except Exception as e:
    _log(False, "POST /api/auth/register", f"exception: {e}")
    new_token = None

# Re-register same email -> 409
try:
    r = post("/auth/register", {"email": new_email, "password": new_password, "name": new_name})
    _log(r.status_code == 409, "Re-register same email -> 409", f"status={r.status_code}")
except Exception as e:
    _log(False, "Re-register same email", f"exception: {e}")

# Login fresh user
try:
    r = post("/auth/login", {"email": new_email, "password": new_password})
    j = r.json()
    cond = r.status_code == 200 and j.get("token")
    _log(cond, "POST /api/auth/login fresh user", f"status={r.status_code}")
    if cond:
        new_token = j["token"]
except Exception as e:
    _log(False, "POST /api/auth/login fresh user", f"exception: {e}")

# Bad password -> 401
try:
    r = post("/auth/login", {"email": new_email, "password": "wrong-pw-12345"})
    _log(r.status_code == 401, "Login bad password -> 401", f"status={r.status_code}")
except Exception as e:
    _log(False, "Login bad password", f"exception: {e}")

# GET /api/auth/me with bearer
try:
    r = get("/auth/me", token=new_token)
    j = r.json()
    cond = (
        r.status_code == 200
        and j.get("email") == new_email
        and "password_hash" not in j
    )
    _log(cond, "GET /api/auth/me (no password_hash leak)",
         f"status={r.status_code} keys={list(j.keys()) if isinstance(j, dict) else 'N/A'}")
except Exception as e:
    _log(False, "GET /api/auth/me", f"exception: {e}")


# ============================================================================
# 3. AI ADVISOR
# ============================================================================
print("\n----- 3. AI ADVISOR -----")
for model, lang in [("claude-sonnet-4-5", "hi"), ("gemini-3-flash", "en")]:
    try:
        r = post("/advisor/chat", {
            "message": "Should I prepay my home loan or invest in mutual funds for tax savings?",
            "model": model, "language": lang,
        }, timeout=120)
        j = r.json()
        cond = (
            r.status_code == 200
            and isinstance(j.get("reply"), str) and len(j["reply"]) > 0
            and j.get("session_id") and j.get("model")
        )
        _log(cond, f"POST /api/advisor/chat [{model}/{lang}]",
             f"status={r.status_code} reply_len={len(j.get('reply') or '') if isinstance(j, dict) else 'N/A'} model={j.get('model')}")
    except Exception as e:
        _log(False, f"POST /api/advisor/chat [{model}/{lang}]", f"exception: {e}")


# ============================================================================
# 4. RAZORPAY PAYMENTS
# ============================================================================
print("\n----- 4. RAZORPAY PAYMENTS -----")

# Order monthly
order_id_monthly: Optional[str] = None
try:
    r = post("/payments/order", {"plan": "monthly"}, token=new_token)
    j = r.json()
    cond = (
        r.status_code == 200
        and j.get("amount") == 9900
        and j.get("currency") == "INR"
        and j.get("order_id") and j.get("key_id")
    )
    _log(cond, "POST /api/payments/order monthly", f"status={r.status_code} amt={j.get('amount')} order_id={j.get('order_id')}")
    if cond:
        order_id_monthly = j["order_id"]
except Exception as e:
    _log(False, "POST /api/payments/order monthly", f"exception: {e}")

# Order yearly
try:
    r = post("/payments/order", {"plan": "yearly"}, token=new_token)
    j = r.json()
    cond = r.status_code == 200 and j.get("amount") == 89900 and j.get("currency") == "INR"
    _log(cond, "POST /api/payments/order yearly", f"status={r.status_code} amt={j.get('amount')}")
except Exception as e:
    _log(False, "POST /api/payments/order yearly", f"exception: {e}")

# Invalid plan
try:
    r = post("/payments/order", {"plan": "lifetime"}, token=new_token)
    _log(r.status_code == 400, "POST /api/payments/order invalid plan -> 400", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/payments/order invalid plan", f"exception: {e}")

# Verify bogus signature -> 400
try:
    r = post("/payments/verify", {
        "razorpay_order_id": order_id_monthly or "order_bogus",
        "razorpay_payment_id": "pay_bogus_001",
        "razorpay_signature": "deadbeef" * 8,
    }, token=new_token)
    _log(r.status_code == 400, "POST /api/payments/verify bogus sig -> 400", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/payments/verify bogus sig", f"exception: {e}")

# Webhook bogus signature -> 400
try:
    body = json.dumps({"event": "payment.captured", "payload": {}}).encode()
    r = requests.post(f"{BASE}/payments/webhook", data=body,
                      headers={"Content-Type": "application/json",
                               "x-razorpay-signature": "deadbeef"},
                      timeout=30)
    _log(r.status_code == 400, "POST /api/payments/webhook bogus sig -> 400", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/payments/webhook bogus sig", f"exception: {e}")


# ============================================================================
# 5. AUTHENTICATED ME-SCOPED ENDPOINTS
# ============================================================================
print("\n----- 5. ME-SCOPED ENDPOINTS -----")

# Leakage history snapshot
try:
    snap = {
        "monthly_leakage": 24500.50,
        "annual_leakage": 294006.00,
        "breakdown": {"loans_monthly": 12000.0, "tax_monthly": 9500.5, "cards_monthly": 3000.0},
        "annual_income": 1500000,
        "loans_count": 1,
    }
    r = post("/me/leakage-history", snap, token=new_token)
    _log(r.status_code == 200 and r.json().get("ok"), "POST /api/me/leakage-history", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/me/leakage-history", f"exception: {e}")

# GET history
try:
    r = get("/me/leakage-history", token=new_token)
    j = r.json()
    cond = (
        r.status_code == 200
        and isinstance(j, list) and len(j) >= 1
        and j[0]["annual_income"] == 1500000
    )
    _log(cond, "GET /api/me/leakage-history", f"count={len(j) if isinstance(j, list) else 'N/A'}")
except Exception as e:
    _log(False, "GET /api/me/leakage-history", f"exception: {e}")

# WhatsApp prefs
try:
    r = post("/me/whatsapp", {"enabled": True, "phone": "+919876543210"}, token=new_token)
    _log(r.status_code == 200 and r.json().get("ok"), "POST /api/me/whatsapp", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/me/whatsapp", f"exception: {e}")

try:
    r = get("/me/whatsapp", token=new_token)
    j = r.json()
    cond = r.status_code == 200 and j.get("enabled") is True and j.get("phone") == "+919876543210"
    _log(cond, "GET /api/me/whatsapp", f"prefs={j}")
except Exception as e:
    _log(False, "GET /api/me/whatsapp", f"exception: {e}")

try:
    r = get("/me/whatsapp/outbox", token=new_token)
    j = r.json()
    found_welcome = False
    if isinstance(j, list):
        for m in j:
            if m.get("kind") == "welcome" and m.get("status") == "sent" and m.get("provider") == "mock":
                found_welcome = True
                break
    _log(found_welcome, "GET /api/me/whatsapp/outbox welcome[sent,mock]",
         f"count={len(j) if isinstance(j, list) else 'N/A'} found={found_welcome}")
except Exception as e:
    _log(False, "GET /api/me/whatsapp/outbox", f"exception: {e}")


# ============================================================================
# 6. STRESS — 20× /api/leakage with varied incomes
# ============================================================================
print("\n----- 6. STRESS (20× /api/leakage) -----")
random.seed(42)
stress_ok = True
stress_details = []
for i in range(20):
    inc = random.randint(500000, 5000000)
    loans = []
    if random.random() < 0.7:
        loans.append({
            "loan_type": random.choice(["home", "car", "personal"]),
            "amount": random.randint(200000, 5000000),
            "rate": round(random.uniform(8.5, 14.5), 2),
            "tenure_months": random.choice([60, 120, 180, 240]),
        })
    try:
        r = post("/leakage", {
            "annual_income": inc, "loans": loans,
            "investments_80c": random.randint(0, 150000),
            "investments_80d": random.randint(0, 25000),
            "investments_nps": random.randint(0, 50000),
        }, timeout=30)
        if r.status_code != 200:
            stress_ok = False
            stress_details.append(f"#{i+1} inc={inc} status={r.status_code}")
            continue
        j = r.json()
        ml = j["monthly_leakage"]
        cm = j["breakdown"]["cards_monthly"]
        # Sanity: finite, non-negative
        import math
        if not (math.isfinite(ml) and math.isfinite(cm) and ml >= 0 and cm >= 0):
            stress_ok = False
            stress_details.append(f"#{i+1} non-finite ml={ml} cm={cm}")
    except Exception as e:
        stress_ok = False
        stress_details.append(f"#{i+1} exception: {e}")

_log(stress_ok, "Stress 20× /api/leakage finite & 200", "; ".join(stress_details) if stress_details else "all 200")


# ============================================================================
# Update test_credentials.md
# ============================================================================
try:
    creds_text = f"""# Test Credentials

## Seed user (created via POST /api/auth/register during backend verification)
- Email: `demo@leakstop.in`
- Password: `demo12345`
- Auth provider: password (JWT)

## QA stress user (most recent test run)
- Email: `{new_email}`
- Password: `{new_password}`
- Name: `{new_name}`
- Auth provider: password (JWT)

## Google login (Emergent OAuth)
- Flow: WebView/redirect via https://auth.emergentagent.com
- No app-managed password; any Google account works in dev.

## Notes for the testing agent
- New users can be registered ad-hoc via POST /api/auth/register {{email, password, name}}.
- Authorization header: `Bearer <token>` where token is either the JWT returned from /auth/login or the session_token returned from /auth/google/session.
"""
    TC_PATH.write_text(creds_text)
    print(f"Wrote credentials to {TC_PATH}")
except Exception as e:
    print(f"Could not update {TC_PATH}: {e}")


# ---- Summary --------------------------------------------------------------
print("\n" + "=" * 68)
print(f"TOTAL: {PASS + FAIL}  PASS: {PASS}  FAIL: {FAIL}")
print("=" * 68)
if FAILURES:
    print("FAILURES:")
    for f in FAILURES:
        print(" -", f)
sys.exit(0 if FAIL == 0 else 1)
