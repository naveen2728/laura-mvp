import hashlib

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_secret, encrypt_secret
from app.models import AgentRole, ModelProvider, Project, ProviderKind, Task
from app.schemas import AgentRoleCreate, AgentRoleUpdate, ModelProviderCreate, ModelProviderUpdate, StudioRunRead


def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def _secret_prefix(secret: str) -> str:
    return secret[:12]


def list_model_providers(db: Session, *, user_id: int) -> list[ModelProvider]:
    return list(db.scalars(select(ModelProvider).where(ModelProvider.user_id == user_id).order_by(ModelProvider.created_at.desc())))


def get_model_provider(db: Session, *, user_id: int, provider_id: int) -> ModelProvider | None:
    return db.scalar(select(ModelProvider).where(ModelProvider.id == provider_id, ModelProvider.user_id == user_id))


def create_model_provider(db: Session, *, user_id: int, data: ModelProviderCreate) -> ModelProvider:
    provider = ModelProvider(
        user_id=user_id,
        name=data.name,
        kind=data.kind,
        base_url=data.base_url,
        model_name=data.model_name,
        api_key_hash=_hash_secret(data.api_key) if data.api_key else None,
        api_key_prefix=_secret_prefix(data.api_key) if data.api_key else None,
        api_key_encrypted=encrypt_secret(data.api_key) if data.api_key else None,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


def update_model_provider(db: Session, *, provider: ModelProvider, data: ModelProviderUpdate) -> ModelProvider:
    updates = data.model_dump(exclude_unset=True)
    api_key = updates.pop("api_key", None)
    for field, value in updates.items():
        setattr(provider, field, value)
    if api_key:
        provider.api_key_hash = _hash_secret(api_key)
        provider.api_key_prefix = _secret_prefix(api_key)
        provider.api_key_encrypted = encrypt_secret(api_key)
    db.commit()
    db.refresh(provider)
    return provider


def delete_model_provider(db: Session, *, provider: ModelProvider) -> None:
    db.delete(provider)
    db.commit()


def list_agent_roles(db: Session, *, user_id: int) -> list[AgentRole]:
    return list(db.scalars(select(AgentRole).where(AgentRole.user_id == user_id).order_by(AgentRole.created_at.desc())))


def get_agent_role(db: Session, *, user_id: int, agent_id: int) -> AgentRole | None:
    return db.scalar(select(AgentRole).where(AgentRole.id == agent_id, AgentRole.user_id == user_id))


def create_agent_role(db: Session, *, user_id: int, data: AgentRoleCreate) -> AgentRole | None:
    if data.model_provider_id is not None and get_model_provider(db, user_id=user_id, provider_id=data.model_provider_id) is None:
        return None
    agent = AgentRole(
        user_id=user_id,
        name=data.name,
        role=data.role,
        model_provider_id=data.model_provider_id,
        system_prompt=data.system_prompt,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def update_agent_role(db: Session, *, user_id: int, agent: AgentRole, data: AgentRoleUpdate) -> AgentRole | None:
    updates = data.model_dump(exclude_unset=True)
    provider_id = updates.get("model_provider_id")
    if provider_id is not None and get_model_provider(db, user_id=user_id, provider_id=provider_id) is None:
        return None
    for field, value in updates.items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent


def delete_agent_role(db: Session, *, agent: AgentRole) -> None:
    db.delete(agent)
    db.commit()


def get_provider_api_key(provider: ModelProvider) -> str | None:
    if not provider.api_key_encrypted:
        return None
    return decrypt_secret(provider.api_key_encrypted)


def _provider_base_url(provider: ModelProvider) -> str:
    if provider.base_url:
        return provider.base_url.rstrip("/")
    if provider.kind == ProviderKind.openai:
        return "https://api.openai.com/v1"
    return ""


def _project_memory_context(db: Session, *, user_id: int, project_id: int) -> tuple[Project | None, str]:
    project = db.scalar(select(Project).where(Project.id == project_id, Project.user_id == user_id))
    if project is None:
        return None, ""

    tasks = list(db.scalars(select(Task).where(Task.project_id == project.id).order_by(Task.created_at.asc())))
    task_lines = [
        f"- Task #{task.id} [{task.status.value}]: {task.instructions}"
        + (f"\n  Context: {task.context}" if task.context else "")
        for task in tasks
    ]
    memory = "\n".join(
        [
            f"Project: {project.name}",
            f"Description: {project.description or 'None'}",
            "Tasks:",
            "\n".join(task_lines) if task_lines else "No tasks yet.",
        ]
    )
    return project, memory


def run_agent(
    db: Session,
    *,
    user_id: int,
    project_id: int,
    agent_id: int,
    prompt: str,
) -> StudioRunRead | None:
    agent = get_agent_role(db, user_id=user_id, agent_id=agent_id)
    project, memory_context = _project_memory_context(db, user_id=user_id, project_id=project_id)
    if agent is None or project is None or agent.model_provider is None:
        return None

    provider = agent.model_provider
    if provider.kind not in {ProviderKind.openai_compatible, ProviderKind.openai}:
        raise ValueError("Only OpenAI-compatible providers are supported in this MVP run endpoint")

    api_key = get_provider_api_key(provider)
    base_url = _provider_base_url(provider)
    if not api_key or not base_url:
        raise ValueError("Model provider is missing an API key or base URL")

    system_prompt = "\n\n".join(
        [
            agent.system_prompt or "You are a helpful coding agent using Laura shared memory.",
            "Use this Laura shared memory as source-of-truth project context.",
            memory_context,
        ]
    )

    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": provider.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    output = payload["choices"][0]["message"]["content"]

    return StudioRunRead(
        project_id=project.id,
        agent_id=agent.id,
        agent_name=agent.name,
        provider_name=provider.name,
        model_name=provider.model_name,
        output=output,
        memory_context=memory_context,
    )
