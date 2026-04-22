import pytest

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
