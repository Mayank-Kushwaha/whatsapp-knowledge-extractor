"""Processing pipeline for uploaded WhatsApp chats.

Sprint 1: Step 1 (Parse) and Step 10 (Complete).
Sprint 2: Steps 2 (Classify), 3 (OG Fetch), 4 (PDF Extract), 8 (Tag Important).
"""

import logging
import traceback
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.db import (
    Chat,
    Message,
    PipelineStatus,
    Sender,
    SessionLocal,
)
from app.services.parser import ParsedMessage, get_unique_senders, parse_whatsapp_chat

logger = logging.getLogger(__name__)

# Pipeline step names for SSE progress reporting
PIPELINE_STEPS = {
    1: "Parsing messages",
    2: "Classifying content",
    3: "Enriching links (OG metadata)",
    4: "Extracting PDF text",
    5: "Generating embeddings",
    6: "Clustering topics",
    7: "Labeling clusters",
    8: "Tagging importance",
    9: "Building search index",
    10: "Finalizing",
}


def _update_pipeline_status(
    db: Session,
    chat_id: int,
    step: int,
    error: Optional[str] = None,
) -> None:
    """Update the pipeline_status row for a chat."""
    status = db.query(PipelineStatus).filter(PipelineStatus.chat_id == chat_id).first()
    if status:
        status.current_step = step
        status.steps_complete = step - 1 if error is None else step
        status.error = error
        status.updated_at = datetime.utcnow()
        db.commit()


def _create_senders(
    db: Session,
    chat_id: int,
    sender_names: list[str],
) -> dict[str, int]:
    """Create Sender rows and return a name→id mapping."""
    name_to_id: dict[str, int] = {}
    for name in sender_names:
        sender = Sender(
            chat_id=chat_id,
            display_name=name,
        )
        db.add(sender)
        db.flush()
        name_to_id[name] = sender.id
    db.commit()
    return name_to_id


def _bulk_insert_messages(
    db: Session,
    chat_id: int,
    parsed_messages: list[ParsedMessage],
    sender_map: dict[str, int],
    batch_size: int = 500,
) -> int:
    """Bulk insert parsed messages into the database.
    
    Returns the number of messages inserted.
    """
    count = 0
    batch: list[Message] = []
    
    for msg in parsed_messages:
        sender_id = sender_map.get(msg["sender"])
        
        # Determine initial type
        msg_type = "text"
        if msg["is_deleted"]:
            msg_type = "deleted"
        elif msg["is_media_omitted"]:
            msg_type = "unknown_media"
        elif msg["media_filename"]:
            msg_type = "media"  # Will be refined in Step 2 by classifier
        
        message = Message(
            chat_id=chat_id,
            sender_id=sender_id,
            content=msg["content"],
            timestamp=msg["timestamp"],
            type=msg_type,
            is_important=False,
            raw_line=msg["raw_line"],
        )
        batch.append(message)
        count += 1
        
        if len(batch) >= batch_size:
            db.bulk_save_objects(batch)
            db.flush()
            batch = []
    
    # Insert remaining
    if batch:
        db.bulk_save_objects(batch)
        db.flush()
    
    db.commit()
    return count


