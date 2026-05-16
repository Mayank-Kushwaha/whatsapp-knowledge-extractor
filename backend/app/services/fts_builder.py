"""FTS5 full-text search index builder.

Creates and populates the messages_fts virtual table for fast keyword search.
"""

import logging
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.db import Message

logger = logging.getLogger(__name__)


def build_fts_index(db: Session, chat_id: int) -> int:
    """Build FTS5 index for all messages in a chat.
    
    Args:
        db: Database session
        chat_id: Chat ID to index
        
    Returns:
        Number of messages indexed
    """
    logger.info(f"[FTS] Chat {chat_id}: Building FTS5 index")
    
    # Create FTS5 virtual table if it doesn't exist
    create_fts_sql = """
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
    USING fts5(
        content,
        content_rowid='id',
        tokenize='porter unicode61'
    );
    """
    
    try:
        db.execute(text(create_fts_sql))
        db.commit()
        logger.info(f"[FTS] FTS5 table created/verified")
    except Exception as e:
        logger.error(f"[FTS] Failed to create FTS5 table: {e}")
        raise
    
    # Delete existing entries for this chat (for re-indexing)
    delete_sql = """
    DELETE FROM messages_fts
    WHERE rowid IN (
        SELECT id FROM messages WHERE chat_id = :chat_id
    );
    """
    
    try:
        db.execute(text(delete_sql), {"chat_id": chat_id})
        db.commit()
        logger.info(f"[FTS] Chat {chat_id}: Cleared existing FTS entries")
    except Exception as e:
        logger.warning(f"[FTS] Chat {chat_id}: Failed to clear existing entries: {e}")
    
    # Get all messages for this chat
    messages = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.type.notin_(["deleted", "unknown_media"]),
    ).all()
    
    if not messages:
        logger.info(f"[FTS] Chat {chat_id}: No messages to index")
        return 0
    
    logger.info(f"[FTS] Chat {chat_id}: Indexing {len(messages)} messages")
    
    # Bulk insert into FTS5
    # We need to insert with explicit rowid matching message.id
    insert_sql = """
    INSERT INTO messages_fts(rowid, content)
    VALUES (:rowid, :content);
    """
    
    indexed_count = 0
    batch_size = 500
    
    for i in range(0, len(messages), batch_size):
        batch = messages[i:i + batch_size]
        
        for msg in batch:
            content = (msg.content or "").strip()
            if len(content) >= 3:  # Only index messages with meaningful content
                try:
                    db.execute(text(insert_sql), {"rowid": msg.id, "content": content})
                    indexed_count += 1
                except Exception as e:
                    logger.warning(f"[FTS] Failed to index message {msg.id}: {e}")
        
        db.commit()
        
        if (i // batch_size + 1) % 10 == 0:
            logger.info(f"[FTS] Chat {chat_id}: Indexed {indexed_count}/{len(messages)} messages")
    
    logger.info(f"[FTS] Chat {chat_id}: ✅ Indexed {indexed_count} messages")
    return indexed_count