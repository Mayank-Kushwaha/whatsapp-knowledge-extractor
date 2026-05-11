"""Message type classifier — classifies messages by content type.

Detects:
  - URLs with sub-classification (YouTube, Drive, Amazon, Twitter, news, generic)
  - File extensions (images, videos, PDFs, docs, audio, contacts)
  - Location (Google Maps links, "Location:" pattern)
  - Sets `type` field on every message
  - Creates `links` table rows for URL messages
  - Creates `media_items` table rows for media messages
"""

import logging
import os
import re
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models.db import Link, MediaItem, Message

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# URL detection regex
# ---------------------------------------------------------------------------

_URL_PATTERN = re.compile(
    r'https?://[^\s<>"\')\]]+',
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Domain sub-classification
# ---------------------------------------------------------------------------

_YOUTUBE_DOMAINS = {"youtube.com", "youtu.be", "m.youtube.com", "www.youtube.com"}
_DRIVE_DOMAINS = {"drive.google.com", "docs.google.com", "sheets.google.com", "slides.google.com"}
_AMAZON_DOMAINS = {
    "amazon.com", "amazon.in", "amazon.co.uk", "amazon.de", "amazon.fr",
    "amazon.co.jp", "amazon.ca", "amazon.com.au", "amazon.com.br",
    "amzn.to", "amzn.com",
    "www.amazon.com", "www.amazon.in", "www.amazon.co.uk",
}
_TWITTER_DOMAINS = {"twitter.com", "x.com", "t.co", "www.twitter.com", "www.x.com"}
_MAPS_DOMAINS = {"maps.google.com", "goo.gl/maps", "maps.app.goo.gl", "www.google.com/maps"}
_NEWS_DOMAINS = {
    "bbc.com", "bbc.co.uk", "cnn.com", "reuters.com", "nytimes.com",
    "theguardian.com", "aljazeera.com", "washingtonpost.com",
    "thehindu.com", "ndtv.com", "indianexpress.com", "hindustantimes.com",
    "timesofindia.indiatimes.com", "news.google.com",
    "apnews.com", "bloomberg.com", "cnbc.com",
}

# ---------------------------------------------------------------------------
# File extension classifications
# ---------------------------------------------------------------------------

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".svg", ".heic"}
_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".3gp", ".mkv", ".wmv", ".flv", ".webm"}
_AUDIO_EXTENSIONS = {".mp3", ".m4a", ".ogg", ".opus", ".aac", ".wav", ".wma", ".flac"}
_PDF_EXTENSIONS = {".pdf"}
_DOCUMENT_EXTENSIONS = {".doc", ".docx", ".xls", ".xlsx", ".pptx", ".ppt", ".txt", ".csv", ".rtf", ".odt", ".ods", ".odp"}
_CONTACT_EXTENSIONS = {".vcf"}

# MIME type mapping for common extensions
_MIME_TYPES: dict[str, str] = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp",
    ".svg": "image/svg+xml", ".heic": "image/heic",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo",
    ".3gp": "video/3gpp", ".mkv": "video/x-matroska", ".webm": "video/webm",
    ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
    ".opus": "audio/opus", ".aac": "audio/aac", ".wav": "audio/wav",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".vcf": "text/vcard",
}

# ---------------------------------------------------------------------------
# Location detection
# ---------------------------------------------------------------------------

