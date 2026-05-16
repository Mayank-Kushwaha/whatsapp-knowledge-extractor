"""Semantic search using cosine similarity over sentence embeddings.

Encodes a query with the same sentence-transformer model used for messages,
then computes cosine similarity against all stored embeddings.
"""

import json
import logging
from typing import Optional

import numpy as np
from sqlalchemy.orm import Session

from app.models.db import Message
from app.services.embedder import _get_model, get_embedding_matrix

logger = logging.getLogger(__name__)


def semantic_search(
    db: Session,
    query: str,
    chat_id: Optional[int] = None,
    top_k: int = 30,
) -> list[tuple[int, float]]:
    """Search messages by semantic similarity.
    
    Args:
        db: Database session
        query: Search query text
        chat_id: Optional chat ID to restrict search (None = all chats)
        top_k: Maximum number of results to return
        
    Returns:
        List of (message_id, similarity_score) tuples, sorted by score descending
    """
    if not query or len(query.strip()) < 2:
        return []
    
    # Load the model and encode the query
    model = _get_model()
    query_embedding = model.encode([query.strip()], convert_to_numpy=True)[0]
    
    # Load embeddings
    if chat_id:
        embedding_matrix, message_ids = get_embedding_matrix(db, chat_id)
    else:
        # Cross-chat search: load all embeddings
        messages = db.query(Message).filter(
            Message.embedding.isnot(None),
        ).all()
        
        if not messages:
            return []
        
        embeddings = []
        message_ids = []
        for msg in messages:
            try:
                embedding = np.array(json.loads(msg.embedding))
                embeddings.append(embedding)
                message_ids.append(msg.id)
            except (json.JSONDecodeError, ValueError):
                continue
        
        if not embeddings:
            return []
        
        embedding_matrix = np.vstack(embeddings)
    
    if len(message_ids) == 0:
        return []
    
    # Compute cosine similarity
    # Normalize vectors for cosine similarity
    query_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-10)
    matrix_norms = np.linalg.norm(embedding_matrix, axis=1, keepdims=True) + 1e-10
    normalized_matrix = embedding_matrix / matrix_norms
    
    similarities = normalized_matrix @ query_norm
    
    # Get top-K indices
    top_indices = np.argsort(similarities)[::-1][:top_k]
    
    results = []
    for idx in top_indices:
        score = float(similarities[idx])
        if score > 0.1:  # Minimum relevance threshold
            results.append((message_ids[idx], score))
    
    return results