"""LLM abstraction layer — Gemini 2.0 Flash + Ollama fallback.

All LLM calls in the codebase go through this service.
"""

import logging
import time
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import (
    GEMINI_API_KEY,
    LLM_PROVIDER,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
)
from app.models.db import Cluster, Message

logger = logging.getLogger(__name__)

# Rate limiting for Gemini (15 req/min)
_last_gemini_call_time = 0.0
_gemini_min_interval = 4.0  # 4 seconds between calls = 15 req/min


def _gemini_generate(prompt: str) -> str:
    """Generate text using Gemini 2.0 Flash."""
    global _last_gemini_call_time
    
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set in environment")
    
    # Rate limiting
    elapsed = time.time() - _last_gemini_call_time
    if elapsed < _gemini_min_interval:
        sleep_time = _gemini_min_interval - elapsed
        logger.debug(f"[LLM] Rate limiting: sleeping {sleep_time:.1f}s")
        time.sleep(sleep_time)
    
    try:
        import google.generativeai as genai

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        response = model.generate_content(prompt)
        _last_gemini_call_time = time.time()
        
        return response.text.strip()
    
    except Exception as e:
        logger.error(f"[LLM] Gemini error: {e}")
        raise


def _ollama_generate(prompt: str) -> str:
    """Generate text using Ollama."""
    try:
        response = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
            },
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("response", "").strip()
    
    except Exception as e:
        logger.error(f"[LLM] Ollama error: {e}")
        raise


def llm_generate(prompt: str) -> str:
    """Generate text using the configured LLM provider.
    
    Args:
        prompt: Text prompt
        
    Returns:
        Generated text
        
    Raises:
        ValueError: If provider is unknown or API key missing
        Exception: If LLM call fails
    """
    if LLM_PROVIDER == "gemini":
        return _gemini_generate(prompt)
    elif LLM_PROVIDER == "ollama":
        return _ollama_generate(prompt)
    else:
        raise ValueError(f"Unknown LLM provider: {LLM_PROVIDER}")


def label_cluster(sample_messages: list[str]) -> tuple[str, str]:
    """Generate a topic label and summary for a cluster.
    
    Args:
        sample_messages: List of sample message texts from the cluster
        
    Returns:
        Tuple of (label, summary)
        label: 2-4 word topic label
        summary: 1-sentence summary
    """
    # Build prompt
    messages_text = "\n".join(f"- {msg[:200]}" for msg in sample_messages[:15])
    
    prompt = f"""Given these sample messages from a WhatsApp chat, generate:
1. A concise 2-4 word topic label
2. A 1-sentence summary

Messages:
{messages_text}

Format your response as:
LABEL: <your label>
SUMMARY: <your summary>"""
    
    try:
        response = llm_generate(prompt)
        
        # Parse response
        lines = response.strip().split("\n")
        label = "Untitled Topic"
        summary = "A collection of messages."
        
        for line in lines:
            if line.startswith("LABEL:"):
                label = line.replace("LABEL:", "").strip()
            elif line.startswith("SUMMARY:"):
                summary = line.replace("SUMMARY:", "").strip()
        
        # Fallback if parsing failed
        if label == "Untitled Topic" and len(lines) > 0:
            label = lines[0][:50]  # Use first line as label
        if summary == "A collection of messages." and len(lines) > 1:
            summary = lines[1][:200]  # Use second line as summary
        
        return label, summary
    
    except Exception as e:
        logger.error(f"[LLM] Cluster labeling failed: {e}")
        return "Untitled Topic", "A collection of messages."


def label_clusters_for_chat(db: Session, chat_id: int) -> int:
    """Generate labels and summaries for all clusters in a chat.
    
    Args:
        db: Database session
        chat_id: Chat ID
        
    Returns:
        Number of clusters labeled
    """
    logger.info(f"[LLM] Chat {chat_id}: Starting cluster labeling")
    
    clusters = db.query(Cluster).filter(Cluster.chat_id == chat_id).all()
    
    if not clusters:
        logger.info(f"[LLM] Chat {chat_id}: No clusters to label")
        return 0
    
    logger.info(f"[LLM] Chat {chat_id}: Found {len(clusters)} clusters to label")
    
    labeled_count = 0
    
    for i, cluster in enumerate(clusters, 1):
        # Get sample messages from this cluster
        messages = db.query(Message).filter(
            Message.cluster_id == cluster.id
        ).limit(15).all()
        
        if not messages:
            logger.warning(f"[LLM] Cluster {cluster.id}: No messages found")
            continue
        
        sample_texts = [msg.content for msg in messages if msg.content]
        
        if not sample_texts:
            logger.warning(f"[LLM] Cluster {cluster.id}: No text content")
            continue
        
        # Generate label and summary
        logger.info(f"[LLM] Chat {chat_id}: Labeling cluster {i}/{len(clusters)} (ID {cluster.id})")
        
        try:
            label, summary = label_cluster(sample_texts)
            cluster.label = label
            cluster.summary = summary
            labeled_count += 1
            
            logger.info(f"[LLM] Cluster {cluster.id}: '{label}'")
        
        except Exception as e:
            logger.error(f"[LLM] Cluster {cluster.id}: Labeling failed: {e}")
            cluster.label = f"Topic {i}"
            cluster.summary = "A collection of related messages."
    
    db.commit()
    
    logger.info(f"[LLM] Chat {chat_id}: ✅ Labeled {labeled_count}/{len(clusters)} clusters")
    return labeled_count