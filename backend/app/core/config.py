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
FRONTEND_ORIGIN = f"http://localhost:{FRONTEND_PORT}"

# LLM
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")  # "gemini" or "ollama"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

# Embedding
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "64"))

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
