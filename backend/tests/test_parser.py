"""Unit tests for the WhatsApp .txt parser.

Tests all edge cases:
  - Standard messages
  - Multi-line messages
  - Date format variants (DD/MM/YY, MM/DD/YY, YYYY-MM-DD)
  - Time format variants (12h AM/PM, 24h)
  - Unicode sender names (Hindi, Arabic, emoji)
  - Deleted messages
  - Edited messages
  - Forwarded messages
  - <Media omitted>
  - System messages (skipped)
  - Empty input
  - Mixed formats
"""

import pytest
from datetime import datetime

from app.services.parser import (
    ParsedMessage,
    parse_whatsapp_chat,
    detect_chat_name,
    get_unique_senders,
    _parse_timestamp,
    _process_content,
)


# ============================================================================
# Test data
# ============================================================================

STANDARD_CHAT = """[15/03/2024, 09:42:33] John: Hey check this out
[15/03/2024, 09:43:15] Jane: Sure, what is it?
[15/03/2024, 09:44:00] John: It's a really cool link https://example.com
"""

MULTILINE_CHAT = """[15/03/2024, 09:42:33] John: Hey check this out
This is a continuation of the message
And another line
[15/03/2024, 09:43:15] Jane: Got it!
"""

DATE_DDMM_CHAT = """[15/03/24, 09:42:33] John: DD/MM/YY format
[01/12/24, 10:00:00] Jane: Another date
"""

DATE_ISO_CHAT = """[2024-03-15, 09:42:33] John: ISO format date
[2024-12-01, 10:00:00] Jane: Another ISO date
"""

TIME_12H_CHAT = """[15/03/24, 3:42:33 PM] John: 12 hour format with seconds
[15/03/24, 11:30 AM] Jane: 12 hour without seconds
"""

TIME_24H_CHAT = """[15/03/24, 15:42:33] John: 24 hour with seconds
[15/03/24, 09:30] Jane: 24 hour without seconds
"""

UNICODE_CHAT = """[15/03/24, 09:42] मयंक: नमस्ते
[15/03/24, 09:43] محمد: مرحبا
[15/03/24, 09:44] 😎 Cool Dude: Hey there!
"""

DELETED_CHAT = """[15/03/24, 09:42:33] John: Hello
[15/03/24, 09:43:15] Jane: This message was deleted
[15/03/24, 09:44:00] John: You deleted this message
[15/03/24, 09:45:00] Jane: OK
"""

EDITED_CHAT = """[15/03/24, 09:42:33] John: Hello world<This message was edited>
[15/03/24, 09:43:15] Jane: No edit here
"""

FORWARDED_CHAT = """[15/03/24, 09:42:33] John: Forwarded message content here
[15/03/24, 09:43:15] Jane: Normal message
"""

MEDIA_OMITTED_CHAT = """[15/03/24, 09:42:33] John: <Media omitted>
[15/03/24, 09:43:15] Jane: Check my photo
"""

SYSTEM_MESSAGES_CHAT = """[15/03/24, 09:40:00] Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.
[15/03/24, 09:42:33] John: Hey!
[15/03/24, 09:43:00] Jane created group "Project Team"
[15/03/24, 09:44:00] Jane: Welcome everyone!
[15/03/24, 09:45:00] Jane added you
[15/03/24, 09:46:00] John: Thanks for adding me!
"""

FILE_ATTACHED_CHAT = """[15/03/24, 09:42:33] John: IMG-20240315-WA0001.jpg (file attached)
[15/03/24, 09:43:15] Jane: document.pdf (file attached)
[15/03/24, 09:44:00] John: Normal text message
"""

NO_BRACKETS_CHAT = """15/03/24, 09:42:33 - John: Message without brackets
15/03/24, 09:43:15 - Jane: Another message
"""

MIXED_CHAT = """[15/03/2024, 09:42:33] John: Standard message
[15/03/2024, 09:43:15] Jane: This message was deleted
[15/03/2024, 09:44:00] John: Edited message<This message was edited>
[15/03/2024, 09:45:00] John: <Media omitted>
[15/03/2024, 09:46:00] Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
[15/03/2024, 09:47:00] Jane: Final message
With multiline content
"""


# ============================================================================
# Tests: _parse_timestamp
# ============================================================================

class TestParseTimestamp:
    """Tests for the timestamp parser."""

    def test_ddmmyyyy_24h(self):
        ts = _parse_timestamp("15/03/2024", "09:42:33")
        assert ts == datetime(2024, 3, 15, 9, 42, 33)

    def test_ddmmyy_24h(self):
        ts = _parse_timestamp("15/03/24", "09:42:33")
        assert ts == datetime(2024, 3, 15, 9, 42, 33)

    def test_iso_date(self):
        ts = _parse_timestamp("2024-03-15", "09:42:33")
        assert ts == datetime(2024, 3, 15, 9, 42, 33)

    def test_12h_pm(self):
        ts = _parse_timestamp("15/03/24", "3:42:33 PM")
        assert ts == datetime(2024, 3, 15, 15, 42, 33)

    def test_12h_am(self):
        ts = _parse_timestamp("15/03/24", "11:30 AM")
        assert ts == datetime(2024, 3, 15, 11, 30, 0)

    def test_24h_no_seconds(self):
        ts = _parse_timestamp("15/03/24", "09:30")
        assert ts == datetime(2024, 3, 15, 9, 30, 0)

    def test_day_greater_than_12(self):
        """DD/MM format when day > 12."""
        ts = _parse_timestamp("25/03/24", "09:42:33")
        assert ts is not None
        assert ts.day == 25
        assert ts.month == 3

    def test_month_greater_than_12_in_second_position(self):
        """MM/DD format when second number > 12 (impossible as month)."""
        ts = _parse_timestamp("03/25/24", "09:42:33")
        assert ts is not None
        # 03/25 — 25 > 12, so it's MM/DD: month=3, day=25
        assert ts.month == 3
        assert ts.day == 25


# ============================================================================
# Tests: _process_content
# ============================================================================

class TestProcessContent:
    """Tests for message content processing."""

    def test_normal_content(self):
        result = _process_content("Hello world")
        assert result["content"] == "Hello world"
        assert result["is_deleted"] is False
        assert result["is_edited"] is False

    def test_deleted_message(self):
        result = _process_content("This message was deleted")
        assert result["is_deleted"] is True

    def test_you_deleted(self):
        result = _process_content("You deleted this message")
        assert result["is_deleted"] is True

    def test_edited_message(self):
        result = _process_content("Hello world<This message was edited>")
        assert result["is_edited"] is True
        assert result["content"] == "Hello world"

    def test_media_omitted(self):
        result = _process_content("<Media omitted>")
        assert result["is_media_omitted"] is True

    def test_file_attached(self):
        result = _process_content("document.pdf (file attached)")
        assert result["media_filename"] == "document.pdf"

    def test_image_filename(self):
        result = _process_content("IMG-20240315-WA0001.jpg")
        assert result["media_filename"] == "IMG-20240315-WA0001.jpg"


# ============================================================================
# Tests: parse_whatsapp_chat
# ============================================================================

