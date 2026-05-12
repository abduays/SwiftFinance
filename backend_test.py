"""Comprehensive backend test suite for PaisaBachao backend (v2.2).

Includes:
* Public endpoints (root, market-rates, cards, cards/rank, loan/refinance,
  tax/calculate, leakage with new rates_source / rates_last_updated_at)
* Auth flows
* AI advisor (Claude + Gemini)
* Razorpay (order/verify/webhook)
* Me-scoped endpoints (leakage-history, whatsapp prefs + outbox)
* NEW: Admin endpoints (market-rates upsert/refresh, cards upsert/delete)
* End-to-end admin scenario (override repo, verify, restore)
* 20× stress on /api/leakage
"""
from __future__ import annotations

import os
import sys
import json
import math
import uuid
import random
from pathlib import Path
from typing import Any, Dict, Optional

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

# Admin token from backend env
load_dotenv(Path("/app/backend/.env"))
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
if not ADMIN_TOKEN:
    print("WARNING: ADMIN_TOKEN missing from /app/backend/.env — admin tests may fail")

print(f"Testing backend at: {BASE}")
print(f"Admin token: {'present' if ADMIN_TOKEN else 'MISSING'}")

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


def post(path, body=None, token=None, headers=None, timeout=60):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if headers:
        h.update(headers)
    return requests.post(f"{BASE}{path}", json=body or {}, headers=h, timeout=timeout)


def get(path, token=None, timeout=30):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{BASE}{path}", headers=h, timeout=timeout)


def delete(path, token=None, headers=None, timeout=30):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if headers:
        h.update(headers)
    return requests.delete(f"{BASE}{path}", headers=h, timeout=timeout)


# ============================================================================
# 1. PUBLIC ENDPOINTS
# ============================================================================
print("\n----- 1. PUBLIC ENDPOINTS -----")

# 1a. Root brand
try:
    r = get("/")
    j = r.json()
    _log(r.status_code == 200 and j.get("message") == "PaisaBachao API",
         "GET /api/ brand-renamed", f"status={r.status_code} message={j.get('message')!r}")
except Exception as e:
    _log(False, "GET /api/", f"exception: {e}")

# 1b. Market rates — NEW SCHEMA
market_rates_baseline: Optional[Dict[str, Any]] = None
try:
    r = get("/market-rates")
    j = r.json()
    market_rates_baseline = j
    rates = j.get("rates", {})
    spreads = j.get("spreads", {})
    repo = j.get("repo_rate")
    src = j.get("source")
    have_keys = {"rates", "repo_rate", "spreads", "source", "last_updated_at", "last_checked_at"}.issubset(j.keys())
    rate_keys_ok = isinstance(rates, dict) and {"home", "car", "personal"}.issubset(rates.keys())
    spread_keys_ok = isinstance(spreads, dict) and {"home", "car", "personal"}.issubset(spreads.keys())
    derivation_ok = all(
        abs(rates[k] - (repo + spreads[k])) < 0.01 for k in ("home", "car", "personal")
    ) if (rate_keys_ok and spread_keys_ok and isinstance(repo, (int, float))) else False
    src_ok = src in {"rbi_press_release", "admin_manual", "seed_defaults"}
    cond = r.status_code == 200 and have_keys and rate_keys_ok and spread_keys_ok and derivation_ok and src_ok
    _log(cond, "GET /api/market-rates (new schema + derivation)",
         f"repo={repo} src={src} rates={rates} spreads={spreads} derive_ok={derivation_ok}")
except Exception as e:
    _log(False, "GET /api/market-rates", f"exception: {e}")

