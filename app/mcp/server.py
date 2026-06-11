from typing import Any

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import ApiKey, TaskStatus
from app.schemas import ProjectCreate, TaskCreate
from app.services import projects as project_service
from app.services import tasks as task_service
from app.services.api_keys import authenticate_api_key


def _project_to_dict(project) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


def _task_to_dict(task) -> dict[str, Any]:
    return {
        "id": task.id,
        "project_id": task.project_id,
        "instructions": task.instructions,
        "context": task.context,
        "status": task.status.value,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
    }


class ApiKeyTokenVerifier(TokenVerifier):
    """Validates MCP Bearer tokens against the same ApiKey table used by REST.

    The official MCP SDK extracts `Authorization: Bearer <token>` before a tool
    runs, calls this verifier, and stores the resulting AccessToken in request
    context. Tool handlers then call `get_access_token()` to recover the user id.
    """

    async def verify_token(self, token: str) -> AccessToken | None:
        with SessionLocal() as db:
            api_key = authenticate_api_key(db, token)
            if api_key is None:
                return None
            return AccessToken(
                token=token,
                client_id=f"api-key:{api_key.id}",
                scopes=["user"],
                subject=str(api_key.user_id),
                claims={"api_key_id": api_key.id, "user_id": api_key.user_id},
            )


def _current_user_id() -> int:
    access_token = get_access_token()
    if access_token is None or access_token.subject is None:
        raise PermissionError("Missing authenticated MCP access token")
    return int(access_token.subject)


def _with_db() -> Session:
    return SessionLocal()


settings = get_settings()

mcp = FastMCP(
    "Laura Shared Context",
    instructions=(
        "Shared project and task context for AI coding agents. "
        "Use these tools to coordinate work across IDE agents."
    ),
    token_verifier=ApiKeyTokenVerifier(),
    auth=AuthSettings(
        issuer_url=settings.mcp_issuer_url,
        resource_server_url=settings.mcp_resource_server_url,
        required_scopes=["user"],
    ),
    stateless_http=True,
    json_response=True,
)

# Mounting this MCP app under FastAPI's `/mcp` prefix should not create `/mcp/mcp`.
mcp.settings.streamable_http_path = "/"


@mcp.tool()
def list_projects() -> list[dict[str, Any]]:
    """Return all projects owned by the authenticated API key's user."""
    user_id = _current_user_id()
    with _with_db() as db:
        return [_project_to_dict(project) for project in project_service.list_projects(db, user_id=user_id)]


@mcp.tool()
def create_project(name: str, description: str | None = None) -> dict[str, Any]:
    """Create a project for the authenticated user."""
    user_id = _current_user_id()
    with _with_db() as db:
        project = project_service.create_project(
            db,
            user_id=user_id,
            data=ProjectCreate(name=name, description=description),
        )
        return _project_to_dict(project)


@mcp.tool()
def list_tasks(project_id: int) -> list[dict[str, Any]]:
    """Return tasks for one of the authenticated user's projects."""
    user_id = _current_user_id()
    with _with_db() as db:
        tasks = task_service.list_tasks(db, user_id=user_id, project_id=project_id)
        if tasks is None:
            raise ValueError("Project not found")
        return [_task_to_dict(task) for task in tasks]


@mcp.tool()
def create_task(project_id: int, instructions: str, context: str | None = None) -> dict[str, Any]:
    """Create a task in one of the authenticated user's projects."""
    user_id = _current_user_id()
    with _with_db() as db:
        task = task_service.create_task(
            db,
            user_id=user_id,
            data=TaskCreate(project_id=project_id, instructions=instructions, context=context),
        )
        if task is None:
            raise ValueError("Project not found")
        return _task_to_dict(task)


@mcp.tool()
def update_task_status(task_id: int, status: TaskStatus) -> dict[str, Any]:
    """Update a task's status. Allowed values: todo, in-progress, in-review, complete."""
    user_id = _current_user_id()
    with _with_db() as db:
        task = task_service.get_task(db, user_id=user_id, task_id=task_id)
        if task is None:
            raise ValueError("Task not found")
        return _task_to_dict(task_service.update_task_status(db, task=task, status=status))
