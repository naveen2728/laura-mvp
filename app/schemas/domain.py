from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.domain import ProviderKind, TaskStatus


class UserCreate(BaseModel):
    email: EmailStr
    name: str | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str | None
    created_at: datetime


class ApiKeyCreate(BaseModel):
    user_id: int
    name: str = "default"


class ApiKeyRead(BaseModel):
    id: int
    user_id: int
    name: str
    prefix: str
    key: str = Field(description="Plaintext API key. Store it now; only the hash is persisted.")
    created_at: datetime


class ApiKeyMetadataRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    project_id: int
    instructions: str = Field(min_length=1)
    context: str | None = None


class TaskUpdate(BaseModel):
    instructions: str | None = Field(default=None, min_length=1)
    context: str | None = None
    status: TaskStatus | None = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    instructions: str
    context: str | None
    status: TaskStatus
    created_at: datetime
    updated_at: datetime


class ModelProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: ProviderKind = ProviderKind.openai_compatible
    base_url: str | None = Field(default=None, max_length=500)
    model_name: str = Field(min_length=1, max_length=160)
    api_key: str | None = Field(default=None, min_length=1)


class ModelProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    kind: ProviderKind | None = None
    base_url: str | None = Field(default=None, max_length=500)
    model_name: str | None = Field(default=None, min_length=1, max_length=160)
    api_key: str | None = Field(default=None, min_length=1)


class ModelProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    kind: ProviderKind
    base_url: str | None
    model_name: str
    api_key_prefix: str | None
    created_at: datetime
    updated_at: datetime


class AgentRoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    role: str = Field(default="assistant", min_length=1, max_length=120)
    model_provider_id: int | None = None
    system_prompt: str | None = None


class AgentRoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: str | None = Field(default=None, min_length=1, max_length=120)
    model_provider_id: int | None = None
    system_prompt: str | None = None


class AgentRoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    role: str
    model_provider_id: int | None
    system_prompt: str | None
    created_at: datetime
    updated_at: datetime


class StudioRunCreate(BaseModel):
    project_id: int
    agent_id: int
    thread_id: int | None = None
    prompt: str = Field(min_length=1)


class StudioRunRead(BaseModel):
    project_id: int
    agent_id: int
    agent_name: str
    provider_name: str
    model_name: str
    output: str
    memory_context: str


class ConversationThreadCreate(BaseModel):
    title: str = Field(default="New thread", min_length=1, max_length=200)
    project_id: int | None = None


class ConversationThreadUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    project_id: int | None = None


class ConversationThreadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    project_id: int | None
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ChatMessageCreate(BaseModel):
    role: str = Field(min_length=1, max_length=40)
    label: str | None = Field(default=None, max_length=200)
    content: str = Field(min_length=1)


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    thread_id: int
    role: str
    label: str | None
    content: str
    created_at: datetime
