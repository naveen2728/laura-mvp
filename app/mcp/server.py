from typing import Any

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import ApiKey, TaskStatus
from app.schemas import ChatMessageCreate, ConversationThreadCreate, ProjectCreate, TaskCreate
from app.services import projects as project_service
from app.services import tasks as task_service
from app.services import threads as thread_service
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


def _thread_to_dict(thread) -> dict[str, Any]:
    if isinstance(thread, dict):
        return {
            "id": thread["id"],
            "project_id": thread["project_id"],
            "title": thread["title"],
            "message_count": thread.get("message_count", 0),
            "created_at": thread["created_at"].isoformat(),
            "updated_at": thread["updated_at"].isoformat(),
        }
    return {
        "id": thread.id,
        "project_id": thread.project_id,
        "title": thread.title,
        "message_count": len(getattr(thread, "messages", [])),
        "created_at": thread.created_at.isoformat(),
        "updated_at": thread.updated_at.isoformat(),
    }


def _message_to_dict(message) -> dict[str, Any]:
    return {
        "id": message.id,
        "thread_id": message.thread_id,
        "role": message.role,
        "label": message.label,
        "content": message.content,
        "created_at": message.created_at.isoformat(),
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


@mcp.tool()
def list_threads(project_id: int | None = None) -> list[dict[str, Any]]:
    """Return synced conversation threads, optionally filtered by project id."""
    user_id = _current_user_id()
    with _with_db() as db:
        threads = thread_service.list_threads(db, user_id=user_id)
        if project_id is not None:
            project = project_service.get_project(db, user_id=user_id, project_id=project_id)
            if project is None:
                raise ValueError("Project not found")
            threads = [thread for thread in threads if thread["project_id"] == project_id]
        return [_thread_to_dict(thread) for thread in threads]


@mcp.tool()
def create_thread(title: str = "New thread", project_id: int | None = None) -> dict[str, Any]:
    """Create a synced conversation thread for the authenticated user."""
    user_id = _current_user_id()
    with _with_db() as db:
        thread = thread_service.create_thread(
            db,
            user_id=user_id,
            data=ConversationThreadCreate(title=title, project_id=project_id),
        )
        if thread is None:
            raise ValueError("Project not found")
        return _thread_to_dict(thread)


@mcp.tool()
def list_thread_messages(thread_id: int) -> list[dict[str, Any]]:
    """Return all messages in one synced thread."""
    user_id = _current_user_id()
    with _with_db() as db:
        messages = thread_service.list_messages(db, user_id=user_id, thread_id=thread_id)
        if messages is None:
            raise ValueError("Thread not found")
        return [_message_to_dict(message) for message in messages]


@mcp.tool()
def add_thread_message(thread_id: int, role: str, content: str, label: str | None = None) -> dict[str, Any]:
    """Append a message to a synced thread. Role examples: user, assistant, system."""
    user_id = _current_user_id()
    with _with_db() as db:
        message = thread_service.create_message(
            db,
            user_id=user_id,
            thread_id=thread_id,
            data=ChatMessageCreate(role=role, label=label, content=content),
        )
        if message is None:
            raise ValueError("Thread not found")
        return _message_to_dict(message)
