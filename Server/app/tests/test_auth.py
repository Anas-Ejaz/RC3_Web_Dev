"""Phase 1 tests: registration, login, cookies, rate limiting, role guards."""
import pytest
from sqlalchemy import select

from app.core.deps import require_recruiter
from app.main import app
from app.models.user import User

PASSWORD = "Str0ng-Passw0rd"


@pytest.fixture(autouse=True, scope="module")
def _recruiter_only_route():
    """Temporary protected route so we can test role guards before real recruiter routes exist."""
    app.add_api_route("/api/v1/_test/recruiter-only", lambda user=__import__("fastapi").Depends(require_recruiter): {"ok": True}, methods=["GET"])
    yield


def _register(client, email="cand@example.com", role="candidate", password=PASSWORD):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Test User", "role": role},
    )


def test_register_returns_user_sets_httponly_cookie_and_hides_password(client):
    res = _register(client)
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "cand@example.com" and body["role"] == "candidate"
    assert "password" not in body and "password_hash" not in body
    assert "httponly" in res.headers["set-cookie"].lower()


def test_password_is_stored_as_argon2_hash(client, db_session):
    _register(client)
    user = db_session.scalar(select(User).where(User.email == "cand@example.com"))
    assert user.password_hash.startswith("$argon2")
    assert PASSWORD not in user.password_hash


def test_duplicate_email_conflict_is_case_insensitive(client):
    assert _register(client, email="dup@example.com").status_code == 201
    res = _register(client, email="DUP@example.com")
    assert res.status_code == 409
    assert res.json()["code"] == "EMAIL_EXISTS"


def test_validation_errors_use_contract_shape(client):
    res = _register(client, password="short")
    assert res.status_code == 422
    body = res.json()
    assert body["code"] == "VALIDATION_ERROR" and "password" in body["fields"]
    res = client.post("/api/v1/auth/register", json={"email": "x@example.com", "password": PASSWORD, "full_name": "X", "role": "admin"})
    assert res.status_code == 422


def test_login_me_and_logout_flow(client):
    _register(client)
    client.post("/api/v1/auth/logout")
    assert client.get("/api/v1/auth/me").status_code == 401

    res = client.post("/api/v1/auth/login", json={"email": "cand@example.com", "password": PASSWORD})
    assert res.status_code == 200
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200 and me.json()["email"] == "cand@example.com"

    client.post("/api/v1/auth/logout")
    assert client.get("/api/v1/auth/me").status_code == 401


def test_wrong_password_and_unknown_email_look_identical(client):
    _register(client)
    client.post("/api/v1/auth/logout")
    a = client.post("/api/v1/auth/login", json={"email": "cand@example.com", "password": "wrong-password"})
    b = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "wrong-password"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_login_rate_limiting(client):
    _register(client)
    client.post("/api/v1/auth/logout")
    for _ in range(5):
        r = client.post("/api/v1/auth/login", json={"email": "cand@example.com", "password": "wrong-password"})
        assert r.status_code == 401
    blocked = client.post("/api/v1/auth/login", json={"email": "cand@example.com", "password": PASSWORD})
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "RATE_LIMITED"


def test_tampered_token_is_rejected(client):
    client.cookies.set("access_token", "not.a.jwt")
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_candidate_blocked_from_recruiter_route_but_recruiter_allowed(client):
    assert client.get("/api/v1/_test/recruiter-only").status_code == 401  # anonymous

    _register(client, email="c@example.com", role="candidate")
    res = client.get("/api/v1/_test/recruiter-only")
    assert res.status_code == 403 and res.json()["code"] == "FORBIDDEN"

    client.post("/api/v1/auth/logout")
    _register(client, email="r@example.com", role="recruiter")
    assert client.get("/api/v1/_test/recruiter-only").status_code == 200