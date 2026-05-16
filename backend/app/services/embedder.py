"""Sentence embedding service using sentence-transformers.

Generates embeddings for all text messages in a chat using the
all-MiniLM-L6-v2 model (384-dimensional vectors).
"""

import json
import logging
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session

from app.core.config import EMBEDDING_BATCH_SIZE, EMBEDDING_MODEL
from app.models.db import Message

logger = logging.getLogger(__name__)

# Singleton model instance (loaded once, cached)
_model: Optional[SentenceTransformer] = None


def _get_model() -> SentenceTransformer:
    """Load the sentence-transformer model (singleton)."""
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")
        _model = SentenceTransformer(EMBEDDING_MODEL)
        logger.info(f"Model loaded: {EMBEDDING_MODEL}")
    return _model


def embed_messages(db: Session, chat_id: int) -> int:
    """Generate and store embeddings for all text messages in a chat.
    
    Args:
        db: Database session
        chat_id: Chat ID to process
        
    Returns:
        Number of messages embedded
    """
    logger.info(f"[Embedder] Chat {chat_id}: Starting embedding generation")
    
    # Load model
    model = _get_model()
    
    # Query all messages that need embeddings (skip deleted, unknown_media, and already embedded)
    messages = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.type.notin_(["deleted", "unknown_media"]),
        Message.embedding.is_(None),
    ).all()
    
    if not messages:
        logger.info(f"[Embedder] Chat {chat_id}: No messages to embed")
        return 0
    
    logger.info(f"[Embedder] Chat {chat_id}: Found {len(messages)} messages to embed")
    
    # Filter out messages with empty/very short content
    valid_messages = []
    for msg in messages:
        content = (msg.content or "").strip()
        if len(content) >= 3:  # Minimum 3 characters
            valid_messages.append(msg)
    
    if not valid_messages:
        logger.info(f"[Embedder] Chat {chat_id}: No valid messages (all too short)")
        return 0
    
    logger.info(f"[Embedder] Chat {chat_id}: {len(valid_messages)} valid messages")
    
    # Batch encode
    embedded_count = 0
    batch_size = EMBEDDING_BATCH_SIZE
    
    for i in range(0, len(valid_messages), batch_size):
        batch = valid_messages[i:i + batch_size]
        texts = [msg.content.strip() for msg in batch]
        
        # Generate embeddings
        embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        
        # Store as JSON arrays
        for msg, embedding in zip(batch, embeddings):
            msg.embedding = json.dumps(embedding.tolist())
            embedded_count += 1
        
        db.commit()
        
        if (i // batch_size + 1) % 10 == 0:
            logger.info(f"[Embedder] Chat {chat_id}: Embedded {embedded_count}/{len(valid_messages)} messages")
    
    logger.info(f"[Embedder] Chat {chat_id}: ✅ Embedded {embedded_count} messages")
    return embedded_count


def get_embedding_matrix(db: Session, chat_id: int) -> tuple[np.ndarray, list[int]]:
    """Load all embeddings for a chat as a numpy matrix.
    
    Args:
        db: Database session
        chat_id: Chat ID
        
    Returns:
        Tuple of (embedding_matrix, message_ids)
        embedding_matrix: shape (n_messages, 384)
        message_ids: list of message IDs corresponding to rows
    """
    messages = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.embedding.isnot(None),
    ).all()
    
    if not messages:
        return np.array([]), []
    
    embeddings = []
    message_ids = []
    
    for msg in messages:
        try:
            embedding = np.array(json.loads(msg.embedding))
            embeddings.append(embedding)
            message_ids.append(msg.id)
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"[Embedder] Failed to parse embedding for message {msg.id}: {e}")
            continue
    
    if not embeddings:
        return np.array([]), []
    
    matrix = np.vstack(embeddings)
    return matrix, message_ids