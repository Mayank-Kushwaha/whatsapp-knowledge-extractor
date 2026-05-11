"""PDF text extractor via PyMuPDF — extracts first 2000 chars from PDFs.

Step 4 of the pipeline. Processes all PDF media items for a chat.
"""

import logging
import os
from typing import Optional

from sqlalchemy.orm import Session

from app.models.db import MediaItem

logger = logging.getLogger(__name__)

_MAX_CHARS = 2000


def extract_pdf_text(file_path: str, max_chars: int = _MAX_CHARS) -> Optional[str]:
    """Extract text from a PDF file using PyMuPDF.
    
    Args:
        file_path: Absolute path to the PDF file
        max_chars: Maximum characters to extract
        
    Returns:
        Extracted text (up to max_chars), or None if extraction fails
    """
    if not os.path.exists(file_path):
        logger.warning(f"[PDF] File not found: {file_path}")
        return None
    
    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(file_path)
        text_parts: list[str] = []
        total_chars = 0
        
        for page in doc:
            page_text = page.get_text("text")
            if page_text:
                text_parts.append(page_text.strip())
                total_chars += len(page_text)
                if total_chars >= max_chars:
                    break
        
        doc.close()
        
        full_text = "\n\n".join(text_parts)
        if len(full_text) > max_chars:
            full_text = full_text[:max_chars]
        
        return full_text if full_text.strip() else None
        
    except ImportError:
        logger.error("[PDF] PyMuPDF (fitz) not installed. Install with: pip install pymupdf")
        return None
    except Exception as e:
        logger.error(f"[PDF] Error extracting text from {file_path}: {e}")
        return None


def extract_pdfs_for_chat(db: Session, chat_id: int) -> int:
    """Extract text from all PDF media items in a chat.
    
    This is Step 4 of the pipeline.
    
    Returns:
        Number of PDFs successfully extracted
    """
    pdf_items = (
        db.query(MediaItem)
        .filter(MediaItem.chat_id == chat_id, MediaItem.type == "pdf")
        .filter(MediaItem.extracted_text.is_(None))
        .all()
    )
    
    if not pdf_items:
        logger.info(f"[PDF] Chat {chat_id}: No PDFs to extract")
        return 0
    
    logger.info(f"[PDF] Chat {chat_id}: Extracting text from {len(pdf_items)} PDFs")
    
    extracted = 0
    for item in pdf_items:
        if not item.local_path:
            continue
        
        text = extract_pdf_text(item.local_path)
        if text:
            item.extracted_text = text
            extracted += 1
            logger.debug(f"[PDF] Extracted {len(text)} chars from {item.original_filename}")
    
    db.commit()
    logger.info(f"[PDF] Chat {chat_id}: Extracted text from {extracted}/{len(pdf_items)} PDFs")
    return extracted
