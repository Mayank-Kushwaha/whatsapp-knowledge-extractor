"""Cluster API routes.

GET  /api/chats/{id}/clusters                      — List all clusters
GET  /api/chats/{id}/clusters/{cluster_id}/messages — Messages in cluster
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.db import Cluster, Message, Sender, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chats", tags=["clusters"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ClusterItem(BaseModel):
    """Cluster summary."""
    id: int
    chat_id: int
    label: Optional[str] = None
    summary: Optional[str] = None
    message_count: int
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None
    
    class Config:
        from_attributes = True


class ClusterMessage(BaseModel):
    """Message within a cluster."""
    id: int
    sender_id: Optional[int] = None
    sender_name: Optional[str] = None
    content: str
    timestamp: str
    type: str
    is_important: bool


class PaginatedClusterMessages(BaseModel):
    """Paginated cluster messages."""
    cluster: ClusterItem
    messages: list[ClusterMessage]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{chat_id}/clusters", response_model=list[ClusterItem])
async def get_chat_clusters(
    chat_id: int,
    db: Session = Depends(get_db),
):
    """Get all clusters for a chat."""
    clusters = db.query(Cluster).filter(Cluster.chat_id == chat_id).all()
    
    result = []
    for cluster in clusters:
        # Get date range for this cluster
        date_range = db.query(
            func.min(Message.timestamp).label("start"),
            func.max(Message.timestamp).label("end"),
        ).filter(
            Message.cluster_id == cluster.id
        ).first()
        
        result.append(ClusterItem(
            id=cluster.id,
            chat_id=cluster.chat_id,
            label=cluster.label,
            summary=cluster.summary,
            message_count=cluster.message_count,
            date_range_start=date_range.start.isoformat() if date_range.start else None,
            date_range_end=date_range.end.isoformat() if date_range.end else None,
        ))
    
    # Sort by message count descending
    result.sort(key=lambda c: c.message_count, reverse=True)
    
    return result


@router.get("/{chat_id}/clusters/{cluster_id}/messages", response_model=PaginatedClusterMessages)
async def get_cluster_messages(
    chat_id: int,
    cluster_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get paginated messages in a cluster."""
    # Verify cluster exists and belongs to this chat
    cluster = db.query(Cluster).filter(
        Cluster.id == cluster_id,
        Cluster.chat_id == chat_id,
    ).first()
    
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    
    # Get total count
    total = db.query(func.count(Message.id)).filter(
        Message.cluster_id == cluster_id
    ).scalar() or 0
    
    # Calculate pagination
    total_pages = (total + page_size - 1) // page_size
    offset = (page - 1) * page_size
    
    # Get messages
    messages = db.query(Message).filter(
        Message.cluster_id == cluster_id
    ).order_by(
        Message.timestamp.asc()
    ).offset(offset).limit(page_size).all()
    
    # Build response
    message_items = []
    for msg in messages:
        sender_name = None
        if msg.sender_id:
            sender = db.query(Sender).filter(Sender.id == msg.sender_id).first()
            if sender:
                sender_name = sender.display_name
        
        message_items.append(ClusterMessage(
            id=msg.id,
            sender_id=msg.sender_id,
            sender_name=sender_name,
            content=msg.content,
            timestamp=msg.timestamp.isoformat(),
            type=msg.type,
            is_important=msg.is_important,
        ))
    
    # Get cluster date range
    date_range = db.query(
        func.min(Message.timestamp).label("start"),
        func.max(Message.timestamp).label("end"),
    ).filter(
        Message.cluster_id == cluster.id
    ).first()
    
    cluster_item = ClusterItem(
        id=cluster.id,
        chat_id=cluster.chat_id,
        label=cluster.label,
        summary=cluster.summary,
        message_count=cluster.message_count,
        date_range_start=date_range.start.isoformat() if date_range.start else None,
        date_range_end=date_range.end.isoformat() if date_range.end else None,
    )
    
    return PaginatedClusterMessages(
        cluster=cluster_item,
        messages=message_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )