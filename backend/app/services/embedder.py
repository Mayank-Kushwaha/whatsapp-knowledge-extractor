"""Sentence embedding service.

Two providers are supported and selected via EMBEDDING_PROVIDER:

- "gemini" (default): Google's hosted gemini-embedding-001, 768-dim
  output. Free tier is capped at 100 requests/min AND 1000 requests/day
  per project per model — fine for production with paid billing but
  easy to exhaust during development.

- "local": sentence-transformers loaded into the FastAPI process, no
  network calls and no quotas. Default model `all-MiniLM-L6-v2` is
  ~90MB and outputs 384-dim vectors. Requires ~500MB RAM (PyTorch +
  model), so it OOMs on Render free tier. Intended for local dev.

Embedding dimension differs by provider — embeddings written by one
provider cannot be compared against those written by the other within
the same chat. Switching providers requires re-uploading existing chats.
"""

import json
import logging
import os
import re
import time
from typing import Optional

import numpy as np
from sqlalchemy.orm import Session

from app.core.config import (
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_MODEL,
    EMBEDDING_PROVIDER,
    GEMINI_API_KEY,
)
from app.models.db import Message

logger = logging.getLogger(__name__)

# Native output dimensions per provider. Local sentence-transformers
# all-MiniLM-L6-v2 = 384. Gemini's gemini-embedding-001 = 768.
_GEMINI_DIMENSIONS = 768
_LOCAL_DIMENSIONS = 384
EMBEDDING_DIMENSIONS = (
    _LOCAL_DIMENSIONS if EMBEDDING_PROVIDER == "local" else _GEMINI_DIMENSIONS
)

# Gemini's embed_content accepts up to 100 inputs per call. Cap the
# configured batch size at that ceiling.
_GEMINI_BATCH_LIMIT = 100

# Free-tier Gemini allows 100 embedding requests per minute per project.
# Paid tier raises this to 1500 RPM. Default to ~92 RPM (0.65s between
# calls) to stay comfortably under the free limit. Override via
# EMBEDDING_MIN_INTERVAL (seconds) on paid tier for faster throughput.
_min_call_interval = float(os.getenv("EMBEDDING_MIN_INTERVAL", "0.65"))
_last_call_time = 0.0

# Max retries on 429 quota errors before giving up.
_MAX_RETRIES = 4

# Cached sentence-transformers model instance for the "local" provider.
# Loaded lazily on first use and reused for the lifetime of the process.
_local_model = None


def _get_local_model():
    """Lazy-load the sentence-transformers model for the local provider."""
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer

        model_name = (EMBEDDING_MODEL or "").strip()
        # If EMBEDDING_MODEL is set to a Gemini name, ignore it for local.
        if not model_name or model_name.startswith(("text-embedding", "gemini-embedding", "models/")):
            model_name = "all-MiniLM-L6-v2"
        logger.info(f"[Embedder] Loading local model '{model_name}' (first use; may take ~10s)")
        _local_model = SentenceTransformer(model_name)
        logger.info("[Embedder] Local model loaded.")
    return _local_model


def _configure_genai():
    """Configure the google-generativeai SDK once with the API key."""
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY is not set — required for Gemini embeddings."
        )
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    return genai


def _gemini_model_id() -> str:
    """Resolve the Gemini embedding model id.

    Honors EMBEDDING_MODEL from the env if it looks like a Gemini embedding
    model name; otherwise falls back to gemini-embedding-001 (the current
    production model — text-embedding-004 was retired on v1beta).
    Legacy values like 'all-MiniLM-L6-v2' are ignored so old configs keep
    working.
    """
    name = (EMBEDDING_MODEL or "").strip()
    if name.startswith("models/"):
        return name
    if name.startswith("text-embedding") or name.startswith("gemini-embedding") or name == "embedding-001":
        return f"models/{name}"
    return "models/gemini-embedding-001"


def embed_texts(
    texts: list[str],
    task_type: str = "RETRIEVAL_DOCUMENT",
) -> np.ndarray:
    """Embed a list of strings via the configured provider.

    Returns a numpy matrix of shape (len(texts), EMBEDDING_DIMENSIONS).
    Caller is responsible for filtering empty/short strings beforehand.
    `task_type` is honored by Gemini (RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY)
    and ignored by the local provider, which produces symmetric embeddings.
    """
    if not texts:
        return np.zeros((0, EMBEDDING_DIMENSIONS), dtype=np.float32)

    if EMBEDDING_PROVIDER == "local":
        model = _get_local_model()
        # SentenceTransformer.encode handles batching internally and
        # respects batch_size for memory control.
        embeddings = model.encode(
            texts,
            batch_size=EMBEDDING_BATCH_SIZE or 32,
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=False,
        )
        return embeddings.astype(np.float32)

    # Default provider: Gemini.
    global _last_call_time
    genai = _configure_genai()
    model_id = _gemini_model_id()
    batch = min(EMBEDDING_BATCH_SIZE or _GEMINI_BATCH_LIMIT, _GEMINI_BATCH_LIMIT)

    out: list[list[float]] = []

    for start in range(0, len(texts), batch):
        chunk = texts[start:start + batch]

        result = _embed_with_retry(genai, model_id, chunk, task_type)

        embedding_field = result.get("embedding") if isinstance(result, dict) else None
        if embedding_field is None:
            raise RuntimeError(f"Gemini returned no embedding field: {result!r}")

        # Single-input calls return a flat list, batch calls return a list of lists.
        if chunk and isinstance(embedding_field[0], (int, float)):
            out.append(list(embedding_field))
        else:
            out.extend(list(v) for v in embedding_field)

    return np.asarray(out, dtype=np.float32)


