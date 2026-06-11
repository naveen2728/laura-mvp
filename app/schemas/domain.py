from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.domain import TaskStatus


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
