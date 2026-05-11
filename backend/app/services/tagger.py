"""Importance tagger — flags messages as important based on keywords and emoji.

Step 8 of the pipeline. Scans message content for:
  - Keyword triggers: important, urgent, remember, don't forget, reminder, note:, etc.
  - Emoji triggers: ❗ ‼️ ⚠️ 📌 📍 🔴 🔖 ✅ ☑️ 🚨
Creates ImportantFlag rows and sets messages.is_important = True.
"""

import logging
import re
from typing import Optional

from sqlalchemy.orm import Session

from app.models.db import ImportantFlag, Message

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Keyword triggers (case-insensitive)
# ---------------------------------------------------------------------------

_KEYWORD_TRIGGERS: list[tuple[re.Pattern, str]] = [
    (re.compile(r'\bimportant\b', re.IGNORECASE), "important"),
    (re.compile(r'\burgent\b', re.IGNORECASE), "urgent"),
    (re.compile(r'\bremember\b', re.IGNORECASE), "remember"),
    (re.compile(r"\bdon'?t forget\b", re.IGNORECASE), "don't forget"),
    (re.compile(r'\breminder\b', re.IGNORECASE), "reminder"),
    (re.compile(r'\bnote:\s', re.IGNORECASE), "note:"),
    (re.compile(r'\btodo\b', re.IGNORECASE), "todo"),
    (re.compile(r'\bto do\b', re.IGNORECASE), "to do"),
    (re.compile(r'\bdeadline\b', re.IGNORECASE), "deadline"),
    (re.compile(r'\basap\b', re.IGNORECASE), "asap"),
    (re.compile(r'\bcritical\b', re.IGNORECASE), "critical"),
    (re.compile(r'\bmust read\b', re.IGNORECASE), "must read"),
    (re.compile(r'\baction required\b', re.IGNORECASE), "action required"),
    (re.compile(r'\bfollow up\b', re.IGNORECASE), "follow up"),
    (re.compile(r'\bplease note\b', re.IGNORECASE), "please note"),
    (re.compile(r'\bsave this\b', re.IGNORECASE), "save this"),
    (re.compile(r'\bkeep this\b', re.IGNORECASE), "keep this"),
    (re.compile(r'\bhigh priority\b', re.IGNORECASE), "high priority"),
    (re.compile(r'\bpriority\b', re.IGNORECASE), "priority"),
    (re.compile(r'\bfyi\b', re.IGNORECASE), "fyi"),
]


# ---------------------------------------------------------------------------
# Emoji triggers
# ---------------------------------------------------------------------------

_EMOJI_TRIGGERS: list[str] = [
    "❗", "‼️", "⚠️", "📌", "📍", "🔴", "🔖", "✅", "☑️", "🚨",
    "⭐", "🌟", "💡", "🔔", "📢", "📣", "🎯", "💥", "🔥",
    "⚡", "🏷️", "❕", "❓", "❔",
]


# ---------------------------------------------------------------------------
# Tagging functions
# ---------------------------------------------------------------------------

def check_importance(content: str) -> list[dict]:
    """Check if a message should be flagged as important.
    
    Returns a list of trigger dicts: [{"type": "keyword"|"emoji", "value": str}]
    Returns empty list if not important.
    """
    triggers: list[dict] = []
    
    # Check keywords
    for pattern, keyword in _KEYWORD_TRIGGERS:
        if pattern.search(content):
            triggers.append({"type": "keyword", "value": keyword})
    
    # Check emoji
    for emoji in _EMOJI_TRIGGERS:
        if emoji in content:
            triggers.append({"type": "emoji", "value": emoji})
    
    return triggers


def tag_important_messages(db: Session, chat_id: int) -> int:
    """Tag important messages for a chat.
    
    This is Step 8 of the pipeline.
    
    Returns:
        Number of messages flagged as important
    """
    messages = (
        db.query(Message)
        .filter(Message.chat_id == chat_id)
        .filter(Message.type != "deleted")
        .filter(Message.is_important == False)
        .all()
    )
    
    if not messages:
        logger.info(f"[Tagger] Chat {chat_id}: No messages to tag")
        return 0
    
    flagged = 0
    for msg in messages:
        triggers = check_importance(msg.content)
        
        if triggers:
            msg.is_important = True
            # Set the primary reason
            msg.importance_reason = triggers[0]["value"]
            
            # Create ImportantFlag rows for each trigger
            for trigger in triggers:
                flag = ImportantFlag(
                    message_id=msg.id,
                    trigger_type=trigger["type"],
                    trigger_value=trigger["value"],
                )
                db.add(flag)
            
            flagged += 1
    
    db.commit()
    logger.info(f"[Tagger] Chat {chat_id}: Flagged {flagged}/{len(messages)} messages as important")
    return flagged
