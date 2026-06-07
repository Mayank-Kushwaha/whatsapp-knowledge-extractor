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
# Turso (libSQL) is used when both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are
# set — this is the production setup on Render free tier where the local fs
# is ephemeral. Otherwise we fall back to a local SQLite file so dev still
# works offline. libSQL is wire-compatible with SQLite: schema, FTS5 virtual
# tables, and Alembic migrations all run unchanged.
TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL", "").strip()
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "").strip()

if TURSO_DATABASE_URL and TURSO_AUTH_TOKEN:
    # sqlalchemy-libsql 0.2.0 prefers receiving the auth token via
    # connect_args rather than the URL query string — the URL form has
    # been observed to silently drop the token, which surfaces as the
    # server-side error: `Unauthorized: empty JWT token`.
    # We keep a clean URL here and pass `auth_token` separately from
    # app/models/db.py.
    _host = (
        TURSO_DATABASE_URL.replace("libsql://", "")
        .replace("https://", "")
        .replace("wss://", "")
        .strip("/")
    )
    DATABASE_URL = f"sqlite+libsql://{_host}/?secure=true"
    USING_TURSO = True
else:
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    USING_TURSO = False

# Media storage backend.
#   "local"      → write to MEDIA_DIR on disk, serve via /media StaticFiles
#   "cloudinary" → upload to Cloudinary, store full https URL on media_items.local_path
# Default "local" keeps existing dev behaviour. Render free tier should set
# MEDIA_BACKEND=cloudinary because /data is not persistent without a paid disk.
MEDIA_BACKEND = os.getenv("MEDIA_BACKEND", "local").lower()
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

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

# Regex for dynamic origins like Vercel preview deploys (each PR gets its own
# unique *.vercel.app subdomain). Set ALLOWED_ORIGIN_REGEX to override; default
# matches any vercel.app subdomain so preview deploys don't break CORS.
ALLOWED_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"https://.*\.vercel\.app",
)

# LLM
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")  # "gemini" or "ollama"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

# Auth — Google OAuth 2.0 Client ID issued in Google Cloud Console.
# This is the audience claim the backend verifies on incoming Google ID
# tokens. Must match the GOOGLE_CLIENT_ID configured in the frontend's
# NextAuth Google provider.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# Embedding
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "64"))

# Embedding provider: "gemini" uses Google's hosted embedding API
# (gemini-embedding-001); "local" uses a CPU-resident sentence-transformers
# model. Local is free with no quotas but needs ~500MB of RAM for the model
# and PyTorch, so it's intended for development. On Render free tier (512MB
# RAM) keep this set to "gemini" or upgrade the plan.
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "gemini").lower()

# Ensure directories exist at runtime.
# Wrapped in try/except so that importing this module during the build phase
# (e.g. when Alembic runs migrations) doesn't crash on a read-only filesystem
# such as Render's build environment before the persistent disk is mounted.
try:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    pass
