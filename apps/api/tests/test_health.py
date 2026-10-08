from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_has_no_versions_and_sets_request_id() -> None:
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert len(r.headers["x-request-id"]) >= 8


def test_unknown_route_uses_error_shape() -> None:
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert set(r.json()["error"]) == {"code", "message", "request_id"}


def test_bogus_request_id_is_replaced() -> None:
    r = client.get("/api/v1/health", headers={"x-request-id": "<script>"})
    assert r.headers["x-request-id"] != "<script>"
