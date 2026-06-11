import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in-progress"
    in_review = "in-review"
    complete = "complete"


class ProviderKind(str, enum.Enum):
    openai_compatible = "openai-compatible"
    openai = "openai"
    anthropic = "anthropic"
    google = "google"
    ollama = "ollama"
    other = "other"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    projects: Mapped[list["Project"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    model_providers: Mapped[list["ModelProvider"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    agents: Mapped[list["AgentRole"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="default")
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    prefix: Mapped[str] = mapped_column(String(16), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="api_keys")


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_projects_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship(back_populates="projects")
    tasks: Mapped[list["Task"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    instructions: Mapped[str] = mapped_column(Text)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, values_callable=lambda enum_cls: [member.value for member in enum_cls], native_enum=False),
        default=TaskStatus.todo,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    project: Mapped[Project] = relationship(back_populates="tasks")


class ModelProvider(Base):
    __tablename__ = "model_providers"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_model_providers_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[ProviderKind] = mapped_column(
        Enum(ProviderKind, values_callable=lambda enum_cls: [member.value for member in enum_cls], native_enum=False),
        default=ProviderKind.openai_compatible,
    )
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    model_name: Mapped[str] = mapped_column(String(160))
    api_key_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    api_key_prefix: Mapped[str | None] = mapped_column(String(16), nullable=True)
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship(back_populates="model_providers")
    agents: Mapped[list["AgentRole"]] = relationship(back_populates="model_provider")


class AgentRole(Base):
    __tablename__ = "agent_roles"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_agent_roles_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    model_provider_id: Mapped[int | None] = mapped_column(
        ForeignKey("model_providers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(120), default="assistant")
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship(back_populates="agents")
    model_provider: Mapped[ModelProvider | None] = relationship(back_populates="agents")
