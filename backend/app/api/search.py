"""Search API routes — full-text, semantic, and filtered search.

GET /api/chats/{chat_id}/search  — search within a single chat
GET /api/search                  — global cross-chat search
"""

import logging
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.db import Chat, Link, Message, Sender, get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["search"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class SearchResultItem(BaseModel):
    """A single search result."""
    id: int
    chat_id: int
    chat_name: Optional[str] = None
    sender_id: Optional[int] = None
    sender_name: Optional[str] = None
    content: str
    timestamp: str
    type: str
    is_important: bool
    cluster_id: Optional[int] = None
    score: float = 0.0
    match_type: str = "keyword"  # keyword | semantic | combined
    context_before: Optional[str] = None
    context_after: Optional[str] = None


class SearchResponse(BaseModel):
    """Search response with results and metadata."""
    results: list[SearchResultItem]
    total: int
    query: str
    mode: str
    filters_applied: dict = {}


# ---------------------------------------------------------------------------
# Shorthand filter parser
# ---------------------------------------------------------------------------

def parse_shorthand_filters(raw_query: str) -> tuple[str, dict]:
    """Parse shorthand filters from query string.
    
    Supported shorthands:
        from:Name       → sender filter
        type:link       → type filter
        is:important    → importance filter
        domain:youtube  → domain filter
        before:2024-01  → end date filter
        after:2023-06   → start date filter
        cluster:5       → cluster ID filter
    
    Returns:
        (clean_query, filters_dict)
    """
    filters = {}
    clean_parts = []
    
    tokens = raw_query.split()
    
    for token in tokens:
        if ":" in token and not token.startswith("http"):
            key, _, value = token.partition(":")
            key = key.lower().strip()
            value = value.strip()
            
            if not value:
                clean_parts.append(token)
                continue
            
            if key == "from":
                filters["sender"] = value
            elif key == "type":
                filters["type"] = value
            elif key == "is" and value.lower() == "important":
                filters["is_important"] = True
            elif key == "domain":
                filters["domain"] = value
            elif key == "before":
                filters["end_date"] = value
            elif key == "after":
                filters["start_date"] = value
            elif key == "cluster":
                try:
                    filters["cluster_id"] = int(value)
                except ValueError:
                    clean_parts.append(token)
            else:
                clean_parts.append(token)
        else:
            clean_parts.append(token)
    
    clean_query = " ".join(clean_parts).strip()
    return clean_query, filters


# ---------------------------------------------------------------------------
# FTS5 keyword search
# ---------------------------------------------------------------------------

def _fts5_search(
    db: Session,
    query: str,
    chat_id: Optional[int] = None,
    limit: int = 50,
) -> list[int]:
    """Perform FTS5 keyword search, returning matching message IDs."""
    if not query or len(query.strip()) < 2:
        return []
    
    # Escape FTS5 special characters
    clean_query = re.sub(r'[^\w\s]', ' ', query).strip()
    if not clean_query:
        return []
    
    # Build FTS5 MATCH query with optional chat filter
    if chat_id:
        sql = """
        SELECT messages_fts.rowid
        FROM messages_fts
        JOIN messages ON messages.id = messages_fts.rowid
        WHERE messages_fts MATCH :query
        AND messages.chat_id = :chat_id
        ORDER BY rank
        LIMIT :limit
        """
        params = {"query": clean_query, "chat_id": chat_id, "limit": limit}
    else:
        sql = """
        SELECT messages_fts.rowid
        FROM messages_fts
        WHERE messages_fts MATCH :query
        ORDER BY rank
        LIMIT :limit
        """
        params = {"query": clean_query, "limit": limit}
    
    try:
        result = db.execute(text(sql), params)
        return [row[0] for row in result.fetchall()]
    except Exception as e:
        logger.warning(f"[Search] FTS5 query failed: {e}")
        return []


# ---------------------------------------------------------------------------
# Apply filters to message query
# ---------------------------------------------------------------------------

def _apply_filters(
    db: Session,
    message_ids: list[int],
    filters: dict,
    chat_id: Optional[int] = None,
) -> list[int]:
    """Apply structured filters to a list of message IDs."""
    if not message_ids:
        return []
    
    query = db.query(Message.id).filter(Message.id.in_(message_ids))
    
    if chat_id:
        query = query.filter(Message.chat_id == chat_id)
    
    if "sender" in filters:
        sender_name = filters["sender"]
        sender_ids = db.query(Sender.id).filter(
            Sender.display_name.ilike(f"%{sender_name}%")
        ).all()
        sender_id_list = [s[0] for s in sender_ids]
        if sender_id_list:
            query = query.filter(Message.sender_id.in_(sender_id_list))
        else:
            return []
    
    if "sender_id" in filters:
        query = query.filter(Message.sender_id == filters["sender_id"])
    
    if "type" in filters:
        query = query.filter(Message.type == filters["type"])
    
    if "is_important" in filters and filters["is_important"]:
        query = query.filter(Message.is_important == True)
    
    if "cluster_id" in filters:
        query = query.filter(Message.cluster_id == filters["cluster_id"])
    
    if "start_date" in filters:
        try:
            start = datetime.fromisoformat(filters["start_date"])
            query = query.filter(Message.timestamp >= start)
        except (ValueError, TypeError):
            pass
    
    if "end_date" in filters:
        try:
            end = datetime.fromisoformat(filters["end_date"])
            query = query.filter(Message.timestamp <= end)
        except (ValueError, TypeError):
            pass
    
    if "domain" in filters:
        domain = filters["domain"]
        link_msg_ids = db.query(Link.message_id).filter(
            Link.domain.ilike(f"%{domain}%")
        ).all()
        link_msg_id_list = [l[0] for l in link_msg_ids]
        if link_msg_id_list:
            query = query.filter(Message.id.in_(link_msg_id_list))
        else:
            return []
    
    result = query.all()
    return [r[0] for r in result]


# ---------------------------------------------------------------------------
# Build search results with context
# ---------------------------------------------------------------------------

def _build_results(
    db: Session,
    message_ids: list[int],
    scores: dict[int, float],
    match_type: str,
    include_context: bool = True,
) -> list[SearchResultItem]:
    """Build SearchResultItem list from message IDs."""
    if not message_ids:
        return []
    
    messages = db.query(Message).filter(
        Message.id.in_(message_ids)
    ).all()
    
    # Build a lookup for quick access
    msg_map = {msg.id: msg for msg in messages}
    
    results = []
    for msg_id in message_ids:
        msg = msg_map.get(msg_id)
        if not msg:
            continue
        
        # Get sender name
        sender_name = None
        if msg.sender_id:
            sender = db.query(Sender).filter(Sender.id == msg.sender_id).first()
            if sender:
                sender_name = sender.display_name
        
        # Get chat name
        chat = db.query(Chat).filter(Chat.id == msg.chat_id).first()
        chat_name = chat.name if chat else None
        
        # Get context messages (1 before, 1 after)
        context_before = None
        context_after = None
        if include_context:
            prev_msg = db.query(Message).filter(
                Message.chat_id == msg.chat_id,
                Message.timestamp < msg.timestamp,
                Message.type.notin_(["deleted", "unknown_media"]),
            ).order_by(Message.timestamp.desc()).first()
            
            next_msg = db.query(Message).filter(
                Message.chat_id == msg.chat_id,
                Message.timestamp > msg.timestamp,
                Message.type.notin_(["deleted", "unknown_media"]),
            ).order_by(Message.timestamp.asc()).first()
            
            if prev_msg:
                context_before = prev_msg.content[:200]
            if next_msg:
                context_after = next_msg.content[:200]
        
        results.append(SearchResultItem(
            id=msg.id,
            chat_id=msg.chat_id,
            chat_name=chat_name,
            sender_id=msg.sender_id,
            sender_name=sender_name,
            content=msg.content,
            timestamp=msg.timestamp.isoformat(),
            type=msg.type,
            is_important=msg.is_important,
            cluster_id=msg.cluster_id,
            score=scores.get(msg_id, 0.0),
            match_type=match_type,
            context_before=context_before,
            context_after=context_after,
        ))
    
    # Sort by score descending
    results.sort(key=lambda r: r.score, reverse=True)
    return results


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/api/chats/{chat_id}/search", response_model=SearchResponse)
async def search_chat(
    chat_id: int,
    q: str = Query("", description="Search query with optional shorthand filters"),
    mode: str = Query("combined", description="Search mode: keyword | semantic | combined"),
    sender: Optional[str] = Query(None),
    sender_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None, alias="type"),
    is_important: Optional[bool] = Query(None),
    cluster_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Search within a single chat."""
    # Parse shorthand filters from query
    clean_query, shorthand_filters = parse_shorthand_filters(q)
    
    # Merge explicit params with shorthand filters (explicit params take priority)
    filters = {**shorthand_filters}
    if sender:
        filters["sender"] = sender
    if sender_id:
        filters["sender_id"] = sender_id
    if type:
        filters["type"] = type
    if is_important is not None:
        filters["is_important"] = is_important
    if cluster_id:
        filters["cluster_id"] = cluster_id
    if start_date:
        filters["start_date"] = start_date
    if end_date:
        filters["end_date"] = end_date
    if domain:
        filters["domain"] = domain
    
    all_msg_ids = []
    scores: dict[int, float] = {}
    match_type = mode
    
    if not clean_query and not filters:
        return SearchResponse(results=[], total=0, query=q, mode=mode, filters_applied=filters)
    
    # If no query text but filters exist, do a filter-only search
    if not clean_query and filters:
        all_ids = db.query(Message.id).filter(
            Message.chat_id == chat_id,
            Message.type.notin_(["deleted", "unknown_media"]),
        ).all()
        all_msg_ids = [r[0] for r in all_ids]
        scores = {mid: 1.0 for mid in all_msg_ids}
        match_type = "filter"
    elif mode == "keyword" or mode == "combined":
        # FTS5 keyword search
        keyword_ids = _fts5_search(db, clean_query, chat_id=chat_id, limit=limit * 2)
        for i, mid in enumerate(keyword_ids):
            scores[mid] = 1.0 - (i * 0.01)  # Rank-based score
        all_msg_ids = keyword_ids
        match_type = "keyword"
        
        if mode == "combined" and clean_query:
            # Boost with semantic scores
            try:
                from app.services.semantic_search import semantic_search
                semantic_results = semantic_search(db, clean_query, chat_id=chat_id, top_k=limit)
                
                for mid, sim_score in semantic_results:
                    if mid in scores:
                        scores[mid] = scores[mid] * 0.6 + sim_score * 0.4  # Blend
                    else:
                        scores[mid] = sim_score * 0.4
                        all_msg_ids.append(mid)
                
                match_type = "combined"
            except Exception as e:
                logger.warning(f"[Search] Semantic search failed, using keyword only: {e}")
    
    elif mode == "semantic":
        try:
            from app.services.semantic_search import semantic_search
            semantic_results = semantic_search(db, clean_query, chat_id=chat_id, top_k=limit)
            all_msg_ids = [mid for mid, _ in semantic_results]
            scores = {mid: score for mid, score in semantic_results}
            match_type = "semantic"
        except Exception as e:
            logger.warning(f"[Search] Semantic search failed: {e}")
            return SearchResponse(results=[], total=0, query=q, mode=mode, filters_applied=filters)
    
    # Apply filters
    if filters and all_msg_ids:
        filtered_ids = _apply_filters(db, all_msg_ids, filters, chat_id=chat_id)
        all_msg_ids = filtered_ids
    
    # Deduplicate preserving order
    seen = set()
    unique_ids = []
    for mid in all_msg_ids:
        if mid not in seen:
            seen.add(mid)
            unique_ids.append(mid)
    
    # Limit
    unique_ids = unique_ids[:limit]
    
    # Build results
    results = _build_results(db, unique_ids, scores, match_type)
    
    return SearchResponse(
        results=results,
        total=len(results),
        query=q,
        mode=mode,
        filters_applied=filters,
    )


@router.get("/api/search", response_model=SearchResponse)
async def search_global(
    q: str = Query("", description="Search query"),
    mode: str = Query("combined"),
    sender: Optional[str] = Query(None),
    type: Optional[str] = Query(None, alias="type"),
    is_important: Optional[bool] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Search across all uploaded chats."""
    clean_query, shorthand_filters = parse_shorthand_filters(q)
    
    filters = {**shorthand_filters}
    if sender:
        filters["sender"] = sender
    if type:
        filters["type"] = type
    if is_important is not None:
        filters["is_important"] = is_important
    if start_date:
        filters["start_date"] = start_date
    if end_date:
        filters["end_date"] = end_date
    if domain:
        filters["domain"] = domain
    
    all_msg_ids = []
    scores: dict[int, float] = {}
    match_type = mode
    
    if not clean_query and not filters:
        return SearchResponse(results=[], total=0, query=q, mode=mode, filters_applied=filters)
    
    if not clean_query and filters:
        all_ids = db.query(Message.id).filter(
            Message.type.notin_(["deleted", "unknown_media"]),
        ).all()
        all_msg_ids = [r[0] for r in all_ids]
        scores = {mid: 1.0 for mid in all_msg_ids}
        match_type = "filter"
    elif mode in ("keyword", "combined"):
        keyword_ids = _fts5_search(db, clean_query, chat_id=None, limit=limit * 2)
        for i, mid in enumerate(keyword_ids):
            scores[mid] = 1.0 - (i * 0.01)
        all_msg_ids = keyword_ids
        match_type = "keyword"
        
        if mode == "combined" and clean_query:
            try:
                from app.services.semantic_search import semantic_search
                semantic_results = semantic_search(db, clean_query, chat_id=None, top_k=limit)
                for mid, sim_score in semantic_results:
                    if mid in scores:
                        scores[mid] = scores[mid] * 0.6 + sim_score * 0.4
                    else:
                        scores[mid] = sim_score * 0.4
                        all_msg_ids.append(mid)
                match_type = "combined"
            except Exception as e:
                logger.warning(f"[Search] Semantic search failed: {e}")
    elif mode == "semantic":
        try:
            from app.services.semantic_search import semantic_search
            semantic_results = semantic_search(db, clean_query, chat_id=None, top_k=limit)
            all_msg_ids = [mid for mid, _ in semantic_results]
            scores = {mid: score for mid, score in semantic_results}
            match_type = "semantic"
        except Exception as e:
            logger.warning(f"[Search] Semantic search failed: {e}")
            return SearchResponse(results=[], total=0, query=q, mode=mode, filters_applied=filters)
    
    if filters and all_msg_ids:
        filtered_ids = _apply_filters(db, all_msg_ids, filters)
        all_msg_ids = filtered_ids
    
    seen = set()
    unique_ids = []
    for mid in all_msg_ids:
        if mid not in seen:
            seen.add(mid)
            unique_ids.append(mid)
    
    unique_ids = unique_ids[:limit]
    results = _build_results(db, unique_ids, scores, match_type)
    
    return SearchResponse(
        results=results,
        total=len(results),
        query=q,
        mode=mode,
        filters_applied=filters,
    )