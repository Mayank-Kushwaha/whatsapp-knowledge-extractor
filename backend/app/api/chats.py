"""Chat CRUD API routes.

GET    /api/chats          — List all chats
GET    /api/chats/{id}     — Chat details + stats
DELETE /api/chats/{id}     — Delete a chat and all related data
"""

from datetime import datetime
from typing import Optional

import shutil

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_owned_chat
from app.core.config import MEDIA_DIR
from app.models.db import Chat, Message, Sender, PipelineStatus, get_db

router = APIRouter(prefix="/api/chats", tags=["chats"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ChatSummary(BaseModel):
    """Chat summary for list view."""
    id: int
    name: str
    type: str
    message_count: int
    status: str
    created_at: str
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None
    sender_count: int = 0

    class Config:
        from_attributes = True


class SenderInfo(BaseModel):
    """Sender info for chat detail view."""
    id: int
    display_name: str
    message_count: int = 0


class PipelineInfo(BaseModel):
    """Pipeline status info."""
    current_step: int
    steps_complete: int
    steps_total: int
    error: Optional[str] = None


class TypeBreakdown(BaseModel):
    """Message type count."""
    type: str
    count: int


class ChatDetail(BaseModel):
    """Full chat detail view."""
    id: int
    name: str
    type: str
    message_count: int
    status: str
    created_at: str
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None
    senders: list[SenderInfo] = []
    pipeline: Optional[PipelineInfo] = None
    type_breakdown: list[TypeBreakdown] = []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ChatSummary])
async def list_chats(
    status: Optional[str] = Query(None, description="Filter by status: processing, ready, error"),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """List all uploaded chats with summary info."""
    query = db.query(Chat).filter(Chat.owner_id == user["sub"])

    if status:
        query = query.filter(Chat.status == status)
    
    chats = query.order_by(Chat.created_at.desc()).all()
    
    result = []
    for chat in chats:
        sender_count = db.query(func.count(Sender.id)).filter(Sender.chat_id == chat.id).scalar() or 0
        
        result.append(ChatSummary(
            id=chat.id,
            name=chat.name,
            type=chat.type,
            message_count=chat.message_count,
            status=chat.status,
            created_at=chat.created_at.isoformat() if chat.created_at else "",
            date_range_start=chat.date_range_start.isoformat() if chat.date_range_start else None,
            date_range_end=chat.date_range_end.isoformat() if chat.date_range_end else None,
            sender_count=sender_count,
        ))
    
    return result


@router.get("/{chat_id}", response_model=ChatDetail)
async def get_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get full chat details including senders, pipeline status, and type breakdown."""
    chat = require_owned_chat(db, chat_id, user)
    
    # Get senders with message counts
    senders = db.query(Sender).filter(Sender.chat_id == chat_id).all()
    sender_infos = []
    for sender in senders:
        msg_count = db.query(func.count(Message.id)).filter(
            Message.sender_id == sender.id
        ).scalar() or 0
        sender_infos.append(SenderInfo(
            id=sender.id,
            display_name=sender.display_name,
            message_count=msg_count,
        ))
    
    # Sort senders by message count desc
    sender_infos.sort(key=lambda s: s.message_count, reverse=True)
    
    # Get pipeline status
    pipeline = db.query(PipelineStatus).filter(PipelineStatus.chat_id == chat_id).first()
    pipeline_info = None
    if pipeline:
        pipeline_info = PipelineInfo(
            current_step=pipeline.current_step,
            steps_complete=pipeline.steps_complete,
            steps_total=pipeline.steps_total,
            error=pipeline.error,
        )
    
    # Get message type breakdown
    type_counts = db.query(
        Message.type, func.count(Message.id)
    ).filter(
        Message.chat_id == chat_id
    ).group_by(Message.type).all()
    
    type_breakdown = [
        TypeBreakdown(type=t, count=c) for t, c in type_counts
    ]
    type_breakdown.sort(key=lambda t: t.count, reverse=True)
    
    return ChatDetail(
        id=chat.id,
        name=chat.name,
        type=chat.type,
        message_count=chat.message_count,
        status=chat.status,
        created_at=chat.created_at.isoformat() if chat.created_at else "",
        date_range_start=chat.date_range_start.isoformat() if chat.date_range_start else None,
        date_range_end=chat.date_range_end.isoformat() if chat.date_range_end else None,
        senders=sender_infos,
        pipeline=pipeline_info,
        type_breakdown=type_breakdown,
    )


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Delete a chat and all related database/media data."""
    chat = require_owned_chat(db, chat_id, user)
    owner_id = chat.owner_id

    db.delete(chat)
    db.commit()

    # Drop media through the configured backend so Cloudinary uploads get
    # cleaned up in addition to any local-disk staging area.
    from app.services.storage import get_storage

    try:
        get_storage().delete_chat(owner_id=owner_id, chat_id=chat_id)
    except Exception as e:
        # Surfacing this as a 500 would leave the DB row deleted while the
        # caller thinks the request failed. Log and continue — orphaned
        # cloud assets are recoverable, an inconsistent UI is worse.
        import logging
        logging.getLogger(__name__).warning(
            f"[chats.delete] storage cleanup failed for chat {chat_id}: {e}"
        )

    return {
        "success": True,
        "chat_id": chat_id,
        "message": "Chat deleted successfully",
    }
