"""FastAPI application entry point with CORS and health endpoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import FRONTEND_ORIGIN, MEDIA_DIR


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
# CORS — allow frontend origin
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_ORIGIN,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static file serving for media
# ---------------------------------------------------------------------------
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
