"""LeakStop iteration-2 backend tests: auth, profile, payments, advisor."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://loan-optimizer-11.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def new_user(s):
    """Register a fresh user once per module; return {email, password, token, user}."""
    email = f"TEST_{uuid.uuid4().hex[:10]}@leakstop.in"
    pw = "Pass123!"
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": pw, "name": "Test User"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body and "user" in body
    assert body["user"]["email"] == email.lower()
    assert body["user"]["auth_provider"] == "password"
    return {"email": email, "password": pw, "token": body["token"], "user": body["user"]}


@pytest.fixture(scope="module")
def auth_headers(new_user):
    return {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_register_duplicate_returns_409(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/auth/register",
                   json={"email": new_user["email"], "password": "anything", "name": "Dup"},
                   timeout=15)
        assert r.status_code == 409, r.text

    def test_login_success(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": new_user["email"], "password": new_user["password"]},
                   timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert "token" in b
        assert b["user"]["email"] == new_user["email"].lower()
        assert "password_hash" not in b["user"]

    def test_login_invalid_password(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": new_user["email"], "password": "wrongpass"},
                   timeout=15)
        assert r.status_code == 401

    def test_login_unknown_email(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": f"nobody_{uuid.uuid4().hex[:6]}@nowhere.in", "password": "x"},
                   timeout=15)
        assert r.status_code == 401

    def test_me_without_auth_returns_401(self, s):
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_jwt_returns_user(self, s, auth_headers, new_user):
        r = s.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["email"] == new_user["email"].lower()
        assert b["auth_provider"] == "password"
        assert "password_hash" not in b
        assert "_id" not in b

    def test_demo_user_seed_login(self, s):
        # Seed user from /app/memory/test_credentials.md
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": "demo@leakstop.in", "password": "demo12345"},
                   timeout=15)
        assert r.status_code == 200, f"Seeded demo user login failed: {r.text}"


# ---------- Profile ----------
class TestProfile:
    def test_save_then_get_profile(self, s, auth_headers):
        payload = {
            "annual_income": 1800000,
            "loans": [{"loan_type": "home", "amount": 3500000, "rate": 9.2, "tenure_months": 240}],
            "investments_80c": 75000, "investments_80d": 15000, "investments_nps": 0,
        }
        r = s.post(f"{BASE_URL}/api/me/profile", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        r2 = s.get(f"{BASE_URL}/api/me/profile", headers=auth_headers, timeout=15)
        assert r2.status_code == 200, r2.text
        doc = r2.json()
        assert doc.get("annual_income") == 1800000
        assert doc.get("investments_80c") == 75000
        assert isinstance(doc.get("loans"), list) and len(doc["loans"]) == 1
        assert "_id" not in doc

    def test_profile_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/me/profile", timeout=15)
        assert r.status_code == 401


# ---------- Payments ----------
class TestPayments:
    def test_order_yearly_success(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/payments/order", json={"plan": "yearly"}, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 89900
        assert d["currency"] == "INR"
        assert d["key_id"] == "rzp_test_SoPOfCPaZwSEa3"
        assert d["plan"] == "yearly"
        assert isinstance(d["order_id"], str) and d["order_id"].startswith("order_")
        assert isinstance(d.get("receipt"), str)

    def test_order_monthly_success(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/payments/order", json={"plan": "monthly"}, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 9900
        assert d["order_id"].startswith("order_")

    def test_order_invalid_plan_400(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/payments/order", json={"plan": "weekly"}, headers=auth_headers, timeout=15)
        assert r.status_code == 400

    def test_order_requires_auth(self, s):
        r = s.post(f"{BASE_URL}/api/payments/order", json={"plan": "yearly"}, timeout=15)
        assert r.status_code == 401

    def test_verify_bad_signature_400(self, s, auth_headers):
        body = {
            "razorpay_order_id": "order_dummy_xxx",
            "razorpay_payment_id": "pay_dummy_xxx",
            "razorpay_signature": "deadbeef" * 8,
        }
        r = s.post(f"{BASE_URL}/api/payments/verify", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 400

    def test_verify_requires_auth(self, s):
        r = s.post(f"{BASE_URL}/api/payments/verify",
                   json={"razorpay_order_id": "a", "razorpay_payment_id": "b", "razorpay_signature": "c"},
                   timeout=15)
        assert r.status_code == 401


# ---------- Advisor ----------
class TestAdvisor:
    def test_advisor_claude_hindi(self, s):
        r = s.post(f"{BASE_URL}/api/advisor/chat",
                   json={"message": "मेरी मासिक बचत ₹15,000 है, कहाँ निवेश करूँ?",
                         "model": "claude-sonnet-4-5", "language": "hi"},
                   timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "reply" in d and isinstance(d["reply"], str) and len(d["reply"]) > 20
        # Devanagari range check
        has_devanagari = any("\u0900" <= ch <= "\u097F" for ch in d["reply"])
        assert has_devanagari, f"Hindi reply contained no Devanagari: {d['reply'][:200]}"
        assert d["language"] == "hi"
        assert d.get("session_id", "").startswith("sess_")

    def test_advisor_gemini_english(self, s):
        r = s.post(f"{BASE_URL}/api/advisor/chat",
                   json={"message": "Give me a one-line PPF vs ELSS tip.",
                         "model": "gemini-3-flash", "language": "en"},
                   timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["reply"], str) and len(d["reply"]) > 20
        # English: must have ASCII letters and no Devanagari
        assert any(c.isalpha() and ord(c) < 128 for c in d["reply"])
        assert d["language"] == "en"
