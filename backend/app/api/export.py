"""Export API routes — export chat data as Markdown, CSV, or JSON.

GET /api/chats/{chat_id}/export — export messages in various formats
"""

import csv
import io
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.models.db import Message, Sender, get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["export"])


def _get_messages(
    db: Session,
    chat_id: int,
    msg_type: Optional[str] = None,
    sender_id: Optional[int] = None,
    is_important: Optional[bool] = None,
    cluster_id: Optional[int] = None,
):
    """Get filtered messages for export."""
    query = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.type.notin_(["deleted", "unknown_media"]),
    )
    if msg_type:
        query = query.filter(Message.type == msg_type)
    if sender_id:
        query = query.filter(Message.sender_id == sender_id)
    if is_important:
        query = query.filter(Message.is_important == True)
    if cluster_id:
        query = query.filter(Message.cluster_id == cluster_id)
    return query.order_by(Message.timestamp.asc()).all()


def _get_sender_name(db: Session, sender_id: Optional[int]) -> str:
    if not sender_id:
        return "Unknown"
    sender = db.query(Sender).filter(Sender.id == sender_id).first()
    return sender.display_name if sender else "Unknown"


@router.get("/api/chats/{chat_id}/export")
async def export_chat(
    chat_id: int,
    format: str = Query("md", description="Export format: md | csv | json"),
    type: Optional[str] = Query(None),
    sender_id: Optional[int] = Query(None),
    is_important: Optional[bool] = Query(None),
    cluster_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Export chat messages in the specified format."""
    messages = _get_messages(db, chat_id, type, sender_id, is_important, cluster_id)
    
    if format == "json":
        data = []
        for msg in messages:
            data.append({
                "id": msg.id,
                "sender": _get_sender_name(db, msg.sender_id),
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat(),
                "type": msg.type,
                "is_important": msg.is_important,
            })
        content = json.dumps(data, indent=2, ensure_ascii=False)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=chat_{chat_id}_export.json"},
        )
    
    elif format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Timestamp", "Sender", "Type", "Important", "Content"])
        for msg in messages:
            writer.writerow([
                msg.timestamp.isoformat(),
                _get_sender_name(db, msg.sender_id),
                msg.type,
                "Yes" if msg.is_important else "No",
                msg.content,
            ])
        content = output.getvalue()
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=chat_{chat_id}_export.csv"},
        )
    
    else:  # markdown
        lines = [f"# Chat Export (ID: {chat_id})\n"]
        lines.append(f"Exported: {datetime.now().isoformat()}\n")
        lines.append(f"Total messages: {len(messages)}\n\n---\n")
        
        for msg in messages:
            sender = _get_sender_name(db, msg.sender_id)
            ts = msg.timestamp.strftime("%Y-%m-%d %H:%M")
            important = " ⭐" if msg.is_important else ""
            lines.append(f"**[{ts}] {sender}**{important}\n")
            lines.append(f"{msg.content}\n\n")
        
        content = "\n".join(lines)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=chat_{chat_id}_export.md"},
        )