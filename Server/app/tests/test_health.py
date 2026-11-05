"""Phase 0 tests: liveness and the uniform error shape (no DB required)."""


def test_liveness(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_unknown_route_uses_contract_error_shape(client):
    res = client.get("/api/v1/does-not-exist")
    assert res.status_code == 404
    body = res.json()
    assert body["code"] == "NOT_FOUND"
    assert "detail" in body


def test_cors_allows_only_frontend_origin(client):
    ok = client.options(
        "/api/v1/health",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = client.options(
        "/api/v1/health",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bad.headers