"""Open Graph metadata fetcher — fetches title, description, image from URLs.

Uses httpx for async HTTP requests with rate limiting (~1 req/sec).
Gracefully handles timeouts, blocked requests, and invalid URLs.
"""

import asyncio
import logging
import re
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.models.db import Link

logger = logging.getLogger(__name__)

_REQUEST_TIMEOUT = 10.0
_RATE_LIMIT_DELAY = 1.0
_MAX_CONTENT_LENGTH = 500_000
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


class OGMetadata:
    """Open Graph metadata for a URL."""
    def __init__(self, title: Optional[str] = None, description: Optional[str] = None, image_url: Optional[str] = None):
        self.title = title
        self.description = description
        self.image_url = image_url


def _get_meta_content(soup: BeautifulSoup, value: str, property_attr: str = "property") -> Optional[str]:
    tag = soup.find("meta", attrs={property_attr: value})
    if tag and tag.get("content"):
        return tag["content"].strip()
    tag = soup.find("meta", attrs={property_attr: re.compile(f"^{re.escape(value)}$", re.IGNORECASE)})
    if tag and tag.get("content"):
        return tag["content"].strip()
    return None


def _extract_og_from_html(html: str, base_url: str) -> OGMetadata:
    """Extract Open Graph metadata from HTML, with fallbacks to standard meta tags."""
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return OGMetadata()

    og_title = _get_meta_content(soup, "og:title")
    og_desc = _get_meta_content(soup, "og:description")
    og_image = _get_meta_content(soup, "og:image")

    if not og_title:
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            og_title = title_tag.string.strip()
    if not og_desc:
        og_desc = _get_meta_content(soup, "description", property_attr="name")
    if not og_title:
        og_title = _get_meta_content(soup, "twitter:title", property_attr="name")
    if not og_desc:
        og_desc = _get_meta_content(soup, "twitter:description", property_attr="name")
    if not og_image:
        og_image = _get_meta_content(soup, "twitter:image", property_attr="name")

    # Resolve relative image URLs
    if og_image and not og_image.startswith(("http://", "https://")):
        try:
            parsed = urlparse(base_url)
            if og_image.startswith("//"):
                og_image = f"{parsed.scheme}:{og_image}"
            elif og_image.startswith("/"):
                og_image = f"{parsed.scheme}://{parsed.netloc}{og_image}"
        except Exception:
            pass

    if og_title and len(og_title) > 500:
        og_title = og_title[:497] + "..."
    if og_desc and len(og_desc) > 2000:
        og_desc = og_desc[:1997] + "..."

    return OGMetadata(title=og_title, description=og_desc, image_url=og_image)


async def fetch_og_metadata(url: str) -> Optional[OGMetadata]:
    """Fetch Open Graph metadata for a single URL."""
    try:
        async with httpx.AsyncClient(
            timeout=_REQUEST_TIMEOUT, follow_redirects=True,
            headers={"User-Agent": _USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
            verify=False,
        ) as client:
            response = await client.get(url)
            if response.status_code != 200:
                return None
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                return None
            html = response.text[:_MAX_CONTENT_LENGTH]
            return _extract_og_from_html(html, url)
    except Exception:
        return None


async def _fetch_batch(links: list[Link]) -> dict[int, OGMetadata]:
    results: dict[int, OGMetadata] = {}
    for link in links:
        if link.og_title:
            continue
        metadata = await fetch_og_metadata(link.url)
        if metadata:
            results[link.id] = metadata
        await asyncio.sleep(_RATE_LIMIT_DELAY)
    return results


def fetch_and_store_og_metadata(db: Session, chat_id: int) -> int:
    """Fetch OG metadata for all links in a chat and store in DB (Step 3)."""
    links = (
        db.query(Link).join(Link.message)
        .filter(Link.message.has(chat_id=chat_id))
        .filter(Link.og_title.is_(None)).all()
    )
    if not links:
        logger.info(f"[OG Fetch] Chat {chat_id}: No links to enrich")
        return 0

    logger.info(f"[OG Fetch] Chat {chat_id}: Fetching OG for {len(links)} links")

    try:
        results = asyncio.run(_fetch_batch(links))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        results = loop.run_until_complete(_fetch_batch(links))
        loop.close()

    enriched = 0
    for link_id, metadata in results.items():
        link = db.query(Link).get(link_id)
        if link:
            link.og_title = metadata.title
            link.og_description = metadata.description
            link.og_image_url = metadata.image_url
            enriched += 1
    db.commit()

    logger.info(f"[OG Fetch] Chat {chat_id}: Enriched {enriched}/{len(links)} links")
    return enriched