def _embed_with_retry(genai, model_id: str, chunk: list[str], task_type: str) -> dict:
    """Call genai.embed_content with rate-limit throttling and 429 retry.

    Pre-throttles so consecutive calls are at least _min_call_interval apart
    (default 0.65s ≈ 92 RPM — under Gemini free tier's 100 RPM limit).
    On 429 quota errors, parses Google's `retry_delay { seconds: N }` from
    the exception and sleeps that long before retrying. Retries up to
    _MAX_RETRIES times, then re-raises.
    """
    global _last_call_time

    for attempt in range(_MAX_RETRIES + 1):
        elapsed = time.time() - _last_call_time
        if elapsed < _min_call_interval:
            time.sleep(_min_call_interval - elapsed)

        try:
            result = genai.embed_content(
                model=model_id,
                content=chunk,
                task_type=task_type,
            )
            _last_call_time = time.time()
            return result
        except Exception as e:
            _last_call_time = time.time()
            err_text = str(e)
            is_quota = (
                "429" in err_text
                or "quota" in err_text.lower()
                or "exceeded" in err_text.lower()
                or "rate limit" in err_text.lower()
            )
            if not is_quota or attempt == _MAX_RETRIES:
                raise

            # Parse Google's suggested retry_delay; fall back to 60s.
            retry_seconds = 60
            match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", err_text)
            if match:
                retry_seconds = int(match.group(1)) + 1  # +1s safety buffer

            logger.warning(
                f"[Embedder] Gemini quota hit (attempt {attempt + 1}/{_MAX_RETRIES + 1}); "
                f"sleeping {retry_seconds}s before retry."
            )
            time.sleep(retry_seconds)

    # Unreachable — the loop either returns or raises.
    raise RuntimeError("Gemini embedding retry loop exited unexpectedly")


def embed_messages(db: Session, chat_id: int) -> int:
    """Generate and store embeddings for all text messages in a chat.

    Returns the number of messages embedded.
    """
    logger.info(f"[Embedder] Chat {chat_id}: Starting embedding generation")

    messages = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.type.notin_(["deleted", "unknown_media"]),
        Message.embedding.is_(None),
    ).all()

    if not messages:
        logger.info(f"[Embedder] Chat {chat_id}: No messages to embed")
        return 0

    logger.info(f"[Embedder] Chat {chat_id}: Found {len(messages)} candidate messages")

    valid_messages = []
    valid_texts = []
    for msg in messages:
        content = (msg.content or "").strip()
        if len(content) >= 3:
            valid_messages.append(msg)
            valid_texts.append(content)

    if not valid_messages:
        logger.info(f"[Embedder] Chat {chat_id}: No valid messages (all too short)")
        return 0

    logger.info(f"[Embedder] Chat {chat_id}: Embedding {len(valid_messages)} messages via Gemini")

    embedded_count = 0
    batch = min(EMBEDDING_BATCH_SIZE or _GEMINI_BATCH_LIMIT, _GEMINI_BATCH_LIMIT)

    for i in range(0, len(valid_messages), batch):
        msg_batch = valid_messages[i:i + batch]
        text_batch = valid_texts[i:i + batch]

        try:
            embeddings = embed_texts(text_batch, task_type="RETRIEVAL_DOCUMENT")
        except Exception as e:
            logger.error(f"[Embedder] Chat {chat_id}: Batch {i // batch} failed: {e}")
            raise

        for msg, embedding in zip(msg_batch, embeddings):
            msg.embedding = json.dumps(embedding.tolist())
            embedded_count += 1

        db.commit()

        if (i // batch + 1) % 10 == 0:
            logger.info(
                f"[Embedder] Chat {chat_id}: Embedded {embedded_count}/{len(valid_messages)} messages"
            )

    logger.info(f"[Embedder] Chat {chat_id}: Embedded {embedded_count} messages")
    return embedded_count


def get_embedding_matrix(db: Session, chat_id: int) -> tuple[np.ndarray, list[int]]:
    """Load all embeddings for a chat as a numpy matrix.

    Returns (embedding_matrix, message_ids).
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
