import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["CREATE_TABLES_ON_STARTUP"] = "true"
os.environ["MCP_ISSUER_URL"] = "http://localhost:8000"
os.environ["MCP_RESOURCE_SERVER_URL"] = "http://localhost:8000"

import pytest
from fastapi.testclient import TestClient

from app.db.session import Base, engine
from app.main import app
from app.mcp.server import ApiKeyTokenVerifier


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def test_rest_project_and_task_flow():
    client = TestClient(app)

    user_response = client.post("/users", json={"email": "dev@example.com", "name": "Dev"})
    assert user_response.status_code == 201
    user_id = user_response.json()["id"]

    key_response = client.post("/api-keys", json={"user_id": user_id, "name": "test"})
    assert key_response.status_code == 201
    api_key = key_response.json()["key"]
    auth_headers = {"Authorization": f"Bearer {api_key}"}

    project_response = client.post(
        "/projects",
        headers=auth_headers,
        json={"name": "Agent OS", "description": "Shared context layer"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/tasks",
        headers=auth_headers,
        json={"project_id": project_id, "instructions": "Build MCP bridge", "context": "Use Streamable HTTP"},
    )
    assert task_response.status_code == 201
    task_id = task_response.json()["id"]

    update_response = client.patch(
        f"/tasks/{task_id}",
        headers=auth_headers,
        json={"status": "in-review"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "in-review"


def test_api_key_listing_and_revocation():
    client = TestClient(app)
    user_id = client.post("/users", json={"email": "keys@example.com", "name": "Keys"}).json()["id"]
    api_key = client.post("/api-keys", json={"user_id": user_id, "name": "dashboard"}).json()["key"]
    auth_headers = {"Authorization": f"Bearer {api_key}"}

    list_response = client.get("/api-keys", headers=auth_headers)
    assert list_response.status_code == 200
    keys = list_response.json()
    assert len(keys) == 1
    assert keys[0]["name"] == "dashboard"
    assert "key" not in keys[0]

    revoke_response = client.delete(f"/api-keys/{keys[0]['id']}", headers=auth_headers)
    assert revoke_response.status_code == 200
    assert revoke_response.json()["revoked_at"] is not None

    denied_response = client.get("/projects", headers=auth_headers)
    assert denied_response.status_code == 401


def test_dashboard_serves_static_ui():
    client = TestClient(app)
    response = client.get("/")

    assert response.status_code == 200
    assert "Laura" in response.text


def test_studio_model_provider_and_agent_flow():
    client = TestClient(app)
    user_id = client.post("/users", json={"email": "studio@example.com", "name": "Studio"}).json()["id"]
    api_key = client.post("/api-keys", json={"user_id": user_id, "name": "studio"}).json()["key"]
    auth_headers = {"Authorization": f"Bearer {api_key}"}

    provider_response = client.post(
        "/studio/models",
        headers=auth_headers,
        json={
            "name": "Kimi K2",
            "kind": "openai-compatible",
            "base_url": "https://openrouter.ai/api/v1",
            "model_name": "moonshotai/kimi-k2",
            "api_key": "sk-test-secret",
        },
    )
    assert provider_response.status_code == 201
    provider = provider_response.json()
    assert provider["name"] == "Kimi K2"
    assert provider["api_key_prefix"] == "sk-test-secr"
    assert "api_key" not in provider

    agent_response = client.post(
        "/studio/agents",
        headers=auth_headers,
        json={
            "name": "Coder",
            "role": "implementation",
            "model_provider_id": provider["id"],
            "system_prompt": "Use Laura memory before coding.",
        },
    )
    assert agent_response.status_code == 201
    agent = agent_response.json()
    assert agent["name"] == "Coder"
    assert agent["model_provider_id"] == provider["id"]

    list_response = client.get("/studio/agents", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


@pytest.mark.anyio
async def test_mcp_token_verifier_returns_user_subject():
    client = TestClient(app)
    user_id = client.post("/users", json={"email": "mcp@example.com"}).json()["id"]
    api_key = client.post("/api-keys", json={"user_id": user_id, "name": "mcp"}).json()["key"]

    access_token = await ApiKeyTokenVerifier().verify_token(api_key)

    assert access_token is not None
    assert access_token.subject == str(user_id)
    assert access_token.scopes == ["user"]
