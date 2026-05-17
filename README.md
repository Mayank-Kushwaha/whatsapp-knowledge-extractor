# 📱 WhatsApp Knowledge Extractor

Transform your WhatsApp chat exports into an organized, searchable, visual knowledge base — fully local, no cloud, no subscriptions.

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%2B%20FastAPI%20%2B%20SQLite-green)
![AI](https://img.shields.io/badge/AI-Gemini%202.0%20Flash%20(free)-purple)
![Local](https://img.shields.io/badge/storage-100%25%20local-orange)

---

## What Is This?

WhatsApp Knowledge Extractor is a web application that turns your WhatsApp chat exports into a rich, interactive knowledge base. You upload a `.zip` or `.txt` export file, and the app automatically parses every message, classifies content by type, clusters messages into semantic topics using local NLP, tags important messages, and presents everything in a searchable dashboard with an interactive knowledge graph.

**The core problem it solves**: Millions of people use WhatsApp as an informal notes app — sharing Google Drive links, YouTube videos, PDFs, images, addresses, and important reminders. Retrieving any of it later means scrolling through thousands of messages. This app turns that chaos into an organized, searchable, interlinked knowledge graph.

### Who Is It For?

- Individuals who use "Saved Messages" or personal chats as a notes app
- Small teams or families coordinating via WhatsApp groups
- Researchers, students, and professionals who share resources over WhatsApp
- Anyone in India, Southeast Asia, Latin America, or the Middle East where WhatsApp is the primary communication layer

---

## Features

### Upload & Ingestion
- Drag-and-drop upload of WhatsApp `.zip` export (with media) or standalone `.txt` file
- Real-time 10-step progress bar powered by Server-Sent Events (SSE)
- Handles chats with 50,000+ messages
- Extracts and stores all media files (images, videos, PDFs, audio, documents) locally
- Persists everything to a local SQLite database for future sessions

### Auto-Classification
Every message is automatically classified into one of these types:

| Type | How It's Detected |
|------|------------------|
| Link | URL regex; sub-classified as YouTube, Google Drive, Amazon, Twitter, or generic |
| Image | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` file references |
| Video | `.mp4`, `.mov`, `.avi` files; YouTube links |
| PDF | `.pdf` files; Google Drive PDF links |
| Document | `.docx`, `.xlsx`, `.pptx`; Google Docs/Sheets/Slides links |
| Audio | `.mp3`, `.m4a`, `.ogg`, `.opus` (voice notes) |
| Contact | `.vcf` vCard files |
| Location | Google Maps links, "Location:" message pattern |
| Plain text | All other messages |
| Important | Keyword/emoji triggers (see below) |

### Importance Tagging
Messages are auto-flagged as important when they contain:
- **Keywords**: "important", "urgent", "remember", "don't forget", "reminder", "note:", "save this", "critical", "action item", "todo", "task:"
- **Emojis**: ❗ ‼️ ⚠️ 📌 📍 🔴 🔖 ✅ ☑️ 🚨
- **Manual flagging**: You can flag/unflag any message inside the app

### Topic Clustering (NLP)
- Generates sentence embeddings for every text message using `sentence-transformers/all-MiniLM-L6-v2` — runs locally on CPU, no GPU needed, no API calls
- Clusters messages into semantic topics using HDBSCAN (with K-Means fallback)
- Auto-labels each cluster with a 2–4 word topic name using Gemini 2.0 Flash (free)
- Browse all discovered topics in the Topics view

### Multi-Mode Search
- **Keyword search**: SQLite FTS5 full-text search — zero extra dependencies
- **Semantic search**: Cosine similarity over local embeddings using numpy
- **Filter search**: By sender, date range, type, cluster, importance
- **Shorthand filters**: `from:Mom`, `type:link`, `is:important`, `domain:youtube.com`, `before:2024-01`, `after:2023-06`
- **Cross-chat search**: Search across all uploaded chats simultaneously
- Results show surrounding context; matched terms are highlighted

### Analytics Dashboard
- Summary stat cards: total messages, unique senders, date range, media items
- Per-type panels with counts and quick-access lists
- Activity heatmap: message frequency by day of week / hour of day
- Top senders breakdown
- Link domain breakdown (YouTube, Drive, Amazon, etc.)

### Knowledge Graph
- Interactive node-link graph built with Cytoscape.js
- Nodes represent messages, senders, topics, and link domains
- Node color encodes type; node size encodes importance/connections
- Click any node to expand its connections and see a detail panel
- Filter by type, sender, or cluster
- Zoom, pan, and drag controls

### Per-Type Detail Views
- **Links**: OG preview cards with title, description, image; grouped by domain
- **Images**: Masonry grid with click-to-expand lightbox; download support
- **Videos**: YouTube embed previews; HTML5 playback for local videos
- **Documents**: File list with PDF text preview (first 500 chars); download button
- **Important**: Chronological feed grouped by trigger type; export to Markdown

### Export
- Export any filtered view as `.md`, `.csv`, or `.json`
- Export important messages as a Markdown file
- Export topic cluster as an AI-generated summary

---

## Prerequisites

Before you start, make sure you have these installed:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Python | 3.11 or higher | `python --version` |
| Node.js | 18 or higher | `node --version` |
| npm | 8 or higher | `npm --version` |
| Git | Any recent version | `git --version` |

You also need a **free Gemini API key** for topic labeling. Get one at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — no credit card required, no billing setup. If you prefer to run fully offline, you can use Ollama instead (see Environment Variables section).

---

## How to Export Your WhatsApp Chat

### Android
1. Open WhatsApp → open the chat you want to export
2. Tap the three-dot menu (⋮) → **More** → **Export Chat**
3. Choose **Include Media** (for full export with images/videos) or **Without Media** (text only)
4. Save or share the `.zip` file to your computer

### iOS
1. Open WhatsApp → open the chat
2. Tap the contact/group name at the top → **Export Chat**
3. Choose **Attach Media** or **Without Media**
4. AirDrop, email, or save the `.zip` file to your computer

The export produces a `.txt` file (message log) and optionally a `.zip` containing media files. Both formats are supported by this app.

---

## Setup & Installation

### Step 1 — Clone the repository

```bash
git clone <your-repo-url>
cd whatsapp-knowledge-extractor
```

### Step 2 — Set up the backend

```bash
cd backend

# Create a Python virtual environment
python -m venv venv

# Activate it (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install all Python dependencies
pip install -r requirements.txt
```

### Step 3 — Configure environment variables

Create a `.env` file inside the `backend/` directory:

```bash
# backend/.env

# AI — free Gemini API key (no credit card needed)
GEMINI_API_KEY=your_key_here

# LLM provider: "gemini" (default) or "ollama" (fully local, no internet)
LLM_PROVIDER=gemini

# Ollama settings — only needed if LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Local data paths (defaults work out of the box)
DATA_DIR=./data
MEDIA_DIR=./data/media
DB_PATH=./data/knowledge.db

# Server ports
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

### Step 4 — Initialize the database

```bash
# Still inside backend/ with venv activated
alembic upgrade head
```

This creates `data/knowledge.db` with all the required tables.

### Step 5 — Set up the frontend

```bash
cd ../frontend
npm install
```

---

## Running the Project

You need two terminals running simultaneously — one for the backend, one for the frontend.

### Terminal 1 — Backend (FastAPI)

```bash
cd whatsapp-knowledge-extractor/backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. You can explore the auto-generated API docs at `http://localhost:8000/docs`.

### Terminal 2 — Frontend (Next.js)

```bash
cd whatsapp-knowledge-extractor/frontend
npm run dev
```

The app will be available at `http://localhost:3000`.

### Verify Everything Is Working

Open `http://localhost:3000` — you should see the landing page. To confirm the backend is healthy:

```bash
curl http://localhost:8000/health
# Expected: {"status": "ok"}
```

---

## Using the App — Step by Step

1. **Open** `http://localhost:3000` — you'll see the landing page
2. **Click "Get Started"** → navigates to the Upload page
3. **Drag and drop** your WhatsApp `.zip` or `.txt` export onto the upload zone
4. **Watch the progress bar** — 10 pipeline steps run automatically (parse → classify → embed → cluster → label → index)
5. **Explore the dashboard** — stat cards, charts, and per-type panels load automatically
6. **Browse by type** — click any panel to open the dedicated view (Links, Images, Videos, Docs, Important)
7. **Explore topics** — the Topics view shows all discovered semantic clusters
8. **Search** — use the search bar with keyword, semantic, or shorthand filter queries
9. **View the graph** — the Knowledge Graph shows all relationships visually
10. **Export** — download any view as Markdown, CSV, or JSON

---

## Processing Pipeline

When you upload a chat, these 10 steps run automatically as a background task. Progress streams to the UI in real time via SSE.

| Step | Name | What Happens |
|------|------|-------------|
| 1 | Parse | Extracts messages, senders, timestamps from the `.txt`; saves media files to `data/media/` |
| 2 | Classify | Assigns a type to every message using regex and file extension detection |
| 3 | Enrich Links | Fetches Open Graph metadata (title, description, image) for all URLs |
| 4 | Extract PDFs | Runs PyMuPDF on PDF files to extract the first 2000 characters of text |
| 5 | Embed | Generates 384-dimensional sentence embeddings for all text messages (local CPU) |
| 6 | Cluster | Groups messages into semantic topics using HDBSCAN or K-Means |
| 7 | Label Clusters | Calls Gemini 2.0 Flash to generate a 2–4 word topic label and 1-sentence summary per cluster |
| 8 | Tag Importance | Scans all messages for keyword and emoji triggers; creates importance flags |
| 9 | Build FTS Index | Bulk-inserts all message content into the SQLite FTS5 virtual table |
| 10 | Mark Complete | Sets chat status to "ready"; SSE delivers the completion event; UI redirects to dashboard |

---

## Application Routes

| Route | Page |
|-------|------|
| `/` | Landing page |
| `/app/upload` | Upload chat export |
| `/app/chats` | All uploaded chats list |
| `/app/chats/[id]` | Chat overview dashboard |
| `/app/chats/[id]/graph` | Interactive knowledge graph |
| `/app/chats/[id]/links` | Links detail view with OG cards |
| `/app/chats/[id]/images` | Images masonry gallery |
| `/app/chats/[id]/videos` | Videos list with playback |
| `/app/chats/[id]/docs` | PDFs and documents view |
| `/app/chats/[id]/important` | Important messages feed |
| `/app/chats/[id]/topics` | Topic clusters view |
| `/app/chats/[id]/search` | Search within a single chat |
| `/app/search` | Cross-chat global search |
| `/app/settings` | App settings (LLM provider, API key) |

---

## Project Structure

```
whatsapp-knowledge-extractor/
├── frontend/                          # Next.js 16 app (React 19, TypeScript)
│   ├── app/
│   │   ├── layout.tsx                 # Root HTML layout, font loading
│   │   ├── page.tsx                   # Landing page (/)
│   │   ├── globals.css                # Global styles, CSS custom properties
│   │   └── app/                       # Authenticated app shell
│   │       ├── layout.tsx             # App layout: sidebar + top bar
│   │       ├── upload/page.tsx        # Upload page with drag-and-drop + SSE progress
│   │       ├── chats/
│   │       │   ├── page.tsx           # Chat list (/app/chats)
│   │       │   └── [id]/
│   │       │       ├── page.tsx       # Dashboard for a specific chat
│   │       │       ├── graph/page.tsx # Knowledge graph (Cytoscape.js)
│   │       │       ├── links/page.tsx # Links view with OG preview cards
│   │       │       ├── images/page.tsx# Images masonry gallery + lightbox
│   │       │       ├── videos/page.tsx# Videos list + YouTube embeds
│   │       │       ├── docs/page.tsx  # Documents + PDF text preview
│   │       │       ├── important/page.tsx # Important messages feed
│   │       │       ├── topics/page.tsx    # Topic clusters card grid
│   │       │       └── search/page.tsx    # Per-chat search
│   │       ├── search/page.tsx        # Cross-chat global search
│   │       └── settings/page.tsx      # Settings (LLM provider, API key)
│   ├── components/
│   │   └── ui/                        # shadcn/ui component library
│   ├── lib/
│   │   ├── api.ts                     # Typed fetch wrappers for all backend endpoints
│   │   ├── store.ts                   # Zustand global state (theme, sidebar, current chat)
│   │   └── utils.ts                   # Utility functions (cn, formatters)
│   ├── package.json                   # Dependencies
│   ├── next.config.ts                 # Next.js config (API proxy to backend)
│   └── tsconfig.json                  # TypeScript config
│
├── backend/                           # FastAPI app (Python 3.11+)
│   ├── app/
│   │   ├── main.py                    # FastAPI app entry point, CORS, router registration, StaticFiles
│   │   ├── api/
│   │   │   ├── upload.py              # POST /api/chats/upload — file ingestion + BackgroundTask
│   │   │   ├── chats.py               # GET /api/chats, GET /api/chats/{id} — chat CRUD
│   │   │   ├── messages.py            # GET /api/chats/{id}/messages — paginated + filtered
│   │   │   ├── links.py               # GET /api/chats/{id}/links — links with OG data
│   │   │   ├── important.py           # GET /api/chats/{id}/important, flag/unflag endpoints
│   │   │   ├── clusters.py            # GET /api/chats/{id}/clusters, cluster messages
│   │   │   ├── search.py              # GET /api/chats/{id}/search, GET /api/search (cross-chat)
│   │   │   ├── graph.py               # GET /api/chats/{id}/graph — nodes + edges JSON
│   │   │   ├── media.py               # Media file serving endpoints
│   │   │   └── export.py              # Export endpoints (md, csv, json)
│   │   ├── core/
│   │   │   └── config.py              # Settings loaded from .env via pydantic-settings
│   │   ├── models/
│   │   │   └── db.py                  # SQLAlchemy 2.0 ORM models for all 8 tables
│   │   ├── services/
│   │   │   ├── parser.py              # WhatsApp .txt parser — handles all edge cases
│   │   │   ├── classifier.py          # Message type classifier — regex + extension detection
│   │   │   ├── og_fetcher.py          # Async Open Graph metadata fetcher (httpx, rate-limited)
│   │   │   ├── pdf_extractor.py       # PyMuPDF PDF text extraction
│   │   │   ├── tagger.py              # Importance tagger — keyword + emoji triggers
│   │   │   ├── embedder.py            # sentence-transformers embeddings (local CPU)
│   │   │   ├── clusterer.py           # HDBSCAN / K-Means topic clustering
│   │   │   ├── llm.py                 # LLM abstraction — Gemini Flash or Ollama
│   │   │   ├── fts_builder.py         # SQLite FTS5 index builder
│   │   │   ├── semantic_search.py     # Numpy cosine similarity semantic search
│   │   │   └── graph_builder.py       # Graph node/edge computation from SQLite
│   │   └── tasks/
│   │       └── pipeline.py            # 10-step processing pipeline as FastAPI BackgroundTask
│   ├── alembic/                       # Database migrations
│   │   ├── env.py
│   │   └── versions/                  # Migration files
│   ├── tests/
│   │   ├── conftest.py                # Pytest fixtures
│   │   ├── test_parser.py             # 40 parser unit tests
│   │   ├── test_classifier.py         # 37 classifier unit tests
│   │   └── sample_chat.txt            # Sample WhatsApp export for testing
│   ├── data/                          # GITIGNORED — all user data lives here
│   │   ├── knowledge.db               # SQLite database
│   │   └── media/                     # Extracted media files
│   ├── requirements.txt               # Python dependencies (pinned versions)
│   ├── alembic.ini                    # Alembic configuration
│   └── .env                           # Environment variables (GITIGNORED)
│
├── Project-knowledge-whatsapp/        # Project documentation
│   ├── project-knowledge.md           # Full project specification
│   ├── roadmap.md                     # Sprint-by-sprint roadmap
│   ├── sprint-tracker.md              # Live progress tracker
│   └── how-to-run-guide.md            # Detailed run guide with PowerShell commands
│
├── .gitignore                         # Excludes data/, .env, node_modules/, __pycache__/
└── README.md                          # This file
```

---

## Environment Variables Reference

All variables go in `backend/.env`. Only `GEMINI_API_KEY` is required — everything else has sensible defaults.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes (unless using Ollama) | — | Free API key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `LLM_PROVIDER` | No | `gemini` | Set to `ollama` to run fully offline |
| `OLLAMA_BASE_URL` | Only if Ollama | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | Only if Ollama | `llama3` | Ollama model name |
| `DATA_DIR` | No | `./data` | Root directory for all user data |
| `MEDIA_DIR` | No | `./data/media` | Directory for extracted media files |
| `DB_PATH` | No | `./data/knowledge.db` | SQLite database file path |
| `BACKEND_PORT` | No | `8000` | FastAPI server port |
| `FRONTEND_PORT` | No | `3000` | Next.js dev server port |

### Using Ollama Instead of Gemini (Fully Offline)

If you want zero internet dependency after setup:

```bash
# Install Ollama from https://ollama.com
ollama pull llama3

# Then in backend/.env:
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

---

## Database Schema

The app uses a single SQLite file at `data/knowledge.db` with these tables:

| Table | Purpose |
|-------|---------|
| `chats` | One row per uploaded chat export (id, name, type, status, message count, date range) |
| `senders` | Unique senders per chat (display name, phone number) |
| `messages` | Every parsed message (content, timestamp, type, importance, cluster, embedding) |
| `messages_fts` | FTS5 virtual table for full-text search (mirrors message content) |
| `media_items` | Media file metadata (local path, MIME type, size, extracted text for PDFs) |
| `links` | URL metadata (domain, OG title, OG description, OG image, link type) |
| `clusters` | Topic clusters (label, summary, message count, centroid embedding) |
| `important_flags` | Importance flags (trigger type: keyword/emoji/manual, trigger value) |
| `pipeline_status` | Processing progress (current step, steps complete, error state) |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.2.6 | React framework with App Router |
| React | 19.2.4 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| shadcn/ui | 4.x | Component library |
| Framer Motion | 12.x | Animations and page transitions |
| Cytoscape.js | 3.33 | Interactive knowledge graph |
| react-cytoscapejs | 2.0 | React wrapper for Cytoscape |
| Recharts | 3.x | Dashboard charts |
| Zustand | 5.x | Global state management |
| react-dropzone | 15.x | Drag-and-drop file upload |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.115.12 | API framework with async support |
| Uvicorn | 0.34.3 | ASGI server |
| SQLAlchemy | 2.0.41 | ORM with type-safe queries |
| Alembic | 1.15.2 | Database migrations |
| httpx | 0.28.1 | Async HTTP client for OG fetching |
| beautifulsoup4 | 4.13.4 | HTML parsing for OG metadata |
| sentence-transformers | 4.1.0 | Local sentence embeddings (CPU) |
| scikit-learn | 1.6.1 | K-Means clustering |
| hdbscan | 0.8.40 | Density-based topic clustering |
| numpy | 2.2.6 | Embedding matrix operations |
| pymupdf | 1.25.5 | PDF text extraction |
| google-generativeai | 0.8.5 | Gemini 2.0 Flash API client |
| python-dotenv | 1.1.0 | .env file loading |

---

## Running Tests

```bash
cd backend
.\venv\Scripts\Activate.ps1
pytest tests/ -v
```

The test suite covers the WhatsApp parser (40 tests) and message classifier (37 tests).

---

## Troubleshooting

**`sentence-transformers` model download is slow on first run**
The `all-MiniLM-L6-v2` model (~90MB) downloads automatically on first use. Subsequent runs use the cached version. This is expected behavior.

**`alembic upgrade head` fails with "no such table"**
Make sure you're running the command from inside the `backend/` directory with the virtual environment activated.

**Frontend shows "Failed to fetch" errors**
Ensure the backend is running on port 8000 before starting the frontend. Check that CORS is not blocked — the backend is configured to allow `localhost:3000`.

**`hdbscan` installation fails on Windows**
Try installing with: `pip install hdbscan --no-build-isolation`. If it still fails, the app will automatically fall back to K-Means clustering.

**Gemini API returns rate limit errors**
The free tier allows 15 requests/minute and 1,500/day. For large chats with many clusters, the labeling step automatically adds a 4-second delay between calls to stay within limits.

**PowerShell execution policy error when activating venv**
Run this once in PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## What's Not Included (Future Phases)

- WhatsApp Business API / real-time sync
- Voice note transcription
- Conversational AI chatbot over the knowledge base
- Browser extension or mobile app
- Multi-user access or public sharing
- Any cloud database, external storage, or third-party auth

---

## License

MIT — your data stays on your machine. No cloud, no tracking, no subscriptions.
