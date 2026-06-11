"""studio models and agents

Revision ID: 20260611_0002
Revises: 20260610_0001
Create Date: 2026-06-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260611_0002"
down_revision: str | None = "20260610_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "model_providers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "kind",
            sa.Enum("openai-compatible", "openai", "anthropic", "google", "ollama", "other", name="providerkind", native_enum=False),
            nullable=False,
        ),
        sa.Column("base_url", sa.String(length=500), nullable=True),
        sa.Column("model_name", sa.String(length=160), nullable=False),
        sa.Column("api_key_hash", sa.String(length=64), nullable=True),
        sa.Column("api_key_prefix", sa.String(length=16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_model_providers_user_name"),
    )
    op.create_index(op.f("ix_model_providers_id"), "model_providers", ["id"], unique=False)
    op.create_index(op.f("ix_model_providers_user_id"), "model_providers", ["user_id"], unique=False)

    op.create_table(
        "agent_roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("model_provider_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=120), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["model_provider_id"], ["model_providers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_agent_roles_user_name"),
    )
    op.create_index(op.f("ix_agent_roles_id"), "agent_roles", ["id"], unique=False)
    op.create_index(op.f("ix_agent_roles_model_provider_id"), "agent_roles", ["model_provider_id"], unique=False)
    op.create_index(op.f("ix_agent_roles_user_id"), "agent_roles", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_agent_roles_user_id"), table_name="agent_roles")
    op.drop_index(op.f("ix_agent_roles_model_provider_id"), table_name="agent_roles")
    op.drop_index(op.f("ix_agent_roles_id"), table_name="agent_roles")
    op.drop_table("agent_roles")
    op.drop_index(op.f("ix_model_providers_user_id"), table_name="model_providers")
    op.drop_index(op.f("ix_model_providers_id"), table_name="model_providers")
    op.drop_table("model_providers")
