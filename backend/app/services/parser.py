"""WhatsApp .txt chat parser — handles all edge cases.

Parses WhatsApp exported .txt files into structured message dicts.
Supports:
  - Multi-line messages (lines without timestamp = continuation)
  - Date format variants: DD/MM/YY, DD/MM/YYYY, MM/DD/YY, YYYY-MM-DD
  - Time format variants: 12h (3:42 PM) and 24h (15:42:33)
  - Unicode sender names (Hindi, Arabic, Tamil, emoji)
  - Deleted messages ("This message was deleted" / "You deleted this message")
  - Edited messages (strips "<This message was edited>")
  - Forwarded messages (detects forwarded prefix)
  - <Media omitted> handling → type=unknown_media
  - System messages (encryption notices, group creation, etc.) → skipped
"""

import re
from datetime import datetime
from typing import Optional, TypedDict


class ParsedMessage(TypedDict):
    """Structure returned for each parsed message."""
    sender: str
    content: str
    timestamp: datetime
    raw_line: str
    is_deleted: bool
    is_edited: bool
    is_forwarded: bool
    is_media_omitted: bool
    is_system: bool
    media_filename: Optional[str]


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Primary pattern: [DD/MM/YY, HH:MM:SS] or [DD/MM/YYYY, HH:MM:SS] or [YYYY-MM-DD, HH:MM:SS]
# Also matches without brackets and with various separators
# Group 1 = date, Group 2 = time (with optional AM/PM)
_TIMESTAMP_PATTERNS = [
    # [DD/MM/YY, HH:MM:SS] — brackets with seconds
    r'\[(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}:\d{2}(?:\s*[AaPp][Mm])?)\]',
    # [DD/MM/YY, HH:MM] — brackets without seconds
    r'\[(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)\]',
    # [YYYY-MM-DD, HH:MM:SS] — ISO date in brackets
    r'\[(\d{4}-\d{2}-\d{2}),\s*(\d{1,2}:\d{2}:\d{2}(?:\s*[AaPp][Mm])?)\]',
    # [YYYY-MM-DD, HH:MM] — ISO date in brackets, no seconds
    r'\[(\d{4}-\d{2}-\d{2}),\s*(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)\]',
    # DD/MM/YY, HH:MM:SS — no brackets with seconds
    r'(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}:\d{2}(?:\s*[AaPp][Mm])?)',
    # DD/MM/YY, HH:MM — no brackets without seconds
    r'(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)',
    # DD/MM/YY HH:MM — no brackets, space separator (some exports)
    r'(\d{1,2}/\d{1,2}/\d{2,4})\s+(\d{1,2}:\d{2}:\d{2}(?:\s*[AaPp][Mm])?)',
    r'(\d{1,2}/\d{1,2}/\d{2,4})\s+(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)',
]

# Build combined message line pattern:
# Format A (brackets):  [timestamp] Sender: message
# Format B (no brackets): timestamp - Sender: message
# Sender can be Unicode (Hindi, Arabic, emoji, etc.)
_MESSAGE_LINE_PATTERNS: list[re.Pattern] = []
for ts_pat in _TIMESTAMP_PATTERNS:
    if ts_pat.startswith(r'\['):
        # Bracket format: [timestamp] Sender: message (no dash after bracket)
        _MESSAGE_LINE_PATTERNS.append(
            re.compile(
                ts_pat + r'\s*(.+?):\s(.*)',
                re.DOTALL
            )
        )
    else:
        # No-bracket format: timestamp - Sender: message
        _MESSAGE_LINE_PATTERNS.append(
            re.compile(
                ts_pat + r'\s*[\-\u2013]\s*(.+?):\s(.*)',
                re.DOTALL
            )
        )

# System message patterns (no sender, just timestamp + message)
_SYSTEM_LINE_PATTERNS: list[re.Pattern] = []
for ts_pat in _TIMESTAMP_PATTERNS:
    if ts_pat.startswith(r'\['):
        # Bracket format: [timestamp] system message
        _SYSTEM_LINE_PATTERNS.append(
            re.compile(
                ts_pat + r'\s*(.*)',
                re.DOTALL
            )
        )
    else:
        # No-bracket format: timestamp - system message
        _SYSTEM_LINE_PATTERNS.append(
            re.compile(
                ts_pat + r'\s*[\-\u2013]\s*(.*)',
                re.DOTALL
            )
        )