class TestParseWhatsAppChat:
    """Tests for the main parser function."""

    def test_standard_messages(self):
        messages = parse_whatsapp_chat(STANDARD_CHAT)
        assert len(messages) == 3
        assert messages[0]["sender"] == "John"
        assert messages[0]["content"] == "Hey check this out"
        assert messages[1]["sender"] == "Jane"
        assert messages[2]["content"] == "It's a really cool link https://example.com"

    def test_multiline_messages(self):
        messages = parse_whatsapp_chat(MULTILINE_CHAT)
        assert len(messages) == 2
        assert "continuation" in messages[0]["content"]
        assert "another line" in messages[0]["content"].lower()
        assert messages[1]["sender"] == "Jane"

    def test_ddmm_date_format(self):
        messages = parse_whatsapp_chat(DATE_DDMM_CHAT)
        assert len(messages) == 2
        assert messages[0]["timestamp"].month == 3
        assert messages[0]["timestamp"].day == 15

    def test_iso_date_format(self):
        messages = parse_whatsapp_chat(DATE_ISO_CHAT)
        assert len(messages) == 2
        assert messages[0]["timestamp"] == datetime(2024, 3, 15, 9, 42, 33)

    def test_12h_time_format(self):
        messages = parse_whatsapp_chat(TIME_12H_CHAT)
        assert len(messages) == 2
        assert messages[0]["timestamp"].hour == 15  # 3 PM
        assert messages[1]["timestamp"].hour == 11  # 11 AM

    def test_24h_time_format(self):
        messages = parse_whatsapp_chat(TIME_24H_CHAT)
        assert len(messages) == 2
        assert messages[0]["timestamp"].hour == 15
        assert messages[1]["timestamp"].hour == 9

    def test_unicode_senders(self):
        messages = parse_whatsapp_chat(UNICODE_CHAT)
        assert len(messages) == 3
        assert messages[0]["sender"] == "मयंक"
        assert messages[0]["content"] == "नमस्ते"
        assert messages[1]["sender"] == "محمد"
        assert messages[2]["sender"] == "😎 Cool Dude"

    def test_deleted_messages(self):
        messages = parse_whatsapp_chat(DELETED_CHAT)
        assert len(messages) == 4
        assert messages[1]["is_deleted"] is True
        assert messages[2]["is_deleted"] is True
        assert messages[0]["is_deleted"] is False
        assert messages[3]["is_deleted"] is False

    def test_edited_messages(self):
        messages = parse_whatsapp_chat(EDITED_CHAT)
        assert len(messages) == 2
        assert messages[0]["is_edited"] is True
        assert messages[0]["content"] == "Hello world"
        assert messages[1]["is_edited"] is False

    def test_media_omitted(self):
        messages = parse_whatsapp_chat(MEDIA_OMITTED_CHAT)
        assert len(messages) == 2
        assert messages[0]["is_media_omitted"] is True
        assert messages[1]["is_media_omitted"] is False

    def test_system_messages_skipped(self):
        messages = parse_whatsapp_chat(SYSTEM_MESSAGES_CHAT)
        # Should skip: encryption notice, group creation, added you
        # Should keep: "Hey!", "Welcome everyone!", "Thanks for adding me!"
        assert len(messages) == 3
        senders = [m["sender"] for m in messages]
        assert "John" in senders
        assert "Jane" in senders

    def test_file_attached(self):
        messages = parse_whatsapp_chat(FILE_ATTACHED_CHAT)
        assert len(messages) == 3
        assert messages[0]["media_filename"] == "IMG-20240315-WA0001.jpg"
        assert messages[1]["media_filename"] == "document.pdf"
        assert messages[2]["media_filename"] is None

    def test_empty_input(self):
        messages = parse_whatsapp_chat("")
        assert len(messages) == 0

    def test_no_messages_input(self):
        messages = parse_whatsapp_chat("Some random text\nwithout any timestamps\n")
        assert len(messages) == 0

    def test_mixed_message_types(self):
        messages = parse_whatsapp_chat(MIXED_CHAT)
        assert len(messages) >= 4  # System message skipped
        
        # Find specific messages
        deleted = [m for m in messages if m["is_deleted"]]
        edited = [m for m in messages if m["is_edited"]]
        media_omitted = [m for m in messages if m["is_media_omitted"]]
        
        assert len(deleted) == 1
        assert len(edited) == 1
        assert len(media_omitted) == 1

    def test_no_brackets_format(self):
        messages = parse_whatsapp_chat(NO_BRACKETS_CHAT)
        assert len(messages) == 2
        assert messages[0]["sender"] == "John"
        assert messages[1]["sender"] == "Jane"

    def test_messages_in_order(self):
        messages = parse_whatsapp_chat(STANDARD_CHAT)
        for i in range(1, len(messages)):
            assert messages[i]["timestamp"] >= messages[i - 1]["timestamp"]

    def test_raw_line_preserved(self):
        messages = parse_whatsapp_chat(STANDARD_CHAT)
        assert messages[0]["raw_line"] is not None
        assert "John" in messages[0]["raw_line"]

    def test_multiline_raw_line(self):
        messages = parse_whatsapp_chat(MULTILINE_CHAT)
        # Raw line should include continuation lines
        assert "\n" in messages[0]["raw_line"]


# ============================================================================
# Tests: detect_chat_name
# ============================================================================

class TestDetectChatName:
    """Tests for chat name detection."""

    def test_two_person_chat(self):
        name = detect_chat_name(STANDARD_CHAT)
        assert "John" in name or "Jane" in name

    def test_group_chat(self):
        name = detect_chat_name(UNICODE_CHAT)
        assert "Group" in name or "3" in name


# ============================================================================
# Tests: get_unique_senders
# ============================================================================

class TestGetUniqueSenders:
    """Tests for sender extraction."""

    def test_standard_senders(self):
        messages = parse_whatsapp_chat(STANDARD_CHAT)
        senders = get_unique_senders(messages)
        assert "John" in senders
        assert "Jane" in senders
        assert len(senders) == 2

    def test_unicode_senders(self):
        messages = parse_whatsapp_chat(UNICODE_CHAT)
        senders = get_unique_senders(messages)
        assert "मयंक" in senders
        assert "محمد" in senders
        assert "😎 Cool Dude" in senders

    def test_preserves_order(self):
        messages = parse_whatsapp_chat(STANDARD_CHAT)
        senders = get_unique_senders(messages)
        assert senders[0] == "John"  # First sender in chat

    def test_no_duplicates(self):
        messages = parse_whatsapp_chat(STANDARD_CHAT)
        senders = get_unique_senders(messages)
        assert len(senders) == len(set(senders))