def run_pipeline(chat_id: int, chat_text: str, media_dir: Optional[str] = None) -> None:
    """Run the full processing pipeline for a chat.
    
    This runs as a BackgroundTask. Each step updates pipeline_status
    so the SSE endpoint can report progress.
    """
    db = SessionLocal()
    
    try:
        # ── Step 1: Parse ──────────────────────────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 1 — Parsing messages")
        _update_pipeline_status(db, chat_id, step=1)
        
        parsed_messages = parse_whatsapp_chat(chat_text)
        logger.info(f"[Pipeline] Chat {chat_id}: Parsed {len(parsed_messages)} messages")
        
        if not parsed_messages:
            _update_pipeline_status(db, chat_id, step=1, error="No messages found in the file")
            chat = db.query(Chat).get(chat_id)
            if chat:
                chat.status = "error"
                db.commit()
            return
        
        # Create senders
        sender_names = get_unique_senders(parsed_messages)
        sender_map = _create_senders(db, chat_id, sender_names)
        logger.info(f"[Pipeline] Chat {chat_id}: Found {len(sender_names)} senders")
        
        # Bulk insert messages
        msg_count = _bulk_insert_messages(db, chat_id, parsed_messages, sender_map)
        logger.info(f"[Pipeline] Chat {chat_id}: Inserted {msg_count} messages")
        
        # Update chat metadata
        chat = db.query(Chat).get(chat_id)
        if chat:
            chat.message_count = msg_count
            chat.type = "personal" if len(sender_names) <= 2 else "group"
            timestamps = [m["timestamp"] for m in parsed_messages]
            chat.date_range_start = min(timestamps)
            chat.date_range_end = max(timestamps)
            db.commit()
        
        # ── Step 2: Classify ───────────────────────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 2 — Classifying content")
        _update_pipeline_status(db, chat_id, step=2)
        
        from app.services.classifier import classify_and_enrich_messages
        classify_stats = classify_and_enrich_messages(db, chat_id, media_dir=media_dir)
        logger.info(f"[Pipeline] Chat {chat_id}: Classification done — {classify_stats}")
        
        # ── Step 3: Enrich Links (OG metadata) ─────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 3 — Enriching links")
        _update_pipeline_status(db, chat_id, step=3)
        
        from app.services.og_fetcher import fetch_and_store_og_metadata
        og_count = fetch_and_store_og_metadata(db, chat_id)
        logger.info(f"[Pipeline] Chat {chat_id}: OG enrichment done — {og_count} links enriched")
        
        # ── Step 4: Extract PDF text ───────────────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 4 — Extracting PDF text")
        _update_pipeline_status(db, chat_id, step=4)
        
        from app.services.pdf_extractor import extract_pdfs_for_chat
        pdf_count = extract_pdfs_for_chat(db, chat_id)
        logger.info(f"[Pipeline] Chat {chat_id}: PDF extraction done — {pdf_count} PDFs extracted")
        
        # ── Step 5: Generate Embeddings ────────────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 5 — Generating embeddings")
        _update_pipeline_status(db, chat_id, step=5)
        
        from app.services.embedder import embed_messages
        embedded_count = embed_messages(db, chat_id)
        logger.info(f"[Pipeline] Chat {chat_id}: Embedding done — {embedded_count} messages embedded")
        
        # ── Step 6: Cluster Topics ─────────────────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 6 — Clustering topics")
        _update_pipeline_status(db, chat_id, step=6)
        
        from app.services.clusterer import cluster_messages
        cluster_count = cluster_messages(db, chat_id)
        logger.info(f"[Pipeline] Chat {chat_id}: Clustering done — {cluster_count} clusters created")
        
        # ── Step 7: Label Clusters ─────────────────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 7 — Labeling clusters")
        _update_pipeline_status(db, chat_id, step=7)
        
        from app.services.llm import label_clusters_for_chat
        labeled_count = label_clusters_for_chat(db, chat_id)
        logger.info(f"[Pipeline] Chat {chat_id}: Labeling done — {labeled_count} clusters labeled")
        
        # ── Step 8: Tag Importance ─────────────────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 8 — Tagging importance")
        _update_pipeline_status(db, chat_id, step=8)
        
        from app.services.tagger import tag_important_messages
        tagged_count = tag_important_messages(db, chat_id)
        logger.info(f"[Pipeline] Chat {chat_id}: Tagging done — {tagged_count} messages flagged")
        
        # ── Step 9: Build FTS Index ────────────────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 9 — Building search index")
        _update_pipeline_status(db, chat_id, step=9)
        
        from app.services.fts_builder import build_fts_index
        fts_count = build_fts_index(db, chat_id)
        logger.info(f"[Pipeline] Chat {chat_id}: FTS index built — {fts_count} messages indexed")
        
        # ── Step 10: Mark Complete ─────────────────────────────────────
        logger.info(f"[Pipeline] Chat {chat_id}: Step 10 — Finalizing")
        _update_pipeline_status(db, chat_id, step=10)
        
        status = db.query(PipelineStatus).filter(PipelineStatus.chat_id == chat_id).first()
        if status:
            status.current_step = 10
            status.steps_complete = 10
            status.error = None
            status.updated_at = datetime.utcnow()
        
        chat = db.query(Chat).get(chat_id)
        if chat:
            chat.status = "ready"
        
        db.commit()
        logger.info(f"[Pipeline] Chat {chat_id}: ✅ Pipeline complete!")
        
    except Exception as e:
        logger.error(f"[Pipeline] Chat {chat_id}: ❌ Error: {e}")
        logger.error(traceback.format_exc())
        
        try:
            _update_pipeline_status(db, chat_id, step=0, error=str(e))
            chat = db.query(Chat).get(chat_id)
            if chat:
                chat.status = "error"
            db.commit()
        except Exception:
            pass
    
    finally:
        db.close()
