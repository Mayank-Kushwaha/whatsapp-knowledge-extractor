"""FastAPI application entry point with CORS and health endpoint."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import ALLOWED_ORIGINS, ALLOWED_ORIGIN_REGEX, MEDIA_DIR

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — runs on startup and shutdown."""
    # Startup: ensure media directory exists
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="WhatsApp Knowledge Extractor",
    description="Transform WhatsApp chat exports into an organized, searchable knowledge base.",
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Include API routers
# ---------------------------------------------------------------------------
from app.api.upload import router as upload_router
from app.api.chats import router as chats_router
from app.api.messages import router as messages_router
from app.api.links import router as links_router
from app.api.important import router as important_router
from app.api.media import router as media_router
from app.api.clusters import router as clusters_router
from app.api.search import router as search_router
from app.api.graph import router as graph_router
from app.api.export import router as export_router

app.include_router(upload_router)
app.include_router(chats_router)
app.include_router(messages_router)
app.include_router(links_router)
app.include_router(important_router)
app.include_router(media_router)
app.include_router(clusters_router)
app.include_router(search_router)
app.include_router(graph_router)
app.include_router(export_router)

# ---------------------------------------------------------------------------
# CORS — allow frontend origin
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# ---------------------------------------------------------------------------
# Static file serving for media
# ---------------------------------------------------------------------------
# Ensure the directory exists before StaticFiles tries to validate it.
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------
@app.get("/health", tags=["system"])
async def health_check():
    """Health check endpoint to verify the API is running."""
    return {
        "status": "healthy",
        "service": "whatsapp-knowledge-extractor",
        "version": "0.1.0",
    }


@app.get("/api/health", tags=["system"])
async def api_health_check():
    """API health check endpoint (prefixed)."""
    return {
        "status": "healthy",
        "service": "whatsapp-knowledge-extractor",
        "version": "0.1.0",
    }