_LOCATION_PATTERN = re.compile(
    r'(?:location:|live location|https?://maps\.google\.com|https?://goo\.gl/maps|https?://maps\.app\.goo\.gl)',
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Media filename pattern (from parser)
# ---------------------------------------------------------------------------

_MEDIA_FILENAME_PATTERN = re.compile(
    r'^([\w\-]+\.(jpg|jpeg|png|webp|gif|mp4|mov|avi|mp3|m4a|ogg|opus|pdf|docx?|xlsx?|pptx?|txt|vcf|3gp|mkv|aac|wav|csv))\s*(?:\(file attached\))?$',
    re.IGNORECASE,
)

_FILE_ATTACHED_PATTERN = re.compile(
    r'^(.+?)\s*\(file attached\)\s*$', re.IGNORECASE
)


# ---------------------------------------------------------------------------
# Classification functions
# ---------------------------------------------------------------------------

def classify_url(url: str) -> str:
    """Classify a URL into a sub-type based on domain.
    
    Returns: youtube | drive | amazon | twitter | maps | news | generic
    """
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # Remove www. prefix for comparison
        bare_domain = domain.lstrip("www.")
        full_domain = domain
    except Exception:
        return "generic"
    
    if full_domain in _YOUTUBE_DOMAINS or bare_domain in _YOUTUBE_DOMAINS:
        return "youtube"
    if full_domain in _DRIVE_DOMAINS or bare_domain in _DRIVE_DOMAINS:
        return "drive"
    if full_domain in _AMAZON_DOMAINS or bare_domain in _AMAZON_DOMAINS:
        return "amazon"
    if full_domain in _TWITTER_DOMAINS or bare_domain in _TWITTER_DOMAINS:
        return "twitter"
    if full_domain in _MAPS_DOMAINS or bare_domain in _MAPS_DOMAINS:
        return "maps"
    
    # Check news domains (also check if the bare domain matches)
    for news_domain in _NEWS_DOMAINS:
        if bare_domain == news_domain or full_domain == news_domain:
            return "news"
        if bare_domain.endswith("." + news_domain) or full_domain.endswith("." + news_domain):
            return "news"
    
    # Check if it's a Google Drive PDF link
    if "drive.google.com" in full_domain and "/file/" in url:
        return "drive"
    
    return "generic"


def get_file_extension(filename: str) -> str:
    """Get lowercased file extension from a filename."""
    _, ext = os.path.splitext(filename)
    return ext.lower()


def classify_by_extension(ext: str) -> str:
    """Classify a message type by file extension.
    
    Returns: image | video | audio | pdf | document | contact | unknown_media
    """
    if ext in _IMAGE_EXTENSIONS:
        return "image"
    if ext in _VIDEO_EXTENSIONS:
        return "video"
    if ext in _AUDIO_EXTENSIONS:
        return "audio"
    if ext in _PDF_EXTENSIONS:
        return "pdf"
    if ext in _DOCUMENT_EXTENSIONS:
        return "document"
    if ext in _CONTACT_EXTENSIONS:
        return "contact"
    return "unknown_media"


def extract_urls(content: str) -> list[str]:
    """Extract all URLs from message content."""
    return _URL_PATTERN.findall(content)


def extract_filename(content: str) -> Optional[str]:
    """Extract a media filename from message content.
    
    Handles patterns like:
      - "IMG-20240315-WA0001.jpg (file attached)"
      - "document.pdf"
    """
    content = content.strip()
    
    # Try "filename (file attached)" pattern first
    match = _FILE_ATTACHED_PATTERN.match(content)
    if match:
        return match.group(1).strip()
    
    # Try bare filename pattern
    match = _MEDIA_FILENAME_PATTERN.match(content)
    if match:
        return match.group(1).strip()
    
    return None


def classify_message(content: str, media_filename: Optional[str] = None) -> dict:
    """Classify a single message by analyzing its content.
    
    Args:
        content: The message text content
        media_filename: Optional filename if the parser already detected a media file
        
    Returns:
        Dict with:
          - type: str (text|link|image|video|audio|pdf|document|contact|location)
          - urls: list[str] (extracted URLs)
          - link_type: Optional[str] (youtube|drive|amazon|twitter|maps|news|generic)
          - filename: Optional[str] (detected media filename)
          - file_ext: Optional[str] (file extension)
    """
    result: dict = {
        "type": "text",
        "urls": [],
        "link_type": None,
        "filename": media_filename,
        "file_ext": None,
    }
    
    # 1. Check for location patterns first
    if _LOCATION_PATTERN.search(content):
        # Check if it's a maps URL
        urls = extract_urls(content)
        for url in urls:
            url_type = classify_url(url)
            if url_type == "maps":
                result["type"] = "location"
                result["urls"] = urls
                result["link_type"] = "maps"
                return result
        
        # Text-based location mention
        if "location:" in content.lower() or "live location" in content.lower():
            result["type"] = "location"
            return result
    
    # 2. Check for media filename (from parser or content)
    filename = media_filename or extract_filename(content)
    if filename:
        ext = get_file_extension(filename)
        result["filename"] = filename
        result["file_ext"] = ext
        result["type"] = classify_by_extension(ext)
        
        # YouTube video links in filename won't have ext, so check URL in content too
        urls = extract_urls(content)
        if urls:
            result["urls"] = urls
        
        return result
    
    # 3. Check for URLs
    urls = extract_urls(content)
    if urls:
        result["urls"] = urls
        
        # Classify by the first URL
        primary_url = urls[0]
        url_type = classify_url(primary_url)
        result["link_type"] = url_type
        
        # YouTube links are videos
        if url_type == "youtube":
            result["type"] = "video"
        # Google Drive links — check if it's a PDF or doc
        elif url_type == "drive":
            # Check URL for file type hints
            lower_url = primary_url.lower()
            if any(ext in lower_url for ext in [".pdf", "/pdf"]):
                result["type"] = "pdf"
            elif any(ext in lower_url for ext in ["spreadsheet", "sheets.google.com"]):
                result["type"] = "document"
            elif any(ext in lower_url for ext in ["presentation", "slides.google.com"]):
                result["type"] = "document"
            else:
                result["type"] = "link"
        else:
            result["type"] = "link"
        
        return result
    
    # 4. Default: plain text
    result["type"] = "text"
    return result


# ---------------------------------------------------------------------------
# Batch classification + DB row creation
# ---------------------------------------------------------------------------

def classify_and_enrich_messages(
    db: Session,
    chat_id: int,
    media_dir: Optional[str] = None,
) -> dict:
    """Classify all messages for a chat and create Link/MediaItem rows.
    
    This is Step 2 of the pipeline.
    
    Args:
        db: Database session
        chat_id: ID of the chat to process
        media_dir: Path to the media directory for this chat
        
    Returns:
        Dict with classification statistics
    """
    messages = db.query(Message).filter(Message.chat_id == chat_id).all()
    
    stats = {
        "total": len(messages),
        "text": 0,
        "link": 0,
        "image": 0,
        "video": 0,
        "audio": 0,
        "pdf": 0,
        "document": 0,
        "contact": 0,
        "location": 0,
        "deleted": 0,
        "unknown_media": 0,
        "links_created": 0,
        "media_items_created": 0,
    }
    
    for msg in messages:
        # Skip deleted and already-typed messages
        if msg.type == "deleted":
            stats["deleted"] += 1
            continue
        
        # Classify the message
        classification = classify_message(
            content=msg.content,
            media_filename=None,  # We'll check the content itself
        )
        
        # Handle messages already typed as "media" or "unknown_media" from parser
        if msg.type == "unknown_media":
            stats["unknown_media"] += 1
            continue
        
        # If the parser already set type to "media", try to refine it
        if msg.type == "media":
            # Try to get filename from content
            filename = extract_filename(msg.content)
            if filename:
                ext = get_file_extension(filename)
                classification["type"] = classify_by_extension(ext)
                classification["filename"] = filename
                classification["file_ext"] = ext
            else:
                classification["type"] = "unknown_media"
        
        new_type = classification["type"]
        
        # Update message type
        msg.type = new_type
        stats[new_type] = stats.get(new_type, 0) + 1
        
        # Create Link rows for URL messages
        if classification["urls"]:
            for url in classification["urls"]:
                try:
                    parsed_url = urlparse(url)
                    domain = parsed_url.netloc.lower()
                except Exception:
                    domain = ""
                
                link_type = classify_url(url)
                
                link = Link(
                    message_id=msg.id,
                    url=url,
                    domain=domain,
                    link_type=link_type,
                )
                db.add(link)
                stats["links_created"] += 1
        
        # Create MediaItem rows for media messages
        if new_type in ("image", "video", "audio", "pdf", "document", "contact"):
            filename = classification.get("filename")
            ext = classification.get("file_ext", "")
            
            # Determine local path if the file exists in media_dir
            local_path = None
            file_size = None
            if filename and media_dir:
                candidate = os.path.join(media_dir, filename)
                if os.path.exists(candidate):
                    local_path = candidate
                    file_size = os.path.getsize(candidate)
            
            media_item = MediaItem(
                message_id=msg.id,
                chat_id=chat_id,
                type=new_type,
                original_filename=filename,
                local_path=local_path,
                mime_type=_MIME_TYPES.get(ext, ""),
                file_size_bytes=file_size,
            )
            db.add(media_item)
            stats["media_items_created"] += 1
    
    db.commit()
    
    logger.info(
        f"[Classifier] Chat {chat_id}: classified {stats['total']} messages — "
        f"text={stats['text']}, link={stats['link']}, image={stats['image']}, "
        f"video={stats['video']}, audio={stats['audio']}, pdf={stats['pdf']}, "
        f"doc={stats['document']}, contact={stats['contact']}, "
        f"location={stats['location']}, deleted={stats['deleted']}, "
        f"links_created={stats['links_created']}, media_created={stats['media_items_created']}"
    )
    
    return stats