# Timestamp-only detection (to know if a line starts a new message)
_TIMESTAMP_DETECT_PATTERNS: list[re.Pattern] = [
    re.compile(ts_pat) for ts_pat in _TIMESTAMP_PATTERNS
]


# System message indicators — these are NOT real messages
_SYSTEM_INDICATORS = [
    "messages and calls are end-to-end encrypted",
    "end-to-end encrypted",
    "created group",
    "changed the group",
    "changed this group",
    "changed the subject",
    "changed the description",
    "added you",
    "removed you",
    "you were added",
    "you were removed",
    "left the group",
    "joined using this group",
    "security code changed",
    "your security code with",
    "changed their phone number",
    "business account",
    "disappeared from this chat",
    "turned on disappearing messages",
    "turned off disappearing messages",
    "pinned a message",
    "unpinned a message",
    "changed the group icon",
    "deleted the group icon",
    "you're now an admin",
    "is now an admin",
    "you changed this group",
    "waiting for this message",
    "null",
]

# Deleted message patterns
_DELETED_PATTERNS = [
    re.compile(r"this message was deleted", re.IGNORECASE),
    re.compile(r"you deleted this message", re.IGNORECASE),
    re.compile(r"this message has been deleted", re.IGNORECASE),
]

# Edited message indicator
_EDITED_SUFFIX = "<This message was edited>"
_EDITED_SUFFIX_LOWER = _EDITED_SUFFIX.lower()

# Forwarded message indicators
_FORWARDED_INDICATORS = [
    "\u200e",  # Left-to-right mark sometimes prefixed
]
_FORWARDED_PATTERN = re.compile(r"^\u200e?\[?Forwarded\]?", re.IGNORECASE)

# Media omitted
_MEDIA_OMITTED_PATTERN = re.compile(r"<Media omitted>", re.IGNORECASE)

# Attached file pattern: "filename.ext (file attached)"
_FILE_ATTACHED_PATTERN = re.compile(
    r'^(.+?)\s*\(file attached\)\s*$', re.IGNORECASE
)

# Media filename pattern in content like "IMG-20240315-WA0001.jpg" or just a filename
_MEDIA_FILENAME_PATTERN = re.compile(
    r'^([\w\-]+\.(jpg|jpeg|png|webp|gif|mp4|mov|avi|mp3|m4a|ogg|opus|pdf|docx?|xlsx?|pptx?|txt|vcf|3gp|mkv|aac|wav|csv))\s*(?:\(file attached\))?$',
    re.IGNORECASE,
)


def _is_system_message(content: str) -> bool:
    """Check if a message is a system/status message that should be skipped."""
    content_lower = content.lower().strip()
    for indicator in _SYSTEM_INDICATORS:
        if indicator in content_lower:
            return True
    return False


