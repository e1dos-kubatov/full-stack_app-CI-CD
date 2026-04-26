import pytest

import app as app_module
from app import create_app, db


@pytest.fixture()
def client():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.drop_all()
        db.create_all()

    with app.test_client() as test_client:
        yield test_client


def test_health_endpoint(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok", "database": "connected"}


def test_get_data_returns_empty_list(client):
    response = client.get("/api/data")

    assert response.status_code == 200
    assert response.get_json() == []


def test_create_and_list_data(client):
    create_response = client.post("/api/data", json={"title": "Prepare CI pipeline"})

    assert create_response.status_code == 201
    created_item = create_response.get_json()
    assert created_item["id"] == 1
    assert created_item["title"] == "Prepare CI pipeline"
    assert created_item["completed"] is False
    assert created_item["created_at"]
    assert created_item["updated_at"]

    list_response = client.get("/api/data")
    assert list_response.status_code == 200
    assert list_response.get_json() == [created_item]


def test_create_data_requires_title(client):
    response = client.post("/api/data", json={"title": "   "})

    assert response.status_code == 400
    assert response.get_json() == {"error": "Field 'title' is required"}


def test_delete_data(client):
    create_response = client.post("/api/data", json={"title": "Deploy backend"})
    item_id = create_response.get_json()["id"]

    delete_response = client.delete(f"/api/data/{item_id}")
    assert delete_response.status_code == 200
    assert delete_response.get_json() == {"message": "Item deleted", "id": item_id}

    list_response = client.get("/api/data")
    assert list_response.get_json() == []


def test_delete_missing_data_returns_404(client):
    response = client.delete("/api/data/999")

    assert response.status_code == 404
    assert response.get_json() == {"error": "Item not found"}


def test_update_data(client):
    create_response = client.post("/api/data", json={"title": "Wire frontend"})
    item_id = create_response.get_json()["id"]

    update_response = client.patch(
        f"/api/data/{item_id}",
        json={"title": "Wire React frontend", "completed": True},
    )

    assert update_response.status_code == 200
    updated_item = update_response.get_json()
    assert updated_item["title"] == "Wire React frontend"
    assert updated_item["completed"] is True


def test_stats_endpoint(client):
    client.post("/api/data", json={"title": "One", "completed": True})
    client.post("/api/data", json={"title": "Two"})

    response = client.get("/api/stats")

    assert response.status_code == 200
    assert response.get_json() == {"total": 2, "completed": 1, "pending": 1}


def test_run_with_retries_retries_then_succeeds(monkeypatch):
    attempts = {"count": 0}

    def operation():
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise RuntimeError("temporary failure")
        return "ok"

    monkeypatch.setattr(app_module.time, "sleep", lambda _seconds: None)

    result = app_module.run_with_retries(operation, retries=3, delay_seconds=0)

    assert result == "ok"
    assert attempts["count"] == 3


def test_run_with_retries_raises_after_final_attempt(monkeypatch):
    attempts = {"count": 0}

    def operation():
        attempts["count"] += 1
        raise RuntimeError("still failing")

    monkeypatch.setattr(app_module.time, "sleep", lambda _seconds: None)

    with pytest.raises(RuntimeError, match="still failing"):
        app_module.run_with_retries(operation, retries=2, delay_seconds=0)

    assert attempts["count"] == 2


def test_resolve_database_url_prefers_database_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/fullstack_app")
    monkeypatch.setenv("SQLITE_PATH", "ignored.db")

    assert (
        app_module.resolve_database_url()
        == "postgresql://user:pass@localhost:5432/fullstack_app"
    )


def test_resolve_database_url_uses_sqlite_path(monkeypatch, tmp_path):
    sqlite_file = tmp_path / "render-data" / "app.db"
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("SQLITE_PATH", str(sqlite_file))

    assert app_module.resolve_database_url() == app_module.sqlite_url_from_path(sqlite_file)


def test_ensure_sqlite_directory_creates_parent_directory(tmp_path):
    sqlite_file = tmp_path / "nested" / "data" / "app.db"

    app_module.ensure_sqlite_directory(app_module.sqlite_url_from_path(sqlite_file))

    assert sqlite_file.parent.exists()
