"""LeakStop backend API tests (pytest)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://loan-optimizer-11.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---- Market rates ----
def test_market_rates(s):
    r = s.get(f"{BASE_URL}/api/market-rates", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["home"] == 8.4
    assert body["car"] == 8.8
    assert body["personal"] == 11 or body["personal"] == 11.0


# ---- Loan refinance ----
def test_loan_refinance_home(s):
    payload = {"loan_type": "home", "amount": 3500000, "rate": 9.2, "tenure_months": 240, "extra_emi": 0}
    r = s.post(f"{BASE_URL}/api/loan/refinance", json=payload, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["current"]["rate"] == 9.2
    assert d["switched"]["rate"] == 8.4
    assert d["current"]["emi"] > d["switched"]["emi"]
    assert d["savings"]["lifetime_interest"] > 0
    assert d["savings"]["monthly_emi"] > 0
    assert isinstance(d["series_current"], list) and len(d["series_current"]) > 0
    assert isinstance(d["series_switched"], list) and len(d["series_switched"]) > 0
    assert "principal_paid" in d["series_current"][0]


def test_loan_refinance_with_prepay(s):
    payload = {"loan_type": "home", "amount": 3500000, "rate": 9.2, "tenure_months": 240, "extra_emi": 5000}
    r = s.post(f"{BASE_URL}/api/loan/refinance", json=payload, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["prepay"]["months_saved"] > 0


def test_loan_refinance_invalid_type(s):
    r = s.post(f"{BASE_URL}/api/loan/refinance", json={"loan_type": "boat", "amount": 100000, "rate": 9, "tenure_months": 12}, timeout=15)
    assert r.status_code == 400


# ---- Cards rank ----
def test_cards_rank_grocery(s):
    r = s.post(f"{BASE_URL}/api/cards/rank", json={"category": "grocery", "monthly_spend": 15000}, timeout=15)
    assert r.status_code == 200
    ranked = r.json()
    assert isinstance(ranked, list) and len(ranked) >= 4
    # Sorted desc by annual_net_value
    nets = [c["annual_net_value"] for c in ranked]
    assert nets == sorted(nets, reverse=True)
    assert ranked[0]["id"] == "icici_amazon_pay", f"Top card should be ICICI Amazon Pay, got {ranked[0]['id']}"


def test_cards_rank_invalid_category(s):
    r = s.post(f"{BASE_URL}/api/cards/rank", json={"category": "stocks", "monthly_spend": 1000}, timeout=15)
    assert r.status_code == 400


def test_cards_list(s):
    r = s.get(f"{BASE_URL}/api/cards", timeout=15)
    assert r.status_code == 200
    cards = r.json()
    ids = {c["id"] for c in cards}
    # Must include the 4 named ones from spec
    for needed in {"hdfc_regalia", "icici_amazon_pay", "amex_platinum_travel", "sbi_simplyclick"}:
        assert needed in ids


# ---- Tax ----
def test_tax_calculate_15L(s):
    r = s.post(f"{BASE_URL}/api/tax/calculate", json={"annual_income": 1500000, "investments_80c": 50000, "investments_80d": 15000, "investments_nps": 0}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["fy"] == "2026-27"
    assert "new_regime_tax" in d and "old_regime_tax" in d
    assert d["new_regime_tax"] < d["old_regime_tax"], "New regime should be cheaper at 15L"
    assert d["optimal_regime"] == "new"
    assert d["leakage"] > 0
    assert d["elss_gap"] >= 0


def test_tax_below_rebate(s):
    """Income below 12L taxable should give zero new regime tax due to 87A rebate."""
    r = s.post(f"{BASE_URL}/api/tax/calculate", json={"annual_income": 1200000}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["new_regime_tax"] == 0


# ---- Leakage ----
def test_leakage(s):
    payload = {
        "annual_income": 1500000,
        "loans": [{"loan_type": "home", "amount": 3500000, "rate": 9.2, "tenure_months": 240}],
        "investments_80c": 50000,
        "investments_80d": 15000,
        "investments_nps": 0,
    }
    r = s.post(f"{BASE_URL}/api/leakage", json=payload, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["monthly_leakage"] > 0
    assert d["annual_leakage"] > 0
    b = d["breakdown"]
    assert b["loans_monthly"] > 0
    assert b["tax_monthly"] > 0
    assert b["cards_monthly"] > 0


# ---- Profile persistence ----
def test_profile_create_and_get(s):
    payload = {"annual_income": 1500000, "loans": [], "investments_80c": 50000, "investments_80d": 15000, "investments_nps": 0}
    r = s.post(f"{BASE_URL}/api/profile", json=payload, timeout=15)
    assert r.status_code == 200
    obj = r.json()
    assert "id" in obj and "_id" not in obj
    pid = obj["id"]
    r2 = s.get(f"{BASE_URL}/api/profile/{pid}", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["annual_income"] == 1500000
