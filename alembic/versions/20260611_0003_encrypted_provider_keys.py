"""encrypted provider keys

Revision ID: 20260611_0003
Revises: 20260611_0002
Create Date: 2026-06-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260611_0003"
down_revision: str | None = "20260611_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("model_providers", sa.Column("api_key_encrypted", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("model_providers", "api_key_encrypted")