# 1c. List cards — ≥6 with full schema
try:
    r = get("/cards")
    j = r.json()
    card_keys = {"id", "name", "issuer", "color", "annual_fee", "rewards", "highlight"}
    schema_ok = isinstance(j, list) and len(j) >= 6 and all(
        card_keys.issubset(c.keys())
        and {"grocery", "travel", "fuel", "dining"}.issubset(c["rewards"].keys())
        for c in j
    )
    _log(r.status_code == 200 and schema_ok, "GET /api/cards (≥6, full schema)",
         f"count={len(j) if isinstance(j, list) else 'N/A'} schema_ok={schema_ok}")
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
        vals = [c["annual_net_value"] for c in j]
        sorted_ok = vals == sorted(vals, reverse=True)
        first = j[0]
        keys = {"reward_pct", "highlight", "issuer", "annual_fee", "annual_net_value"}
        schema_ok = keys.issubset(first.keys())
        _log(sorted_ok and schema_ok, f"POST /api/cards/rank [{cat}]",
             f"sorted={sorted_ok} schema={schema_ok} top={first['name']} net={first['annual_net_value']}")
    except Exception as e:
        _log(False, f"POST /api/cards/rank [{cat}]", f"exception: {e}")

# 1e. Invalid category
try:
    r = post("/cards/rank", {"category": "groceriez", "monthly_spend": 15000})
    _log(r.status_code == 400, "POST /api/cards/rank invalid category -> 400", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/cards/rank invalid category", f"exception: {e}")

# 1f. Loan refinance: switched.rate must equal live market home rate
try:
    live_home_rate = (market_rates_baseline or {}).get("rates", {}).get("home")
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
            and live_home_rate is not None
            and abs(j["switched"]["rate"] - live_home_rate) < 0.01
            and j["prepay"]["months_saved"] >= 0
        )
        _log(cond, "POST /api/loan/refinance (switched=live home rate)",
             f"lifetime_save={j['savings']['lifetime_interest']} months_saved={j['prepay']['months_saved']} "
             f"switched_rate={j['switched']['rate']} live={live_home_rate}")
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
        r.status_code == 200 and "new_regime_tax" in j and "old_regime_tax" in j
        and j["optimal_regime"] in {"new", "old"}
        and "elss_gap" in j and "elss_save" in j
    )
    _log(cond, "POST /api/tax/calculate",
         f"new={j.get('new_regime_tax')} old={j.get('old_regime_tax')} opt={j.get('optimal_regime')}")
except Exception as e:
    _log(False, "POST /api/tax/calculate", f"exception: {e}")

# 1h. Leakage with rates_source + rates_last_updated_at
try:
    payload = {
        "annual_income": 1200000,
        "loans": [{"loan_type": "home", "amount": 3500000, "rate": 9.2, "tenure_months": 240}],
        "investments_80c": 0, "investments_80d": 0, "investments_nps": 0,
    }
    r = post("/leakage", payload)
    j = r.json()
    if r.status_code != 200:
        _log(False, "POST /api/leakage", f"status={r.status_code} body={j}")
    else:
        bd = j["breakdown"]
        cm = bd["cards_monthly"]
        cards_ok = 0 < cm < 5000
        s = round(bd["loans_monthly"] + bd["tax_monthly"] + bd["cards_monthly"], 2)
        total_ok = abs(s - j["monthly_leakage"]) <= 2
        stamps_ok = j.get("rates_source") in {"rbi_press_release", "admin_manual", "seed_defaults"} \
            and isinstance(j.get("rates_last_updated_at"), str)
        _log(cards_ok and total_ok and stamps_ok,
             "POST /api/leakage (income=12L + rates_source/last_updated)",
             f"breakdown={bd} monthly={j['monthly_leakage']} rates_source={j.get('rates_source')} "
             f"ts={j.get('rates_last_updated_at')}")
except Exception as e:
    _log(False, "POST /api/leakage", f"exception: {e}")

# 1i. Leakage zero income -> cards_monthly = 0
try:
    r = post("/leakage", {"annual_income": 0, "loans": []})
    j = r.json()
    cm = j["breakdown"]["cards_monthly"]
    _log(r.status_code == 200 and cm == 0 and "rates_source" in j,
         "POST /api/leakage zero income graceful",
         f"cards_monthly={cm} breakdown={j['breakdown']} rates_source={j.get('rates_source')}")
except Exception as e:
    _log(False, "POST /api/leakage zero income", f"exception: {e}")


