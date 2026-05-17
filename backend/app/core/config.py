"""Application configuration loaded from environment variables."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
MEDIA_DIR = Path(os.getenv("MEDIA_DIR", str(DATA_DIR / "media")))
DB_PATH = os.getenv("DB_PATH", str(DATA_DIR / "knowledge.db"))

# Database
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Server
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "3000"))

# CORS — supports multiple origins via comma-separated FRONTEND_ORIGIN env var.
# In production set: FRONTEND_ORIGIN=https://your-app.vercel.app
# Locally it falls back to localhost:3000.
_raw_origins = os.getenv("FRONTEND_ORIGIN", f"http://localhost:{FRONTEND_PORT}")
FRONTEND_ORIGIN = _raw_origins  # kept for backward-compat imports
ALLOWED_ORIGINS: list[str] = [
    o.strip() for o in _raw_origins.split(",") if o.strip()
]

# Always include localhost variants so local dev still works even when
# FRONTEND_ORIGIN is set to a production URL.
_local_defaults = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
for _origin in _local_defaults:
    if _origin not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(_origin)

# LLM
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")  # "gemini" or "ollama"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

# Embedding
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "64"))

# Ensure directories exist at runtime.
# Wrapped in try/except so that importing this module during the build phase
# (e.g. when Alembic runs migrations) doesn't crash on a read-only filesystem
# such as Render's build environment before the persistent disk is mounted.
try:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    pass
