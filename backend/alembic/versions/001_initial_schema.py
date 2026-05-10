"""Initial schema — all 8 tables + FTS5

Revision ID: 001
Revises: None
Create Date: 2026-05-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- chats ---
    op.create_table(
        "chats",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), server_default="personal"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("message_count", sa.Integer, server_default="0"),
        sa.Column("date_range_start", sa.DateTime, nullable=True),
        sa.Column("date_range_end", sa.DateTime, nullable=True),
        sa.Column("status", sa.String(50), server_default="processing"),
    )

    # --- senders ---
    op.create_table(
        "senders",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("chat_id", sa.Integer, sa.ForeignKey("chats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("phone_number", sa.String(50), nullable=True),
    )

    # --- clusters (created before messages because messages references it) ---
    op.create_table(
        "clusters",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("chat_id", sa.Integer, sa.ForeignKey("chats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("message_count", sa.Integer, server_default="0"),
        sa.Column("centroid_embedding", sa.Text, nullable=True),
    )

    # --- messages ---
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("chat_id", sa.Integer, sa.ForeignKey("chats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.Integer, sa.ForeignKey("senders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text, nullable=False, server_default=""),
        sa.Column("timestamp", sa.DateTime, nullable=False),
        sa.Column("type", sa.String(50), server_default="text"),
        sa.Column("is_important", sa.Boolean, server_default="0"),
        sa.Column("importance_reason", sa.String(255), nullable=True),
        sa.Column("cluster_id", sa.Integer, sa.ForeignKey("clusters.id", ondelete="SET NULL"), nullable=True),
        sa.Column("embedding", sa.Text, nullable=True),
        sa.Column("raw_line", sa.Text, nullable=True),
    )

    # --- media_items ---
    op.create_table(
        "media_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("message_id", sa.Integer, sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chat_id", sa.Integer, sa.ForeignKey("chats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("original_filename", sa.String(500), nullable=True),
        sa.Column("local_path", sa.String(1000), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("file_size_bytes", sa.Integer, nullable=True),
        sa.Column("extracted_text", sa.Text, nullable=True),
    )

    # --- links ---
    op.create_table(
        "links",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("message_id", sa.Integer, sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("og_title", sa.String(500), nullable=True),
        sa.Column("og_description", sa.Text, nullable=True),
        sa.Column("og_image_url", sa.Text, nullable=True),
        sa.Column("link_type", sa.String(50), nullable=True),
    )

    # --- important_flags ---
    op.create_table(
        "important_flags",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("message_id", sa.Integer, sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trigger_type", sa.String(50), nullable=False),
        sa.Column("trigger_value", sa.String(255), nullable=True),
        sa.Column("flagged_at", sa.DateTime, server_default=sa.func.now()),
    )

    # --- pipeline_status ---
    op.create_table(
        "pipeline_status",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("chat_id", sa.Integer, sa.ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("current_step", sa.Integer, server_default="0"),
        sa.Column("steps_complete", sa.Integer, server_default="0"),
        sa.Column("steps_total", sa.Integer, server_default="10"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # --- FTS5 virtual table for full-text search ---
    op.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts "
        "USING fts5(content, content_rowid='id', tokenize='porter unicode61');"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS messages_fts;")
    op.drop_table("pipeline_status")
    op.drop_table("important_flags")
    op.drop_table("links")
    op.drop_table("media_items")
    op.drop_table("messages")
    op.drop_table("clusters")
    op.drop_table("senders")
    op.drop_table("chats")
