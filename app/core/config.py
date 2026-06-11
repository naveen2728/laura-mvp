from functools import lru_cache

from pydantic import AnyHttpUrl
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Laura MVP"
    app_secret_key: str = "dev-only-change-me"
    database_url: str = "postgresql+psycopg://bridgemind:bridgemind@localhost:5432/bridgemind"
    create_tables_on_startup: bool = True
    run_migrations_on_startup: bool = True
    mcp_issuer_url: AnyHttpUrl = "http://localhost:8000"
    mcp_resource_server_url: AnyHttpUrl = "http://localhost:8000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
