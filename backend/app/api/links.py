"""Links API — all links with OG data for a chat.

GET  /api/chats/{id}/links     — All links with OG metadata, filterable
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_owned_chat
from app.models.db import Chat, Link, Message, Sender, get_db

router = APIRouter(prefix="/api/chats", tags=["links"])


class LinkSenderInfo(BaseModel):
    id: int
    display_name: str


class LinkResponse(BaseModel):
    id: int
    message_id: int
    url: str
    domain: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image_url: Optional[str] = None
    link_type: Optional[str] = None
    sender: Optional[LinkSenderInfo] = None
    timestamp: Optional[str] = None
    message_content: Optional[str] = None

    class Config:
        from_attributes = True


class PaginatedLinks(BaseModel):
    links: list[LinkResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class DomainCount(BaseModel):
    domain: str
    count: int


@router.get("/{chat_id}/links", response_model=PaginatedLinks)
async def get_links(
    chat_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    link_type: Optional[str] = Query(None, description="Filter by link type (youtube, drive, etc.)"),
    sender_id: Optional[int] = Query(None, description="Filter by sender ID"),
    start_date: Optional[str] = Query(None, description="Filter from date (ISO)"),
    end_date: Optional[str] = Query(None, description="Filter to date (ISO)"),
    sort: str = Query("desc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get all links for a chat with OG metadata."""
    chat = require_owned_chat(db, chat_id, user)

    query = (
        db.query(Link)
        .join(Message, Link.message_id == Message.id)
        .filter(Message.chat_id == chat_id)
    )

    if domain:
        query = query.filter(Link.domain.ilike(f"%{domain}%"))
    if link_type:
        query = query.filter(Link.link_type == link_type)
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
    links = query.offset(offset).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size)

    result = []
    for link in links:
        msg = db.query(Message).filter(Message.id == link.message_id).first()
        sender_info = None
        ts = None
        content = None
        if msg:
            ts = msg.timestamp.isoformat() if msg.timestamp else None
            content = msg.content
            if msg.sender_id:
                sender = db.query(Sender).filter(Sender.id == msg.sender_id).first()
                if sender:
                    sender_info = LinkSenderInfo(id=sender.id, display_name=sender.display_name)

        result.append(LinkResponse(
            id=link.id,
            message_id=link.message_id,
            url=link.url,
            domain=link.domain,
            og_title=link.og_title,
            og_description=link.og_description,
            og_image_url=link.og_image_url,
            link_type=link.link_type,
            sender=sender_info,
            timestamp=ts,
            message_content=content,
        ))

    return PaginatedLinks(
        links=result,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


@router.get("/{chat_id}/links/domains", response_model=list[DomainCount])
async def get_link_domains(
    chat_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get domain breakdown for links in a chat."""
    chat = require_owned_chat(db, chat_id, user)

    domain_counts = (
        db.query(Link.domain, func.count(Link.id))
        .join(Message, Link.message_id == Message.id)
        .filter(Message.chat_id == chat_id)
        .filter(Link.domain.isnot(None))
        .group_by(Link.domain)
        .order_by(func.count(Link.id).desc())
        .all()
    )

    return [DomainCount(domain=d, count=c) for d, c in domain_counts if d]