# ============================================================================
# 2. AUTH FLOWS
# ============================================================================
print("\n----- 2. AUTH FLOWS -----")
TC_PATH = Path("/app/memory/test_credentials.md")
rand = uuid.uuid4().hex[:8]
new_email = f"qa_admin_{rand}@paisabachao.in"
new_password = "Qa!Admin#2026"
new_name = f"QA Admin {rand}"
new_token: Optional[str] = None

try:
    r = post("/auth/register", {"email": new_email, "password": new_password, "name": new_name})
    j = r.json()
    cond = r.status_code == 200 and j.get("token") and j.get("user", {}).get("email") == new_email
    _log(cond, "POST /api/auth/register fresh user", f"status={r.status_code} email={new_email}")
    new_token = j["token"] if cond else None
except Exception as e:
    _log(False, "POST /api/auth/register", f"exception: {e}")

try:
    r = post("/auth/register", {"email": new_email, "password": new_password, "name": new_name})
    _log(r.status_code == 409, "Re-register same email -> 409", f"status={r.status_code}")
except Exception as e:
    _log(False, "Re-register same email", f"exception: {e}")

try:
    r = post("/auth/login", {"email": new_email, "password": new_password})
    j = r.json()
    cond = r.status_code == 200 and j.get("token")
    _log(cond, "POST /api/auth/login fresh user", f"status={r.status_code}")
    if cond:
        new_token = j["token"]
except Exception as e:
    _log(False, "POST /api/auth/login fresh user", f"exception: {e}")

try:
    r = post("/auth/login", {"email": new_email, "password": "wrong-pw-12345"})
    _log(r.status_code == 401, "Login bad password -> 401", f"status={r.status_code}")
except Exception as e:
    _log(False, "Login bad password", f"exception: {e}")

try:
    r = get("/auth/me", token=new_token)
    j = r.json()
    cond = r.status_code == 200 and j.get("email") == new_email and "password_hash" not in j
    _log(cond, "GET /api/auth/me (no password_hash leak)", f"status={r.status_code}")
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
order_id_monthly: Optional[str] = None
try:
    r = post("/payments/order", {"plan": "monthly"}, token=new_token)
    j = r.json()
    cond = (r.status_code == 200 and j.get("amount") == 9900 and j.get("currency") == "INR"
            and j.get("order_id") and j.get("key_id"))
    _log(cond, "POST /api/payments/order monthly", f"status={r.status_code} amt={j.get('amount')}")
    if cond:
        order_id_monthly = j["order_id"]
except Exception as e:
    _log(False, "POST /api/payments/order monthly", f"exception: {e}")

try:
    r = post("/payments/order", {"plan": "yearly"}, token=new_token)
    j = r.json()
    cond = r.status_code == 200 and j.get("amount") == 89900 and j.get("currency") == "INR"
    _log(cond, "POST /api/payments/order yearly", f"status={r.status_code} amt={j.get('amount')}")
except Exception as e:
    _log(False, "POST /api/payments/order yearly", f"exception: {e}")

try:
    r = post("/payments/order", {"plan": "lifetime"}, token=new_token)
    _log(r.status_code == 400, "POST /api/payments/order invalid plan -> 400", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/payments/order invalid plan", f"exception: {e}")

try:
    r = post("/payments/verify", {
        "razorpay_order_id": order_id_monthly or "order_bogus",
        "razorpay_payment_id": "pay_bogus_001",
        "razorpay_signature": "deadbeef" * 8,
    }, token=new_token)
    _log(r.status_code == 400, "POST /api/payments/verify bogus sig -> 400", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/payments/verify bogus sig", f"exception: {e}")

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
# 5. ME-SCOPED ENDPOINTS
# ============================================================================
print("\n----- 5. ME-SCOPED ENDPOINTS -----")
try:
    snap = {
        "monthly_leakage": 24500.50, "annual_leakage": 294006.00,
        "breakdown": {"loans_monthly": 12000.0, "tax_monthly": 9500.5, "cards_monthly": 3000.0},
        "annual_income": 1500000, "loans_count": 1,
    }
    r = post("/me/leakage-history", snap, token=new_token)
    _log(r.status_code == 200 and r.json().get("ok"), "POST /api/me/leakage-history",
         f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/me/leakage-history", f"exception: {e}")

try:
    r = get("/me/leakage-history", token=new_token)
    j = r.json()
    cond = r.status_code == 200 and isinstance(j, list) and len(j) >= 1 and j[0]["annual_income"] == 1500000
    _log(cond, "GET /api/me/leakage-history", f"count={len(j) if isinstance(j, list) else 'N/A'}")
except Exception as e:
    _log(False, "GET /api/me/leakage-history", f"exception: {e}")

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
# 6. NEW: ADMIN ENDPOINTS (market-rates + card catalog)
# ============================================================================
print("\n----- 6. ADMIN ENDPOINTS -----")
ADMIN_HEADER = {"X-Admin-Token": ADMIN_TOKEN}

# Save baseline so we can restore later
baseline = market_rates_baseline or get("/market-rates").json()
baseline_repo = baseline.get("repo_rate", 6.0)
baseline_spreads = baseline.get("spreads", {"home": 2.4, "car": 2.8, "personal": 5.0})

# 6a. POST /api/admin/market-rates with token & repo_rate 6.50 -> 200, admin_manual
try:
    r = post("/admin/market-rates", {"repo_rate": 6.50}, headers=ADMIN_HEADER)
    j = r.json()
    rates = j.get("rates", {}) if isinstance(j, dict) else {}
    spreads = j.get("spreads", {}) if isinstance(j, dict) else {}
    cond = (
        r.status_code == 200
        and j.get("source") == "admin_manual"
        and abs(j.get("repo_rate", 0) - 6.50) < 0.01
        and all(abs(rates[k] - (6.50 + spreads[k])) < 0.01 for k in ("home", "car", "personal"))
    )
    _log(cond, "POST /api/admin/market-rates repo=6.5 with token",
         f"status={r.status_code} source={j.get('source')} repo={j.get('repo_rate')} rates={rates}")
except Exception as e:
    _log(False, "POST /api/admin/market-rates with token", f"exception: {e}")

# 6b. Verify GET /api/market-rates reflects the update
try:
    r = get("/market-rates")
    j = r.json()
    cond = j.get("source") == "admin_manual" and abs(j.get("repo_rate", 0) - 6.50) < 0.01
    _log(cond, "GET /api/market-rates reflects admin update",
         f"src={j.get('source')} repo={j.get('repo_rate')}")
except Exception as e:
    _log(False, "GET /api/market-rates after admin update", f"exception: {e}")

# 6c. POST without header -> 401
try:
    r = post("/admin/market-rates", {"repo_rate": 6.50})
    _log(r.status_code == 401, "POST /api/admin/market-rates without token -> 401", f"status={r.status_code}")
except Exception as e:
    _log(False, "POST /api/admin/market-rates without token", f"exception: {e}")

# 6d. repo_rate out of band -> 400
try:
    r = post("/admin/market-rates", {"repo_rate": 13.0}, headers=ADMIN_HEADER)
    _log(r.status_code == 400, "POST /api/admin/market-rates repo=13 -> 400",
         f"status={r.status_code} body={r.text[:120]}")
except Exception as e:
    _log(False, "POST /api/admin/market-rates repo out of band", f"exception: {e}")

# 6e. Missing spreads keys -> 400
try:
    r = post("/admin/market-rates", {"spreads": {"home": 2.5}}, headers=ADMIN_HEADER)
    _log(r.status_code == 400, "POST /api/admin/market-rates missing car/personal -> 400",
         f"status={r.status_code} body={r.text[:120]}")
except Exception as e:
    _log(False, "POST /api/admin/market-rates missing spreads", f"exception: {e}")

# 6f. /admin/market-rates/refresh-now with token -> 200, no crash
try:
    r = post("/admin/market-rates/refresh-now", {}, headers=ADMIN_HEADER, timeout=30)
    j = r.json()
    cond = (
        r.status_code == 200
        and j.get("ok") is True
        and isinstance(j.get("rates"), dict)
        and j.get("source") in {"rbi_press_release", "admin_manual", "seed_defaults"}
        and isinstance(j.get("last_updated_at"), str)
    )
    _log(cond, "POST /api/admin/market-rates/refresh-now",
         f"status={r.status_code} src={j.get('source')} rates_keys={list((j.get('rates') or {}).keys())}")
except Exception as e:
    _log(False, "POST /api/admin/market-rates/refresh-now", f"exception: {e}")

# 6g. POST /api/admin/cards upsert
qa_card = {
    "id": "qa_test_card", "name": "QA Card", "issuer": "QA Bank",
    "color": "#000", "annual_fee": 0,
    "rewards": {"grocery": 3, "travel": 3, "fuel": 3, "dining": 3},
    "highlight": "test",
}
try:
    r = post("/admin/cards", qa_card, headers=ADMIN_HEADER)
    j = r.json()
    _log(r.status_code == 200 and j.get("ok") and j.get("id") == "qa_test_card",
         "POST /api/admin/cards upsert", f"status={r.status_code} body={j}")
except Exception as e:
    _log(False, "POST /api/admin/cards upsert", f"exception: {e}")

# 6h. GET /api/cards must include qa_test_card
try:
    r = get("/cards")
    j = r.json()
    ids = [c.get("id") for c in (j if isinstance(j, list) else [])]
    _log("qa_test_card" in ids, "GET /api/cards includes qa_test_card after upsert", f"ids={ids}")
except Exception as e:
    _log(False, "GET /api/cards includes qa_test_card", f"exception: {e}")

# 6i. Upsert with rewards missing fuel -> 400
try:
    bad_card = dict(qa_card, id="qa_bad_card", rewards={"grocery": 3, "travel": 3, "dining": 3})
    r = post("/admin/cards", bad_card, headers=ADMIN_HEADER)
    _log(r.status_code == 400, "POST /api/admin/cards missing rewards.fuel -> 400",
         f"status={r.status_code} body={r.text[:120]}")
except Exception as e:
    _log(False, "POST /api/admin/cards missing fuel", f"exception: {e}")

# 6j. DELETE /api/admin/cards/qa_test_card with token -> 200, deleted=1
try:
    r = delete("/admin/cards/qa_test_card", headers=ADMIN_HEADER)
    j = r.json()
    _log(r.status_code == 200 and j.get("ok") and j.get("deleted") == 1,
         "DELETE /api/admin/cards/qa_test_card with token", f"status={r.status_code} body={j}")
except Exception as e:
    _log(False, "DELETE /api/admin/cards qa_test_card", f"exception: {e}")

# 6k. GET /api/cards no longer includes qa_test_card
try:
    r = get("/cards")
    j = r.json()
    ids = [c.get("id") for c in (j if isinstance(j, list) else [])]
    _log("qa_test_card" not in ids, "GET /api/cards no longer includes qa_test_card",
         f"ids_contains_qa={('qa_test_card' in ids)} count={len(ids)}")
except Exception as e:
    _log(False, "GET /api/cards after delete", f"exception: {e}")

# 6l. DELETE without token -> 401
try:
    r = delete("/admin/cards/qa_test_card")
    _log(r.status_code == 401, "DELETE /api/admin/cards without token -> 401", f"status={r.status_code}")
except Exception as e:
    _log(False, "DELETE /api/admin/cards without token", f"exception: {e}")


# ============================================================================
# 7. END-TO-END ADMIN SCENARIO (override repo=7.25 → verify → restore)
# ============================================================================
print("\n----- 7. E2E ADMIN SCENARIO (repo=7.25) -----")

# 7a. Override repo to 7.25
try:
    r = post("/admin/market-rates", {"repo_rate": 7.25}, headers=ADMIN_HEADER)
    j = r.json()
    _log(r.status_code == 200 and abs(j.get("repo_rate", 0) - 7.25) < 0.01
         and j.get("source") == "admin_manual",
         "E2E: set repo_rate=7.25", f"src={j.get('source')} rates={j.get('rates')}")
except Exception as e:
    _log(False, "E2E: set repo_rate=7.25", f"exception: {e}")

# 7b. GET /api/market-rates shows repo_rate=7.25 + admin_manual + derived rates
try:
    r = get("/market-rates")
    j = r.json()
    rates = j.get("rates", {})
    spreads = j.get("spreads", {})
    cond = (
        abs(j.get("repo_rate", 0) - 7.25) < 0.01
        and j.get("source") == "admin_manual"
        and all(abs(rates[k] - (7.25 + spreads[k])) < 0.01 for k in ("home", "car", "personal"))
    )
    _log(cond, "E2E: GET /api/market-rates shows repo=7.25", f"rates={rates} spreads={spreads}")
    e2e_home_expected = round(7.25 + spreads.get("home", 0), 2)
except Exception as e:
    _log(False, "E2E: GET /api/market-rates shows repo=7.25", f"exception: {e}")
    e2e_home_expected = None

# 7c. /loan/refinance should now use the new home rate
try:
    r = post("/loan/refinance", {
        "loan_type": "home", "amount": 3500000, "rate": 9.2, "tenure_months": 240, "extra_emi": 0,
    })
    j = r.json()
    cond = (
        r.status_code == 200
        and e2e_home_expected is not None
        and abs(j["switched"]["rate"] - e2e_home_expected) < 0.01
    )
    _log(cond, "E2E: /loan/refinance uses repo=7.25 home rate",
         f"switched.rate={j.get('switched', {}).get('rate')} expected={e2e_home_expected}")
except Exception as e:
    _log(False, "E2E: /loan/refinance after override", f"exception: {e}")

# 7d. Restore baseline — best-effort refresh-now, then manual restore
restored = False
try:
    r = post("/admin/market-rates/refresh-now", {}, headers=ADMIN_HEADER, timeout=30)
    j = r.json()
    # Check if RBI was reachable (source==rbi_press_release means refreshed). Either way we still
    # restore manually below for determinism.
    print(f"  refresh-now: source={j.get('source')} rates={j.get('rates')}")
except Exception as e:
    print(f"  refresh-now exception: {e}")

# Manual restore to baseline values from the start of the run
try:
    r = post("/admin/market-rates",
             {"repo_rate": baseline_repo, "spreads": baseline_spreads},
             headers=ADMIN_HEADER)
    j = r.json()
    if r.status_code == 200:
        restored = True
    _log(restored, "E2E: restore baseline rates",
         f"repo={j.get('repo_rate')} src={j.get('source')}")
except Exception as e:
    _log(False, "E2E: restore baseline", f"exception: {e}")


# ============================================================================
# 8. STRESS — 20× /api/leakage with varied incomes
# ============================================================================
print("\n----- 8. STRESS (20× /api/leakage) -----")
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
        rs = j.get("rates_source")
        if not (math.isfinite(ml) and math.isfinite(cm) and ml >= 0 and cm >= 0):
            stress_ok = False
            stress_details.append(f"#{i+1} non-finite ml={ml} cm={cm}")
        if not rs:
            stress_ok = False
            stress_details.append(f"#{i+1} rates_source missing")
    except Exception as e:
        stress_ok = False
        stress_details.append(f"#{i+1} exception: {e}")

_log(stress_ok, "Stress 20× /api/leakage finite + rates_source present",
     "; ".join(stress_details) if stress_details else "all 200, rates_source present")


# ============================================================================
# Update test_credentials.md
# ============================================================================
try:
    creds_text = f"""# Test Credentials

## Seed user (created via POST /api/auth/register during backend verification)
- Email: `demo@leakstop.in`
- Password: `demo12345`
- Auth provider: password (JWT)

## QA admin user (most recent test run)
- Email: `{new_email}`
- Password: `{new_password}`
- Name: `{new_name}`
- Auth provider: password (JWT)

## Google login (Emergent OAuth)
- Flow: WebView/redirect via https://auth.emergentagent.com
- No app-managed password; any Google account works in dev.

## Admin
- Token (`X-Admin-Token`) is in /app/backend/.env -> ADMIN_TOKEN

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
