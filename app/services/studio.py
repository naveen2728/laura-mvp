import hashlib

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AgentRole, ModelProvider
from app.schemas import AgentRoleCreate, AgentRoleUpdate, ModelProviderCreate, ModelProviderUpdate


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
