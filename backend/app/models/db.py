"""SQLAlchemy 2.0 database models and engine setup.

Defines all 8 tables from the project schema:
- chats, senders, messages, messages_fts (FTS5), media_items,
  links, clusters, important_flags, pipeline_status
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Boolean,
    create_engine,
    event,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)

from app.core.config import DATABASE_URL


# ---------------------------------------------------------------------------
# Engine & Session
# ---------------------------------------------------------------------------

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

# Enable WAL mode and foreign keys for SQLite
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="personal")  # personal | group
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    date_range_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_range_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="processing")  # processing | ready | error

    # Relationships
    senders = relationship("Sender", back_populates="chat", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")
    clusters = relationship("Cluster", back_populates="chat", cascade="all, delete-orphan")
    pipeline = relationship("PipelineStatus", back_populates="chat", uselist=False, cascade="all, delete-orphan")


class Sender(Base):
    __tablename__ = "senders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    chat = relationship("Chat", back_populates="senders")
    messages = relationship("Message", back_populates="sender")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    sender_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("senders.id", ondelete="SET NULL"), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="text")  # text | link | image | video | pdf | document | audio | contact | location | deleted | unknown_media
    is_important: Mapped[bool] = mapped_column(Boolean, default=False)
    importance_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cluster_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clusters.id", ondelete="SET NULL"), nullable=True)
    embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of floats
    raw_line: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    chat = relationship("Chat", back_populates="messages")
    sender = relationship("Sender", back_populates="messages")
    cluster = relationship("Cluster", back_populates="messages")
    media_items = relationship("MediaItem", back_populates="message", cascade="all, delete-orphan")
    links = relationship("Link", back_populates="message", cascade="all, delete-orphan")
    important_flags = relationship("ImportantFlag", back_populates="message", cascade="all, delete-orphan")


class MediaItem(Base):
    __tablename__ = "media_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # image | video | audio | document | pdf | contact
    original_filename: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    local_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    message = relationship("Message", back_populates="media_items")


class Link(Base):
    __tablename__ = "links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    og_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    og_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    og_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    link_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # youtube | drive | amazon | twitter | news | generic

    # Relationships
    message = relationship("Message", back_populates="links")


class Cluster(Base):
    __tablename__ = "clusters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    centroid_embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array

    # Relationships
    chat = relationship("Chat", back_populates="clusters")
    messages = relationship("Message", back_populates="cluster")


class ImportantFlag(Base):
    __tablename__ = "important_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)  # keyword | emoji | manual
    trigger_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    flagged_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    message = relationship("Message", back_populates="important_flags")


class PipelineStatus(Base):
    __tablename__ = "pipeline_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, unique=True)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    steps_complete: Mapped[int] = mapped_column(Integer, default=0)
    steps_total: Mapped[int] = mapped_column(Integer, default=10)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    chat = relationship("Chat", back_populates="pipeline")


# ---------------------------------------------------------------------------
# FTS5 Virtual Table — created via raw SQL in Alembic migration
# ---------------------------------------------------------------------------
# CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
# USING fts5(content, content_rowid='id', tokenize='porter unicode61');