def _parse_timestamp(date_str: str, time_str: str) -> Optional[datetime]:
    """Parse date and time strings into a datetime object.
    
    Handles:
      - DD/MM/YY, DD/MM/YYYY
      - MM/DD/YY, MM/DD/YYYY (auto-detected)
      - YYYY-MM-DD
      - 12h (AM/PM) and 24h time formats
      - With or without seconds
    """
    date_str = date_str.strip()
    time_str = time_str.strip()
    
    # Parse the time part
    time_formats = [
        "%I:%M:%S %p",  # 3:42:33 PM
        "%I:%M %p",     # 3:42 PM
        "%H:%M:%S",     # 15:42:33
        "%H:%M",        # 15:42
    ]
    
    parsed_time = None
    for fmt in time_formats:
        try:
            t = datetime.strptime(time_str, fmt)
            parsed_time = t
            break
        except ValueError:
            continue
    
    # Handle am/pm variations without space
    if parsed_time is None:
        # Try normalizing AM/PM: "3:42:33PM" -> "3:42:33 PM"
        normalized = re.sub(r'(\d)([AaPp][Mm])', r'\1 \2', time_str)
        for fmt in time_formats:
            try:
                t = datetime.strptime(normalized.upper(), fmt.replace("%p", "%p"))
                parsed_time = t
                break
            except ValueError:
                continue
    
    if parsed_time is None:
        return None
    
    # Parse the date part
    parsed_date = None
    
    # ISO format: YYYY-MM-DD
    if '-' in date_str and len(date_str) == 10:
        try:
            parsed_date = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            pass
    
    if parsed_date is None and '/' in date_str:
        parts = date_str.split('/')
        if len(parts) == 3:
            a, b, c = parts
            a, b, c = int(a), int(b), int(c)
            
            # Handle 2-digit vs 4-digit year
            year = c
            if year < 100:
                year += 2000
            
            # Heuristic: if first number > 12, it must be DD/MM/YYYY
            # If second number > 12, it must be MM/DD/YYYY
            # If both <= 12, default to DD/MM/YYYY (most common WhatsApp format)
            if a > 12:
                # DD/MM/YYYY
                day, month = a, b
            elif b > 12:
                # MM/DD/YYYY
                month, day = a, b
            else:
                # Ambiguous — default to DD/MM/YYYY (international format, most common for WhatsApp)
                day, month = a, b
            
            try:
                parsed_date = datetime(year, month, day)
            except ValueError:
                # If DD/MM failed, try MM/DD
                try:
                    parsed_date = datetime(year, a, b)
                except ValueError:
                    pass
    
    if parsed_date is None:
        return None
    
    # Combine date and time
    return parsed_date.replace(
        hour=parsed_time.hour,
        minute=parsed_time.minute,
        second=parsed_time.second,
    )


def _try_parse_message_line(line: str) -> Optional[tuple[datetime, str, str, str]]:
    """Try to parse a line as a WhatsApp message.
    
    Returns (timestamp, sender, content, raw_match) or None.
    """
    for pattern in _MESSAGE_LINE_PATTERNS:
        match = pattern.match(line)
        if match:
            date_str = match.group(1)
            time_str = match.group(2)
            sender = match.group(3).strip()
            content = match.group(4) if match.lastindex >= 4 else ""
            
            timestamp = _parse_timestamp(date_str, time_str)
            if timestamp:
                return (timestamp, sender, content, line)
    
    return None


def _try_parse_system_line(line: str) -> Optional[tuple[datetime, str, str]]:
    """Try to parse a line as a system message (no sender).
    
    Returns (timestamp, content, raw_match) or None.
    """
    for pattern in _SYSTEM_LINE_PATTERNS:
        match = pattern.match(line)
        if match:
            date_str = match.group(1)
            time_str = match.group(2)
            content = match.group(3).strip()
            
            timestamp = _parse_timestamp(date_str, time_str)
            if timestamp:
                return (timestamp, content, line)
    
    return None


def _is_new_message_line(line: str) -> bool:
    """Check if a line starts with a timestamp pattern (i.e. it's a new message)."""
    for pattern in _TIMESTAMP_DETECT_PATTERNS:
        if pattern.match(line):
            return True
    return False


def _process_content(content: str) -> dict:
    """Process message content to detect special types.
    
    Returns a dict with processed fields:
      - content: cleaned content
      - is_deleted: bool
      - is_edited: bool  
      - is_forwarded: bool
      - is_media_omitted: bool
      - media_filename: Optional[str]
    """
    result = {
        "content": content.strip(),
        "is_deleted": False,
        "is_edited": False,
        "is_forwarded": False,
        "is_media_omitted": False,
        "media_filename": None,
    }
    
    stripped = content.strip()
    
    # Check for deleted messages
    for pattern in _DELETED_PATTERNS:
        if pattern.search(stripped):
            result["is_deleted"] = True
            result["content"] = stripped
            return result
    
    # Check for media omitted
    if _MEDIA_OMITTED_PATTERN.search(stripped):
        result["is_media_omitted"] = True
        result["content"] = stripped
        return result
    
    # Check for forwarded messages
    if _FORWARDED_PATTERN.match(stripped):
        result["is_forwarded"] = True
        # Remove the forwarded prefix
        cleaned = _FORWARDED_PATTERN.sub("", stripped).strip()
        result["content"] = cleaned if cleaned else stripped
    
    # Check for edited messages
    if _EDITED_SUFFIX_LOWER in result["content"].lower():
        result["is_edited"] = True
        # Remove the edited suffix
        idx = result["content"].lower().rfind(_EDITED_SUFFIX_LOWER)
        result["content"] = result["content"][:idx].strip()
    
    # Check for attached files
    file_match = _FILE_ATTACHED_PATTERN.match(result["content"].strip())
    if file_match:
        result["media_filename"] = file_match.group(1).strip()
    
    # Check for media filename patterns
    media_match = _MEDIA_FILENAME_PATTERN.match(result["content"].strip())
    if media_match and not result["media_filename"]:
        result["media_filename"] = media_match.group(1).strip()
    
    return result


