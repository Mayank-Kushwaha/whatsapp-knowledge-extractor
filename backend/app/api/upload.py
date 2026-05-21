"""Upload API routes — handles .txt and .zip WhatsApp exports.

POST /api/chats/upload   — Upload a .txt or .zip file
GET  /api/chats/{id}/progress — SSE endpoint for pipeline progress
"""

import logging
import os
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import MEDIA_DIR
from app.models.db import Chat, PipelineStatus, get_db
from app.tasks.pipeline import run_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chats", tags=["upload"])


MEDIA_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif",
    ".mp4", ".mov", ".avi", ".3gp", ".mkv",
    ".mp3", ".m4a", ".ogg", ".opus", ".aac", ".wav",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".pptx",
    ".vcf",
}


def _decode_chat_bytes(file_bytes: bytes) -> str:
    """Decode uploaded text content using common WhatsApp export encodings."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        for encoding in ["utf-8-sig", "latin-1", "cp1252"]:
            try:
                return file_bytes.decode(encoding)
            except UnicodeDecodeError:
                continue
    raise HTTPException(
        status_code=400,
        detail="Could not decode the file. Please ensure it's a valid text file.",
    )


def _extract_zip_contents(file_bytes: bytes, media_dir: Path) -> str:
    """Extract chat text and media files from a zip upload."""
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, "upload.zip")
            with open(zip_path, "wb") as f:
                f.write(file_bytes)

            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(temp_dir)

            txt_files = []
            for root, _, files in os.walk(temp_dir):
                for f_name in files:
                    f_path = os.path.join(root, f_name)
                    if f_name.lower().endswith(".txt") and f_name != "upload.zip":
                        txt_files.append(f_path)

            if not txt_files:
                raise HTTPException(
                    status_code=400,
                    detail="No .txt file found in the zip archive.",
                )

            txt_file = max(txt_files, key=lambda p: os.path.getsize(p))

            chat_text = ""
            for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
                try:
                    with open(txt_file, "r", encoding=encoding) as f:
                        chat_text = f.read()
                    break
                except UnicodeDecodeError:
                    continue

            for root, _, files in os.walk(temp_dir):
                for f_name in files:
                    f_ext = Path(f_name).suffix.lower()
                    if f_ext in MEDIA_EXTENSIONS:
                        src = os.path.join(root, f_name)
                        dst = media_dir / f_name
                        shutil.copy2(src, str(dst))
                        logger.info(f"Extracted media: {f_name} → {dst}")

            return chat_text
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=400,
            detail="Invalid zip file. Please upload a valid .zip archive.",
        )


def _clear_chat_data(db: Session, chat_id: int) -> None:
    """Remove all derived data for a chat while preserving the chat row itself."""
    db.execute(
        text(
            """
            DELETE FROM messages_fts
            WHERE rowid IN (
                SELECT id FROM messages WHERE chat_id = :chat_id
            )
            """
        ),
        {"chat_id": chat_id},
    )
    db.execute(text("DELETE FROM senders WHERE chat_id = :chat_id"), {"chat_id": chat_id})
    db.execute(text("DELETE FROM clusters WHERE chat_id = :chat_id"), {"chat_id": chat_id})
    db.execute(text("DELETE FROM pipeline_status WHERE chat_id = :chat_id"), {"chat_id": chat_id})
    db.execute(text("DELETE FROM messages WHERE chat_id = :chat_id"), {"chat_id": chat_id})
    db.commit()


@router.post("/upload")
async def upload_chat(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    chat_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload a WhatsApp chat export (.txt or .zip).

    - .txt files are parsed directly
    - .zip files are extracted; the .txt file inside is parsed,
      and media files are saved to data/media/<chat_id>/
    - If chat_id is provided, the existing chat is replaced and reprocessed

    Returns the chat_id and processing status.
    """
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()

    if ext not in (".txt", ".zip"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Only .txt and .zip files are accepted.",
        )

    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    is_update = chat_id is not None
    chat_name = Path(filename).stem or "Untitled Chat"

    if is_update:
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        media_dir = MEDIA_DIR / str(chat.id)
        if media_dir.exists():
            shutil.rmtree(media_dir, ignore_errors=True)
        media_dir.mkdir(parents=True, exist_ok=True)

        _clear_chat_data(db, chat.id)

        chat.name = chat_name
        chat.type = "personal"
        chat.message_count = 0
        chat.date_range_start = None
        chat.date_range_end = None
        chat.status = "processing"
        db.add(chat)
        resolved_chat_id = chat.id
    else:
        chat = Chat(
            name=chat_name,
            type="personal",
            created_at=datetime.utcnow(),
            status="processing",
        )
        db.add(chat)
        db.flush()
        resolved_chat_id = chat.id
        media_dir = MEDIA_DIR / str(resolved_chat_id)
        media_dir.mkdir(parents=True, exist_ok=True)

    pipeline_status = PipelineStatus(
        chat_id=resolved_chat_id,
        current_step=0,
        steps_complete=0,
        steps_total=10,
        updated_at=datetime.utcnow(),
    )
    db.add(pipeline_status)
    db.commit()

    chat_text: str = ""

    if ext == ".txt":
        chat_text = _decode_chat_bytes(file_bytes)
    elif ext == ".zip":
        chat_text = _extract_zip_contents(file_bytes, media_dir)

    if not chat_text:
        raise HTTPException(status_code=400, detail="Could not extract text content from the uploaded file.")

    background_tasks.add_task(
        run_pipeline,
        chat_id=resolved_chat_id,
        chat_text=chat_text,
        media_dir=str(media_dir),
    )

    logger.info(
        f"Upload complete for chat {resolved_chat_id} ({filename}). "
        f"Pipeline started. Update mode={is_update}"
    )

    return {
        "chat_id": resolved_chat_id,
        "name": chat_name,
        "status": "processing",
        "message": "Chat updated successfully. Reprocessing has started." if is_update else "File uploaded successfully. Processing has started.",
    }


@router.get("/{chat_id}/progress")
async def stream_progress(
    chat_id: int,
    db: Session = Depends(get_db),
):
    """SSE endpoint to stream pipeline progress for a chat.

    Sends events like:
      data: {"step": 1, "step_name": "Parsing messages", "steps_complete": 0, "steps_total": 10, "status": "processing"}

    Final event:
      data: {"step": 10, "step_name": "Complete", "steps_complete": 10, "steps_total": 10, "status": "ready"}
    """
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    import asyncio
    import json

    from app.tasks.pipeline import PIPELINE_STEPS

    async def event_generator():
        """Generate SSE events by polling pipeline_status."""
        last_step = -1

        while True:
            poll_db = SessionLocal()
            try:
                status = poll_db.query(PipelineStatus).filter(
                    PipelineStatus.chat_id == chat_id
                ).first()

                chat_obj = poll_db.query(Chat).filter(Chat.id == chat_id).first()

                if not status or not chat_obj:
                    yield f"data: {json.dumps({'error': 'Status not found'})}\n\n"
                    break

                current_step = status.current_step

                if current_step != last_step:
                    last_step = current_step
                    step_name = PIPELINE_STEPS.get(current_step, f"Step {current_step}")

                    event_data = {
                        "step": current_step,
                        "step_name": step_name,
                        "steps_complete": status.steps_complete,
                        "steps_total": status.steps_total,
                        "status": chat_obj.status,
                    }

                    if status.error:
                        event_data["error"] = status.error

                    yield f"data: {json.dumps(event_data)}\n\n"

                if chat_obj.status in ("ready", "error"):
                    break

            finally:
                poll_db.close()

            await asyncio.sleep(0.5)

    from app.models.db import SessionLocal

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
