"""Authentication helpers: JWT email/password + Emergent Google session validation."""
from __future__ import annotations

import os
import uuid
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import HTTPException, Header, Request
from pydantic import BaseModel, EmailStr

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_TTL_DAYS = 30


# ---------------- Pydantic ----------------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str  # 'password' | 'google'
    created_at: datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------------- Helpers ----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int((datetime.now(timezone.utc) + timedelta(days=JWT_TTL_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_jwt(token: str) -> Optional[str]:
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return data.get("sub")
    except jwt.PyJWTError:
        return None


def new_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


# Emergent Google session exchange
async def exchange_emergent_session(session_id: str) -> dict:
    url = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(url, headers={"X-Session-ID": session_id})
        if res.status_code != 200:
            raise HTTPException(status_code=401, detail="invalid Google session")
        return res.json()


# ---------------- Dependency ----------------
async def get_current_user_id(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> str:
    """Accepts:
       - Authorization: Bearer <jwt>  (email/password login)
       - Authorization: Bearer <session_token>  (Google login)
       - or session_token cookie  (Google login)
    """
    token: Optional[str] = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="not authenticated")

    # Try JWT first
    uid = decode_jwt(token)
    if uid:
        return uid

    # Else treat as Google session_token
    db = request.app.state.db
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="invalid token")
    expires = session.get("expires_at")
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="session expired")
    return session["user_id"]
