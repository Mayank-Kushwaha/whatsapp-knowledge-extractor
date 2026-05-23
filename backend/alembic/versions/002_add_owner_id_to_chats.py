"""Add owner_id to chats and wipe existing data

Revision ID: 002
Revises: 001
Create Date: 2026-05-22

Adds the owner_id column (Google `sub`) so each chat is scoped to a
single user. Existing chats predate the auth system and have no owner,
so the upgrade wipes all chat-related rows before adding the NOT NULL
column. The application enforces ownership on every read/write through
get_current_user.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Wipe all chat-derived data before adding the NOT NULL owner_id.
    # Order matters because of foreign keys, even with cascade.
    op.execute("DELETE FROM messages_fts;")
    op.execute("DELETE FROM important_flags;")
    op.execute("DELETE FROM media_items;")
    op.execute("DELETE FROM links;")
    op.execute("DELETE FROM messages;")
    op.execute("DELETE FROM clusters;")
    op.execute("DELETE FROM senders;")
    op.execute("DELETE FROM pipeline_status;")
    op.execute("DELETE FROM chats;")

    with op.batch_alter_table("chats") as batch:
        batch.add_column(sa.Column("owner_id", sa.String(255), nullable=False))

    op.create_index("ix_chats_owner_id", "chats", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_chats_owner_id", table_name="chats")
    with op.batch_alter_table("chats") as batch:
        batch.drop_column("owner_id")
