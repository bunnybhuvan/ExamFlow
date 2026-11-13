import pytest

from app.models import User
from app.security import hash_password, verify_password, issue_token, decode_token


def test_password_hash_is_salted_and_verifiable():
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")
    assert first != second
    assert verify_password("correct horse battery staple", first)
    assert not verify_password("wrong password", first)


def test_signed_token_round_trip_and_tamper_detection(monkeypatch):
    monkeypatch.setenv("EXAMFLOW_AUTH_SECRET", "test-secret-" + "x" * 40)
    user = User(id="USR-1", email="admin@example.test", role="admin", active=True,
                password_hash=hash_password("correct horse battery staple"))
    token = issue_token(user)
    claims = decode_token(token)
    assert claims["sub"] == "USR-1"
    assert claims["role"] == "admin"
    assert decode_token(token + "tampered") is None


def test_token_requires_strong_secret(monkeypatch):
    monkeypatch.setenv("EXAMFLOW_AUTH_SECRET", "short")
    user = User(id="USR-2", email="user@example.test", role="viewer", active=True,
                password_hash=hash_password("correct horse battery staple"))
    with pytest.raises(RuntimeError):
        issue_token(user)
