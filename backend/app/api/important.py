"""Important messages API — flagged messages for a chat.

GET  /api/chats/{id}/important — All important-flagged messages
POST /api/chats/{id}/messages/{msg_id}/flag — Manually flag/unflag
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_owned_chat
from app.models.db import Chat, ImportantFlag, Message, Sender, get_db

router = APIRouter(prefix="/api/chats", tags=["important"])


class ImportantSender(BaseModel):
    id: int
    display_name: str


class FlagInfo(BaseModel):
    trigger_type: str
    trigger_value: Optional[str] = None


class ImportantMessageResponse(BaseModel):
    id: int
    chat_id: int
    sender: Optional[ImportantSender] = None
    content: str
    timestamp: str
    type: str
    importance_reason: Optional[str] = None
    flags: list[FlagInfo] = []

    class Config:
        from_attributes = True


class PaginatedImportant(BaseModel):
    messages: list[ImportantMessageResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


@router.get("/{chat_id}/important", response_model=PaginatedImportant)
async def get_important_messages(
    chat_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    trigger_type: Optional[str] = Query(None, description="Filter by trigger type: keyword, emoji, manual"),
    sender_id: Optional[int] = Query(None),
    sort: str = Query("desc"),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get all important-flagged messages for a chat."""
    chat = require_owned_chat(db, chat_id, user)

    query = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.is_important == True,
    )

    if sender_id:
        query = query.filter(Message.sender_id == sender_id)

    if trigger_type:
        msg_ids = (
            db.query(ImportantFlag.message_id)
            .filter(ImportantFlag.trigger_type == trigger_type)
            .subquery()
        )
        query = query.filter(Message.id.in_(msg_ids))

    total = query.count()

    if sort == "asc":
        query = query.order_by(Message.timestamp.asc())
    else:
        query = query.order_by(Message.timestamp.desc())

    offset = (page - 1) * page_size
    messages = query.offset(offset).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size)

    result = []
    for msg in messages:
        sender_info = None
        if msg.sender_id:
            sender = db.query(Sender).filter(Sender.id == msg.sender_id).first()
            if sender:
                sender_info = ImportantSender(id=sender.id, display_name=sender.display_name)

        flags = db.query(ImportantFlag).filter(ImportantFlag.message_id == msg.id).all()
        flag_infos = [FlagInfo(trigger_type=f.trigger_type, trigger_value=f.trigger_value) for f in flags]

        result.append(ImportantMessageResponse(
            id=msg.id,
            chat_id=msg.chat_id,
            sender=sender_info,
            content=msg.content,
            timestamp=msg.timestamp.isoformat() if msg.timestamp else "",
            type=msg.type,
            importance_reason=msg.importance_reason,
            flags=flag_infos,
        ))

    return PaginatedImportant(
        messages=result,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


@router.post("/{chat_id}/messages/{message_id}/flag")
async def toggle_importance(
    chat_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Toggle importance flag on a message (manual flag/unflag)."""
    require_owned_chat(db, chat_id, user)
    msg = db.query(Message).filter(
        Message.id == message_id,
        Message.chat_id == chat_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg.is_important:
        # Unflag: remove manual flags (keep auto-detected ones)
        manual_flags = db.query(ImportantFlag).filter(
            ImportantFlag.message_id == message_id,
            ImportantFlag.trigger_type == "manual",
        ).all()

        if manual_flags:
            for flag in manual_flags:
                db.delete(flag)
        
        # Check if there are still auto-detected flags
        remaining = db.query(ImportantFlag).filter(ImportantFlag.message_id == message_id).count()
        if remaining == 0:
            msg.is_important = False
            msg.importance_reason = None
    else:
        # Flag as manually important
        msg.is_important = True
        msg.importance_reason = "manual"
        flag = ImportantFlag(
            message_id=message_id,
            trigger_type="manual",
            trigger_value="manually flagged",
        )
        db.add(flag)

    db.commit()

    return {
        "message_id": message_id,
        "is_important": msg.is_important,
        "action": "unflagged" if not msg.is_important else "flagged",
    }
