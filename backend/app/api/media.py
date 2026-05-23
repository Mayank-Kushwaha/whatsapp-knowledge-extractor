"""Media items API — images, videos, documents, audio for a chat.

GET  /api/chats/{id}/media     — Paginated media items, filterable by type
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_owned_chat
from app.models.db import Chat, MediaItem, Message, Sender, get_db

router = APIRouter(prefix="/api/chats", tags=["media"])


class MediaSenderInfo(BaseModel):
    id: int
    display_name: str


class MediaItemResponse(BaseModel):
    id: int
    message_id: int
    chat_id: int
    type: str
    original_filename: Optional[str] = None
    local_path: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    extracted_text: Optional[str] = None
    sender: Optional[MediaSenderInfo] = None
    timestamp: Optional[str] = None
    message_content: Optional[str] = None

    class Config:
        from_attributes = True


class PaginatedMedia(BaseModel):
    items: list[MediaItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


@router.get("/{chat_id}/media", response_model=PaginatedMedia)
async def get_media_items(
    chat_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    type: Optional[str] = Query(None, description="Filter by media type: image, video, audio, pdf, document"),
    sender_id: Optional[int] = Query(None, description="Filter by sender ID"),
    start_date: Optional[str] = Query(None, description="Filter from date (ISO)"),
    end_date: Optional[str] = Query(None, description="Filter to date (ISO)"),
    sort: str = Query("desc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get paginated media items for a chat."""
    chat = require_owned_chat(db, chat_id, user)

    query = (
        db.query(MediaItem)
        .join(Message, MediaItem.message_id == Message.id)
        .filter(MediaItem.chat_id == chat_id)
    )

    if type:
        query = query.filter(MediaItem.type == type)
    if sender_id:
        query = query.filter(Message.sender_id == sender_id)
    if start_date:
        try:
            dt = datetime.fromisoformat(start_date)
            query = query.filter(Message.timestamp >= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date")
    if end_date:
        try:
            dt = datetime.fromisoformat(end_date)
            query = query.filter(Message.timestamp <= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date")

    total = query.count()

    if sort == "asc":
        query = query.order_by(Message.timestamp.asc())
    else:
        query = query.order_by(Message.timestamp.desc())

    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size)

    result = []
    for item in items:
        msg = db.query(Message).filter(Message.id == item.message_id).first()
        sender_info = None
        ts = None
        content = None
        if msg:
            ts = msg.timestamp.isoformat() if msg.timestamp else None
            content = msg.content
            if msg.sender_id:
                sender = db.query(Sender).filter(Sender.id == msg.sender_id).first()
                if sender:
                    sender_info = MediaSenderInfo(id=sender.id, display_name=sender.display_name)

        result.append(MediaItemResponse(
            id=item.id,
            message_id=item.message_id,
            chat_id=item.chat_id,
            type=item.type,
            original_filename=item.original_filename,
            local_path=item.local_path,
            mime_type=item.mime_type,
            file_size_bytes=item.file_size_bytes,
            extracted_text=item.extracted_text,
            sender=sender_info,
            timestamp=ts,
            message_content=content,
        ))

    return PaginatedMedia(
        items=result,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )
