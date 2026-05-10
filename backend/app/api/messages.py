"""Message API routes — paginated message retrieval.

GET  /api/chats/{id}/messages — Paginated messages with optional filters
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.db import Chat, Message, Sender, get_db

router = APIRouter(prefix="/api/chats", tags=["messages"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class MessageSenderInfo(BaseModel):
    """Sender info embedded in message response."""
    id: int
    display_name: str


class MessageResponse(BaseModel):
    """Individual message in paginated response."""
    id: int
    chat_id: int
    sender: Optional[MessageSenderInfo] = None
    content: str
    timestamp: str
    type: str
    is_important: bool
    cluster_id: Optional[int] = None
    raw_line: Optional[str] = None

    class Config:
        from_attributes = True


class PaginatedMessages(BaseModel):
    """Paginated response for messages."""
    messages: list[MessageResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{chat_id}/messages", response_model=PaginatedMessages)
async def get_messages(
    chat_id: int,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=200, description="Messages per page"),
    type: Optional[str] = Query(None, description="Filter by message type"),
    sender_id: Optional[int] = Query(None, description="Filter by sender ID"),
    sender_name: Optional[str] = Query(None, description="Filter by sender name"),
    is_important: Optional[bool] = Query(None, description="Filter important messages"),
    start_date: Optional[str] = Query(None, description="Filter from date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Filter to date (ISO format)"),
    sort: str = Query("asc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db),
):
    """Get paginated messages for a chat with optional filters.
    
    Supports filtering by:
      - type: text, link, image, video, pdf, etc.
      - sender_id or sender_name
      - is_important: true/false
      - start_date / end_date: ISO date strings
    """
    # Verify chat exists
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Build query
    query = db.query(Message).filter(Message.chat_id == chat_id)
    
    # Apply filters
    if type:
        query = query.filter(Message.type == type)
    
    if sender_id:
        query = query.filter(Message.sender_id == sender_id)
    
    if sender_name:
        # Look up sender by name
        sender = db.query(Sender).filter(
            Sender.chat_id == chat_id,
            Sender.display_name == sender_name,
        ).first()
        if sender:
            query = query.filter(Message.sender_id == sender.id)
        else:
            # No matching sender — return empty
            return PaginatedMessages(
                messages=[], total=0, page=page, page_size=page_size,
                total_pages=0, has_next=False, has_prev=False,
            )
    
    if is_important is not None:
        query = query.filter(Message.is_important == is_important)
    
    if start_date:
        try:
            dt = datetime.fromisoformat(start_date)
            query = query.filter(Message.timestamp >= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use ISO format.")
    
    if end_date:
        try:
            dt = datetime.fromisoformat(end_date)
            query = query.filter(Message.timestamp <= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use ISO format.")
    
    # Count total before pagination
    total = query.count()
    
    # Sort
    if sort == "desc":
        query = query.order_by(Message.timestamp.desc())
    else:
        query = query.order_by(Message.timestamp.asc())
    
    # Paginate
    offset = (page - 1) * page_size
    messages = query.offset(offset).limit(page_size).all()
    
    total_pages = max(1, (total + page_size - 1) // page_size)
    
    # Build response
    result_messages = []
    for msg in messages:
        sender_info = None
        if msg.sender_id:
            sender = db.query(Sender).filter(Sender.id == msg.sender_id).first()
            if sender:
                sender_info = MessageSenderInfo(
                    id=sender.id,
                    display_name=sender.display_name,
                )
        
        result_messages.append(MessageResponse(
            id=msg.id,
            chat_id=msg.chat_id,
            sender=sender_info,
            content=msg.content,
            timestamp=msg.timestamp.isoformat() if msg.timestamp else "",
            type=msg.type,
            is_important=msg.is_important,
            cluster_id=msg.cluster_id,
            raw_line=msg.raw_line,
        ))
    
    return PaginatedMessages(
        messages=result_messages,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )
