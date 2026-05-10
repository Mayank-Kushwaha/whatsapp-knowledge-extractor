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

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import MEDIA_DIR
from app.models.db import Chat, PipelineStatus, get_db
from app.tasks.pipeline import run_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chats", tags=["upload"])


@router.post("/upload")
async def upload_chat(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a WhatsApp chat export (.txt or .zip).
    
    - .txt files are parsed directly
    - .zip files are extracted; the .txt file inside is parsed,
      and media files are saved to data/media/<chat_id>/
    
    Returns the chat_id and processing status.
    """
    # Validate file type
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    
    if ext not in (".txt", ".zip"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Only .txt and .zip files are accepted."
        )
    
    # Read file content
    file_bytes = await file.read()
    
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    
    # Create chat record
    chat_name = Path(filename).stem or "Untitled Chat"
    chat = Chat(
        name=chat_name,
        type="personal",
        created_at=datetime.utcnow(),
        status="processing",
    )
    db.add(chat)
    db.flush()
    chat_id = chat.id
    
    # Create pipeline status
    pipeline_status = PipelineStatus(
        chat_id=chat_id,
        current_step=0,
        steps_complete=0,
        steps_total=10,
        updated_at=datetime.utcnow(),
    )
    db.add(pipeline_status)
    db.commit()
    
    # Process the file
    chat_text: str = ""
    media_dir = MEDIA_DIR / str(chat_id)
    media_dir.mkdir(parents=True, exist_ok=True)
    
    if ext == ".txt":
        # Direct .txt file
        try:
            chat_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            # Try other encodings common in WhatsApp exports
            for encoding in ["utf-8-sig", "latin-1", "cp1252"]:
                try:
                    chat_text = file_bytes.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Could not decode the file. Please ensure it's a valid text file."
                )
    
    elif ext == ".zip":
        # Extract zip file
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_path = os.path.join(temp_dir, "upload.zip")
                with open(zip_path, "wb") as f:
                    f.write(file_bytes)
                
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(temp_dir)
                
                # Find the .txt file
                txt_files = []
                for root, dirs, files in os.walk(temp_dir):
                    for f_name in files:
                        f_path = os.path.join(root, f_name)
                        if f_name.lower().endswith(".txt") and f_name != "upload.zip":
                            txt_files.append(f_path)
                
                if not txt_files:
                    raise HTTPException(
                        status_code=400,
                        detail="No .txt file found in the zip archive."
                    )
                
                # Read the first/largest txt file
                txt_file = max(txt_files, key=lambda p: os.path.getsize(p))
                
                try:
                    with open(txt_file, "r", encoding="utf-8") as f:
                        chat_text = f.read()
                except UnicodeDecodeError:
                    for encoding in ["utf-8-sig", "latin-1", "cp1252"]:
                        try:
                            with open(txt_file, "r", encoding=encoding) as f:
                                chat_text = f.read()
                            break
                        except UnicodeDecodeError:
                            continue
                
                # Copy media files to data/media/<chat_id>/
                media_extensions = {
                    ".jpg", ".jpeg", ".png", ".webp", ".gif",
                    ".mp4", ".mov", ".avi", ".3gp", ".mkv",
                    ".mp3", ".m4a", ".ogg", ".opus", ".aac", ".wav",
                    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".pptx",
                    ".vcf",
                }
                for root, dirs, files in os.walk(temp_dir):
                    for f_name in files:
                        f_ext = Path(f_name).suffix.lower()
                        if f_ext in media_extensions:
                            src = os.path.join(root, f_name)
                            dst = media_dir / f_name
                            shutil.copy2(src, str(dst))
                            logger.info(f"Extracted media: {f_name} → {dst}")
                            
        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=400,
                detail="Invalid zip file. Please upload a valid .zip archive."
            )
    
    if not chat_text:
        raise HTTPException(status_code=400, detail="Could not extract text content from the uploaded file.")
    
    # Kick off background processing
    background_tasks.add_task(
        run_pipeline,
        chat_id=chat_id,
        chat_text=chat_text,
        media_dir=str(media_dir),
    )
    
    logger.info(f"Upload complete for chat {chat_id} ({filename}). Pipeline started.")
    
    return {
        "chat_id": chat_id,
        "name": chat_name,
        "status": "processing",
        "message": "File uploaded successfully. Processing has started.",
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
    # Verify chat exists
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
            # Use a fresh session for each poll
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
                
                # Check if complete or error
                if chat_obj.status in ("ready", "error"):
                    break
                
            finally:
                poll_db.close()
            
            await asyncio.sleep(0.5)  # Poll every 500ms
    
    # Need to import SessionLocal here since it's used in the generator
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