def parse_whatsapp_chat(text: str) -> list[ParsedMessage]:
    """Parse a WhatsApp chat export text into a list of ParsedMessage dicts.
    
    Args:
        text: Full content of a WhatsApp .txt export file.
        
    Returns:
        List of ParsedMessage dicts, in chronological order.
        System messages are excluded.
    """
    lines = text.split('\n')
    messages: list[ParsedMessage] = []
    
    current_msg: Optional[dict] = None
    
    for line in lines:
        # Skip empty lines at the start
        if not line.strip() and current_msg is None:
            continue
        
        # Try to parse as a new message line (with sender)
        parsed = _try_parse_message_line(line)
        
        if parsed:
            # Save any existing message
            if current_msg is not None:
                messages.append(_finalize_message(current_msg))
            
            timestamp, sender, content, raw = parsed
            current_msg = {
                "timestamp": timestamp,
                "sender": sender,
                "content": content,
                "raw_lines": [raw],
            }
            continue
        
        # Try to parse as system message (no sender)
        system_parsed = _try_parse_system_line(line)
        if system_parsed:
            timestamp, content, raw = system_parsed
            
            # Check if it's a system message
            if _is_system_message(content):
                # Save existing message first
                if current_msg is not None:
                    messages.append(_finalize_message(current_msg))
                    current_msg = None
                continue  # Skip system messages
            
            # It might be a message without sender format (rare)
            # Or a system message we don't recognize — treat as system and skip
            if current_msg is not None:
                messages.append(_finalize_message(current_msg))
                current_msg = None
            
            # Check if this looks like a real message (has meaningful content)
            # System messages without our indicators — still skip them
            # because they don't have a sender
            continue
        
        # Not a new message line — continuation of previous message
        if current_msg is not None:
            current_msg["content"] += "\n" + line
            current_msg["raw_lines"].append(line)
        # else: orphan line before any message — skip
    
    # Don't forget the last message
    if current_msg is not None:
        messages.append(_finalize_message(current_msg))
    
    return messages


def _finalize_message(msg_dict: dict) -> ParsedMessage:
    """Process a raw message dict into a finalized ParsedMessage."""
    content = msg_dict["content"]
    raw_line = "\n".join(msg_dict["raw_lines"])
    
    processed = _process_content(content)
    
    return ParsedMessage(
        sender=msg_dict["sender"],
        content=processed["content"],
        timestamp=msg_dict["timestamp"],
        raw_line=raw_line,
        is_deleted=processed["is_deleted"],
        is_edited=processed["is_edited"],
        is_forwarded=processed["is_forwarded"],
        is_media_omitted=processed["is_media_omitted"],
        is_system=False,
        media_filename=processed["media_filename"],
    )


def detect_chat_name(text: str) -> str:
    """Try to detect a chat name from the export.
    
    Heuristic: Look at unique sender names.
    - If 2 senders: it's a personal chat, name = the other person
    - If >2 senders: it's a group chat, name = "Group Chat"
    - If 1 sender: name = that sender's name
    """
    messages = parse_whatsapp_chat(text)
    senders = set(m["sender"] for m in messages if m["sender"])
    
    if len(senders) == 0:
        return "Unknown Chat"
    elif len(senders) == 1:
        return f"Chat with {next(iter(senders))}"
    elif len(senders) == 2:
        return f"Chat: {' & '.join(sorted(senders))}"
    else:
        return f"Group Chat ({len(senders)} members)"


def get_unique_senders(messages: list[ParsedMessage]) -> list[str]:
    """Extract unique sender names from parsed messages."""
    seen: set[str] = set()
    result: list[str] = []
    for msg in messages:
        name = msg["sender"]
        if name and name not in seen:
            seen.add(name)
            result.append(name)
    return result
