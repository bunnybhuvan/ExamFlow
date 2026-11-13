"""Small, dependency-free authentication primitives for ExamFlow."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from fastapi import Request
from starlette.responses import JSONResponse
from .database import SessionLocal
from . import models

PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/health/database",
    "/api/v1/auth/login",
    "/api/v1/auth/config",
    "/openapi.json",
    "/docs",
    "/redoc",
}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return "pbkdf2_sha256$310000$" + base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(digest).decode()


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, rounds, salt, expected = encoded.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.urlsafe_b64decode(salt), int(rounds))
        return hmac.compare_digest(base64.urlsafe_b64encode(actual).decode(), expected)
    except (ValueError, TypeError):
        return False


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def issue_token(user: models.User) -> str:
    secret = os.getenv("EXAMFLOW_AUTH_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("EXAMFLOW_AUTH_SECRET must contain at least 32 characters.")
    payload = _b64(json.dumps({
        "sub": user.id, "email": user.email, "role": user.role,
        "exp": int(time.time()) + 8 * 60 * 60,
    }, separators=(",", ":")).encode())
    signature = _b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
    return payload + "." + signature


def decode_token(token: str) -> dict | None:
    try:
        payload, signature = token.split(".", 1)
        secret = os.getenv("EXAMFLOW_AUTH_SECRET", "")
        expected = _b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
        if len(secret) < 32 or not hmac.compare_digest(signature, expected):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if int(data["exp"]) <= int(time.time()):
            return None
        return data
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None


def auth_enabled() -> bool:
    return os.getenv("EXAMFLOW_AUTH_ENABLED", "false").lower() == "true"


async def auth_middleware(request: Request, call_next):
    if not auth_enabled() or request.method == "OPTIONS" or request.url.path in PUBLIC_PATHS:
        return await call_next(request)
    if not request.url.path.startswith("/api/v1/"):
        return await call_next(request)
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        return JSONResponse({"detail": "Authentication required."}, status_code=401)
    claims = decode_token(header[7:])
    if not claims:
        return JSONResponse({"detail": "Invalid or expired access token."}, status_code=401)
    db = SessionLocal()
    try:
        user = db.get(models.User, claims.get("sub"))
        if not user or not user.active or user.role != claims.get("role"):
            return JSONResponse({"detail": "Account is inactive or access has changed."}, status_code=401)
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path != "/api/v1/auth/change-password":
            if user.role not in {"admin", "scheduler"}:
                return JSONResponse({"detail": "Your role cannot modify scheduling data."}, status_code=403)
            if request.url.path.startswith("/api/v1/auth/users") and user.role != "admin":
                return JSONResponse({"detail": "Administrator role required."}, status_code=403)
        request.state.user = {"id": user.id, "email": user.email, "role": user.role}
        return await call_next(request)
    finally:
        db.close()
