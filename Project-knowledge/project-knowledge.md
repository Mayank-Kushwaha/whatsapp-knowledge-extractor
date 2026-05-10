# project-knowledge.md
# WhatsApp Knowledge Graph — Complete Project Specification

> This document is the single source of truth for the WhatsApp Knowledge Graph project. It is intended to be fed directly into an AI IDE (Cursor, Windsurf, Copilot Workspace, etc.) to generate a full implementation roadmap and codebase scaffold.

---

## 1. Project Overview

### What it is
A web application that transforms WhatsApp chats into an organized, searchable, visual knowledge base. Users upload their WhatsApp chat exports, and the app automatically extracts, classifies, clusters, and visualizes all the content inside — links, images, videos, PDFs, documents, and plain messages — in a rich, interactive dashboard.

### The core problem it solves
Millions of people use WhatsApp as an informal knowledge repository — sharing Google Drive links, Amazon product URLs, YouTube videos, PDF documents, images of receipts, addresses, and important notes with themselves (via "Saved Messages") or in group chats. Retrieving any of this later requires manual scrolling through thousands of messages. There is no search across file types, no categorization, no way to see patterns.

This product solves that: it turns the chaos of a WhatsApp chat into an organized, searchable, interlinked knowledge graph.

### Target users
- Individuals who use "Saved Messages" or personal chats as a notes app
- Small teams or families that coordinate via WhatsApp groups
- Researchers, students, and professionals who share resources via WhatsApp

### Primary markets
India, Southeast Asia, Latin America, and the Middle East — regions where WhatsApp is the dominant communication layer for both personal and professional life.

---

## 2. Ingestion Strategy (MVP)

### Phase 1 (MVP): WhatsApp Chat Export Parser
WhatsApp has a built-in export feature:
- iOS/Android → Chat → More → Export Chat → With Media or Without Media
- Produces a `.txt` file (message log) and optionally a `.zip` containing media files

The `.txt` file follows a consistent format:
```
[DD/MM/YY, HH:MM:SS] Sender Name: Message content
[DD/MM/YY, HH:MM:SS] Sender Name: <Media omitted>
[DD/MM/YY, HH:MM:SS] Sender Name: image.jpg (file attached)
```

The MVP ingestion pipeline parses this file format directly. No API keys, no OAuth, no external dependencies. The user uploads their export file(s) through the web UI.

### Phase 2 (Future): WhatsApp Business API
- Register as a Meta Business Solution Provider
- Use Meta's Cloud API with webhooks for real-time message ingestion
- Enables live sync without manual exports
- Requires Meta app review and approval

### Phase 3 (Future): Multi-account / Group Aggregation
- Allow users to upload multiple export files and merge them into a unified knowledge base
- Cross-chat search and linking

> **Note for AI IDE**: The export parser is the ONLY ingestion method to implement now. The API integration is explicitly out of scope for the initial build. Leave placeholder hooks in the ingestion layer for future API connectors.

---

## 3. Core Features

### 3.1 Upload & Ingestion
- Drag-and-drop upload of WhatsApp `.zip` export file (or `.txt` alone)
- Support multiple files (multiple chats or group exports)
- Parse sender names, timestamps, message text, and media references
- Extract embedded media files from the `.zip` and save to the local `data/media/` directory
- Progress indicator during parsing (large chats can have 50k+ messages) — use SSE (Server-Sent Events) streamed from FastAPI
- Persist parsed data to the local SQLite database for future sessions

### 3.2 Media Classification Engine
Every message is classified into one or more of the following types:

| Type | Detection method |
|------|-----------------|
| **Link** | Regex URL detection; further sub-classified (YouTube, Google Drive, Amazon, Twitter, news article, generic) |
| **Image** | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` file references in export |
| **Video** | `.mp4`, `.mov`, `.avi` file references; YouTube links |
| **PDF** | `.pdf` file references; Google Drive PDF links |
| **Document** | `.docx`, `.xlsx`, `.pptx`, `.txt`, Google Docs/Sheets/Slides links |
| **Audio** | `.mp3`, `.m4a`, `.ogg`, `.opus` (voice notes) |
| **Contact** | vCard format `.vcf` files |
| **Location** | Google Maps links, "Location:" message pattern |
| **Plain text** | All other messages |
| **Important** | Messages containing trigger words/emoji (see section 3.5) |

### 3.3 Dashboard
A media-type-aware analytics dashboard with the following panels:

**Summary row (stat cards)**
- Total messages parsed
- Total unique senders
- Date range of the chat
- Total media items extracted

**Per-type panels** (one card per media type):
- Count of items
- Timeline chart (messages of this type over time)
- Quick-access list of the most recent items
- Click-through to the full filtered view

**Top senders** breakdown — who shares the most links, media, etc.

**Activity heatmap** — message frequency by day of week / hour of day

**Link domain breakdown** — pie or bar chart of top domains shared (youtube.com, drive.google.com, amazon.in, etc.)

### 3.4 Knowledge Graph View
An interactive node-link graph visualization where:

- **Nodes** represent: individual messages, media items, senders, topics/clusters, and link domains
- **Edges** represent: "sent by", "replied to", "same topic", "same domain", "same time window"
- Node size scales with importance or connection count
- Node color encodes type (link = blue, image = coral, video = purple, important = amber, text = gray)
- Clicking a node expands its connections and shows a detail panel
- Zoom, pan, and filter controls
- Toggle between full graph and filtered views (e.g. "show only links and their senders")

**Technology**: Cytoscape.js or react-force-graph (client-side rendering for interactivity)

### 3.5 Importance Tagging
A message is automatically flagged as "important" if it matches any of the following:

**Keyword triggers** (case-insensitive):
- "important", "urgent", "remember", "don't forget", "reminder", "note:", "save this", "keep this", "critical", "action item", "todo", "to do", "task:"

**Emoji triggers**:
- ❗ ‼️ ⚠️ 📌 📍 🔴 🔖 ✅ ☑️ 🚨

**WhatsApp Starred messages**: If the export contains starred message indicators, those are always flagged.

**Manual flagging**: Users can manually flag any message as important inside the app.

Important messages are:
- Shown in a dedicated "Important" feed panel
- Rendered with a distinct visual treatment (amber highlight)
- Searchable with an `is:important` filter
- Surfaced prominently in the knowledge graph (larger nodes)

### 3.6 Topic Clustering
Messages are grouped into semantic clusters using NLP:

- Generate sentence embeddings for each text message using `sentence-transformers` (model: `all-MiniLM-L6-v2` — free, runs locally, no API key needed)
- Cluster embeddings using HDBSCAN or K-Means
- Auto-label each cluster with a 2-4 word topic name using the free LLM (see Section 4)
- Clusters appear as visual groupings in the knowledge graph
- Users can browse by cluster in a "Topics" panel
- Each cluster shows a summary, message count, and date range

### 3.7 Search
Full, multi-mode search across the entire knowledge base:

- **Keyword search**: SQLite FTS5 full-text search across all message content (built into SQLite, zero extra dependencies)
- **Semantic search**: "find messages about apartment hunting" — cosine similarity over embeddings stored in SQLite, computed with numpy at query time
- **Filter search**: structured filters by sender, date range, type, cluster, importance
- **Shorthand filters**: `from:Mom`, `type:link`, `is:important`, `domain:youtube.com`, `before:2024-01`, `after:2023-06`
- Search results show message in context (surrounding messages visible)
- Highlight matched terms in results

### 3.8 Per-type Detail Views
Each media type has its own dedicated view accessible from the dashboard:

**Links view**
- List of all URLs with title, domain, favicon, and date shared
- Grouped by domain (YouTube, Drive, Amazon, etc.)
- Preview card with Open Graph metadata where available (fetched server-side via `httpx`)
- Filter by domain, sender, date

**Images view**
- Grid/masonry layout of extracted images served from local `data/media/` directory
- Click to expand with sender and date
- Download individual or all images

**Videos view**
- List of video links with thumbnails (YouTube embed preview where possible)
- Local video files with HTML5 `<video>` playback

**PDFs & Documents view**
- List with file name, size, sender, date
- PDF text extraction preview (first 500 chars) using PyMuPDF
- Download button (served from local media directory)

**Important view**
- Chronological feed of all flagged messages
- Grouped by trigger type (keyword, emoji, manual)
- Export to markdown or text file

**Topics view**
- Card grid of all discovered clusters
- Click into cluster to see all messages
- Timeline within the cluster

### 3.9 Multi-chat & Group Support
- Upload multiple chat exports and assign each a name (e.g. "Family Group", "Work Team", "Personal Saved")
- Switch between chats via a sidebar
- Cross-chat search (search across all uploaded chats simultaneously)
- Unified "All Chats" view for the knowledge graph

### 3.10 Export & Sharing
- Export any filtered view as `.md`, `.csv`, or `.json`
- Export important messages as a markdown file
- Export a topic cluster as a shareable AI-generated summary
- Copy individual message content for reference

---

## 4. AI Model

### Primary: Gemini 2.0 Flash (via Google AI Studio — completely free)
- **Cost**: Free. No billing required, no credit card.
- **API**: Google Generative AI Python SDK (`google-generativeai`)
- **Model string**: `gemini-2.0-flash`
- **Free tier limits**: 15 requests/minute, 1,500 requests/day — sufficient for all batch labeling during pipeline processing
- **Used for**: cluster topic labeling, cluster summarization, export summary generation
- **Key**: https://aistudio.google.com/app/apikey — free Google account is all that's needed

```python
import google.generativeai as genai

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")
response = model.generate_content("Label this cluster in 3 words: ...")
label = response.text.strip()
```

### Fallback: Ollama (fully local — zero API calls, zero cost, no internet after setup)
- Install: `ollama pull llama3`
- No rate limits, no API key, works offline
- Python: direct HTTP to `http://localhost:11434/api/generate`
- Switch via env var: `LLM_PROVIDER=ollama`

### LLM abstraction layer (required)
All LLM calls in the codebase must go through a single `llm.py` service. Switching providers must be a one-line config change:

```python
# backend/app/services/llm.py
def llm_generate(prompt: str) -> str:
    if settings.LLM_PROVIDER == "gemini":
        return _gemini_generate(prompt)
    elif settings.LLM_PROVIDER == "ollama":
        return _ollama_generate(prompt)
    raise ValueError(f"Unknown LLM provider: {settings.LLM_PROVIDER}")
```

### Sentence Embeddings (always local, always free, no API)
- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Runs on CPU — no GPU required
- Library: `sentence-transformers` Python package
- Embeddings stored as JSON arrays in SQLite (`numpy_array.tolist()` → store, `np.array(json.loads(...))` → retrieve)

> **Note for AI IDE**: Never use OpenAI, Anthropic, Cohere, or any paid API anywhere in this codebase. All LLM calls go through `services/llm.py`. All embedding calls go through `services/embedder.py` using sentence-transformers locally.

---

## 5. Storage Architecture (Fully Local — No External Services)

All data lives on the user's local machine. There is no Supabase, no PostgreSQL server, no S3, no R2, no GitHub storage, no external database of any kind.

### Database: SQLite + SQLite FTS5
- Single file: `data/knowledge.db`
- SQLite is built into Python — zero installation, zero config, zero cost
- FTS5 is a built-in SQLite extension for full-text search — no Elasticsearch or Typesense needed
- Vector/semantic search: embeddings stored as JSON text in SQLite; cosine similarity computed with numpy at query time (fast enough for up to ~100k messages without any vector database)
- Upgrade path (not for v1): if the dataset grows beyond 500k messages, migrate to local PostgreSQL + pgvector. Do NOT implement this in v1 — document it as a future option only.

### Media Files: Local Filesystem
- All extracted media (images, videos, PDFs, audio, documents) saved to `data/media/<chat_id>/<type>/`
- FastAPI serves these files via a static files mount or a `/media/{path}` endpoint with proper MIME types
- No cloud storage of any kind

### Directory layout on disk:
```
data/                          # gitignored — never committed
├── knowledge.db               # SQLite database
└── media/
    └── <chat_id>/
        ├── images/
        ├── videos/
        ├── audio/
        ├── documents/
        └── other/
```

### Auth: Simple local session (optional for MVP)
- This is a personal tool running locally — auth is not required for MVP
- If multi-user support is added later: simple username + bcrypt-hashed password in a `users` SQLite table; FastAPI session cookie with a secret key
- No OAuth, no magic links, no JWTs, no third-party auth provider

---

## 6. Background Processing (No Redis, No Celery)

Redis and Celery are not used in this project. They are unnecessary here.

### Why Redis/Celery are removed:
- This is a single-machine, single-user app. There is no distributed worker fleet to coordinate.
- Celery requires 3+ config files, a separate `celery worker` process, and a running Redis server — substantial overhead for a problem FastAPI solves natively.
- FastAPI's built-in `BackgroundTasks` handles all async processing cleanly for this use case.

### Replacement: FastAPI BackgroundTasks + SSE progress

**Upload endpoint** kicks off the pipeline immediately as a background task:
```python
@app.post("/api/chats/upload")
async def upload_chat(file: UploadFile, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    chat_id = str(uuid4())
    create_chat_record(db, chat_id, file.filename)
    background_tasks.add_task(run_pipeline, chat_id, await file.read())
    return {"chat_id": chat_id, "status": "processing"}
```

**Progress tracking** via a `pipeline_status` table in SQLite. Each pipeline step writes its completion there.

**Progress streaming** via Server-Sent Events — the frontend listens to a `/api/chats/{id}/progress` endpoint:
```python
@app.get("/api/chats/{chat_id}/progress")
async def progress_stream(chat_id: str):
    async def generate():
        while True:
            status = get_pipeline_status(chat_id)
            yield f"data: {json.dumps(status)}\n\n"
            if status["complete"] or status["error"]:
                break
            await asyncio.sleep(1)
    return StreamingResponse(generate(), media_type="text/event-stream")
```

**Frontend** uses native `EventSource` — no library needed:
```typescript
const es = new EventSource(`/api/chats/${chatId}/progress`);
es.onmessage = (e) => {
  const status = JSON.parse(e.data);
  setProgress(status);
  if (status.complete) es.close();
};
```

**If processing becomes slow for very large chats** (200k+ messages): use `concurrent.futures.ProcessPoolExecutor` for CPU-bound steps (embedding generation, clustering). This is still within FastAPI, still no Redis required.

---

## 7. Tech Stack

### Frontend
| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | Next.js 14 (App Router) | SSR for OG metadata prefetch, great DX |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent UI |
| Graph viz | Cytoscape.js or react-force-graph | Interactive knowledge graph, handles 10k+ nodes |
| Charts | Recharts | Dashboard analytics, no extra dependencies |
| State | Zustand | Lightweight global state |
| File upload | react-dropzone | Drag-and-drop UX |
| Progress | Native `EventSource` API | SSE from FastAPI, no library needed |

### Backend
| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | FastAPI (Python 3.11+) | Async, fast, BackgroundTasks built in, SSE support |
| Database | SQLite + FTS5 (built-in) | Zero setup, zero cost, sufficient for 500k messages |
| ORM | SQLAlchemy 2.0 + Alembic | Type-safe queries, migrations, SQLite-compatible |
| Background jobs | FastAPI `BackgroundTasks` | Native, no extra process, no Redis, no Celery |
| Media serving | FastAPI `StaticFiles` mount | Serve local media files over HTTP |

### AI / NLP (all free)
| Component | Technology | Cost |
|-----------|-----------|------|
| Text embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`) | Free, runs locally on CPU |
| Semantic search | `numpy` cosine similarity over SQLite embeddings | Free, local computation |
| Topic labeling + summarization | Gemini 2.0 Flash (Google AI Studio) | Free API, no billing required |
| LLM fallback | Ollama (`llama3`) | Free, fully local |
| PDF text extraction | PyMuPDF (`fitz`) | Free, local |
| Link OG metadata | `beautifulsoup4` + `httpx` | Free, local |
| Clustering | `scikit-learn` (K-Means) or `hdbscan` | Free, local |

### Removed from original plan (and why)
| Removed | Replacement | Reason |
|---------|------------|--------|
| Supabase | SQLite (local file) | No external service; zero setup |
| Redis | Eliminated | FastAPI BackgroundTasks is sufficient |
| Celery | Eliminated | FastAPI BackgroundTasks is sufficient |
| Cloudflare R2 / AWS S3 | Local `data/media/` directory | No cloud account needed |
| pgvector | numpy cosine similarity | No PostgreSQL server needed at all |
| OpenAI / paid LLMs | Gemini 2.0 Flash (free) + Ollama | Zero cost |

---

## 8. Data Models (SQLite Schema)

```sql
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('personal', 'group')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  date_range_start DATETIME,
  date_range_end DATETIME,
  status TEXT DEFAULT 'processing'  -- processing | ready | error
);

CREATE TABLE senders (
  id TEXT PRIMARY KEY,
  chat_id TEXT REFERENCES chats(id),
  display_name TEXT NOT NULL,
  phone_number TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT REFERENCES chats(id),
  sender_id TEXT REFERENCES senders(id),
  content TEXT,
  timestamp DATETIME,
  type TEXT,            -- text|link|image|video|pdf|doc|audio|contact|location
  is_important INTEGER DEFAULT 0,
  importance_reason TEXT,
  cluster_id TEXT,
  embedding TEXT,       -- JSON array: "[0.12, -0.34, ...]" (384 floats for MiniLM)
  raw_line TEXT
);

-- FTS5 virtual table for full-text search (zero extra dependencies)
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid'
);

CREATE TABLE media_items (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES messages(id),
  chat_id TEXT REFERENCES chats(id),
  type TEXT,
  original_filename TEXT,
  local_path TEXT,      -- relative path under data/media/
  mime_type TEXT,
  file_size_bytes INTEGER,
  extracted_text TEXT   -- for PDFs, first 2000 chars
);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES messages(id),
  url TEXT NOT NULL,
  domain TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  link_type TEXT        -- youtube|drive|amazon|twitter|generic
);

CREATE TABLE clusters (
  id TEXT PRIMARY KEY,
  chat_id TEXT REFERENCES chats(id),
  label TEXT,
  summary TEXT,
  message_count INTEGER,
  centroid_embedding TEXT  -- JSON array
);

CREATE TABLE important_flags (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES messages(id),
  trigger_type TEXT,    -- keyword|emoji|starred|manual
  trigger_value TEXT,
  flagged_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pipeline_status (
  chat_id TEXT PRIMARY KEY,
  current_step TEXT,
  steps_complete INTEGER DEFAULT 0,
  steps_total INTEGER DEFAULT 10,
  error TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 9. Application Pages & Routes

```
/                        → Landing page
/app                     → Dashboard home
/app/upload              → Upload chat export
/app/chats               → All uploaded chats list
/app/chats/[id]          → Chat overview dashboard
/app/chats/[id]/graph    → Knowledge graph view
/app/chats/[id]/links    → Links detail view
/app/chats/[id]/images   → Images gallery view
/app/chats/[id]/videos   → Videos list view
/app/chats/[id]/docs     → PDFs & documents view
/app/chats/[id]/important → Important messages feed
/app/chats/[id]/topics   → Topic clusters view
/app/chats/[id]/search   → Search within chat
/app/search              → Cross-chat global search
/app/settings            → App settings (LLM provider, data dir, etc.)
```

---

## 10. Processing Pipeline (Backend)

When a user uploads a chat export, the following pipeline runs as a FastAPI `BackgroundTask`. Each step writes its completion to the `pipeline_status` table; the SSE endpoint reads this table to stream progress to the frontend.

```
Step 1 — Parse
  Input: raw .zip or .txt file bytes
  Action: Extract .txt from zip; save media files to data/media/<chat_id>/
  Output: raw message rows in SQLite; media files on local disk

Step 2 — Classify
  Input: raw message rows
  Action: Regex + pattern matching to assign type to each message
  Output: type set on all rows; link rows created; media_item rows created

Step 3 — Enrich links
  Input: link rows (URLs)
  Action: Fetch Open Graph metadata via httpx (async, batched, ~1 req/sec to avoid blocks)
  Output: og_title, og_description, og_image_url populated

Step 4 — Extract PDF text
  Input: media_item rows where type = pdf
  Action: PyMuPDF text extraction (first 2000 chars per file)
  Output: extracted_text populated on media_item rows

Step 5 — Embed
  Input: all text messages (content field)
  Action: Batch encode with sentence-transformers on CPU (batch size 64)
  Output: embedding JSON stored in messages.embedding

Step 6 — Cluster
  Input: all message embeddings loaded into a numpy matrix
  Action: HDBSCAN (preferred) or K-Means clustering
  Output: cluster_id set on each message row; cluster rows created

Step 7 — Label clusters
  Input: up to 15 sample messages from each cluster
  Action: Gemini 2.0 Flash prompt → 2-4 word topic label + 1 sentence summary
  Output: cluster.label and cluster.summary populated

Step 8 — Tag importance
  Input: all message content strings
  Action: Keyword + emoji regex matching
  Output: important_flag rows created; messages.is_important = 1

Step 9 — Build FTS index
  Input: all message content
  Action: Bulk INSERT into messages_fts virtual table
  Output: FTS5 index ready for full-text queries

Step 10 — Mark complete
  Action: Set chats.status = 'ready'; update pipeline_status with complete=true
  Output: SSE stream delivers final completion event; frontend redirects to dashboard
```

---

## 11. WhatsApp Export Parser — Specification

**Standard format (most Android + iOS exports):**
```
[15/03/2024, 09:42:33] John: Hey check this out
[15/03/2024, 09:42:35] John: https://www.youtube.com/watch?v=dQw4w9WgXcQ
[15/03/2024, 09:43:01] Sarah: ❗ Remember to save this
[15/03/2024, 09:43:20] John: image.jpg (file attached)
[15/03/2024, 09:43:21] Sarah: <Media omitted>
```

**System messages to detect and skip:**
```
Messages and calls are end-to-end encrypted...
[date] John created group "Team Chat"
[date] John added Sarah
[date] You left
```

**Parser output per message:**
```python
{
  "timestamp": datetime,
  "sender": str,
  "content": str,
  "type": str,        # set by classifier in step 2
  "media_ref": str,   # filename if media attached, else None
  "raw_line": str     # original line(s) for debugging
}
```

**Edge cases the parser must handle:**
- Multi-line messages — a single message spanning multiple lines in the .txt
- Date format variants by locale: `DD/MM/YY`, `MM/DD/YY`, `YYYY-MM-DD`
- Time format variants: 12h (`3:42:33 PM`) and 24h (`15:42:33`)
- Unicode sender names — Hindi, Arabic, Tamil, emoji-in-name, etc.
- Emojis in message content (preserve as-is, used for importance tagging)
- Deleted messages: `"This message was deleted"` → type = deleted, skip from NLP
- Edited messages: suffix `"<This message was edited>"` → strip suffix, process content
- Forwarded messages: prefix `"Forwarded"` → flag as forwarded in metadata
- No-media exports: `"<Media omitted>"` → record type as unknown_media, no file to extract

---

## 12. UI/UX Principles

- **Dark mode first** — most WhatsApp users are accustomed to dark interfaces
- **Progressive disclosure** — show summary stats immediately, deep detail on demand
- **Non-blocking uploads** — user can browse existing chats while a new one processes
- **Mobile-responsive** — dashboard usable on a phone
- **Empty states** — clear onboarding prompts before first upload
- **Progress visibility** — SSE-powered real-time step-by-step progress bar (shows which pipeline step is running)
- **Consistent color coding** across dashboard, graph, and all detail views:
  - Links → Blue
  - Images → Coral/Pink
  - Videos → Purple
  - PDFs/Docs → Amber
  - Audio → Teal
  - Important → Yellow/Amber highlight
  - Plain text → Gray

---

## 13. Out of Scope (for initial build)

- WhatsApp Business API / real-time sync (Phase 2)
- Voice note transcription
- Conversational AI chatbot over the knowledge base
- Browser extension or mobile native app
- Multi-user access or public sharing
- Any cloud database, external storage, or third-party auth
- Billing or subscription system

---

## 14. Implementation Roadmap (Suggested Phases)

### Phase 0 — Project Setup (Day 1–2)
- Initialize Next.js 14 + TypeScript + Tailwind + shadcn/ui
- Initialize FastAPI backend with folder structure
- Set up SQLite database + SQLAlchemy models + Alembic initial migration
- Create `data/` and `data/media/` directories with `.gitkeep`
- Verify sentence-transformers model downloads and runs on CPU
- Configure `.env` file (only `GEMINI_API_KEY` and paths needed)
- Confirm frontend and backend talk to each other locally

### Phase 1 — Parser + Storage (Day 3–5)
- Implement WhatsApp `.txt` parser (`services/parser.py`) handling all edge cases in Section 11
- Upload API endpoint (`POST /api/chats/upload`) — saves file, kicks off BackgroundTask
- Store parsed messages to SQLite
- Extract media from `.zip` into `data/media/<chat_id>/`
- FastAPI `StaticFiles` mount for media serving
- SSE progress endpoint (`GET /api/chats/{id}/progress`)
- Unit tests for the parser covering all edge cases

### Phase 2 — Classification Engine (Day 6–8)
- Message type classifier (`services/classifier.py`) — regex + URL pattern matching
- Link extraction, URL normalization, domain classification
- Open Graph metadata fetcher (`services/og_fetcher.py`) — async `httpx`, rate-limited
- PDF text extraction (`services/pdf_extractor.py`) — PyMuPDF
- API endpoints for retrieving classified messages per type

### Phase 3 — Dashboard UI (Day 9–12)
- Upload page with drag-and-drop and SSE progress bar
- Chat list sidebar
- Dashboard: stat cards, per-type panels, activity heatmap, domain chart
- Per-type detail views (links, images, videos, docs, important)
- Responsive layout

### Phase 4 — NLP Pipeline (Day 13–16)
- Sentence embedding generation (`services/embedder.py`) — batched, CPU
- Store embeddings as JSON in SQLite
- Clustering (`services/clusterer.py`) — HDBSCAN or K-Means on numpy matrix
- LLM cluster labeling (`services/llm.py`) — Gemini 2.0 Flash with Ollama fallback
- Importance tagging (`services/tagger.py`)
- FTS5 index population
- Topics view in frontend

### Phase 5 — Search (Day 17–19)
- SQLite FTS5 keyword search API
- Numpy cosine similarity semantic search (load embeddings → numpy → top-K)
- Combined search endpoint with filter support
- Search UI: input, filter chips, shorthand filter parser, result context display
- Cross-chat search

### Phase 6 — Knowledge Graph View (Day 20–24)
- Graph data API: compute nodes + edges from SQLite queries
- Cytoscape.js integration in Next.js
- Node color + size encoding by type and importance
- Click-to-expand with detail side panel
- Filter controls (by type, sender, cluster)
- Default render top 500 nodes; expand on demand for large graphs

### Phase 7 — Polish + Launch (Day 25–30)
- Error handling and edge case UX throughout
- Empty states and first-time onboarding flow
- Export to `.md` / `.csv` / `.json` for all views
- Landing page
- `README.md` with local setup (clone → install → run, 3 commands)
- End-to-end testing with real WhatsApp export files

---

## 15. Key Technical Decisions & Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Ingestion | Export parser only | Zero external dependencies; works immediately; covers 100% of use cases |
| Database | SQLite + FTS5 | Built into Python; zero setup; FTS5 handles full-text search; sufficient for 500k messages |
| Vector search | numpy cosine on SQLite embeddings | Avoids pgvector entirely; numpy is already installed; fast enough for ≤100k messages |
| Background jobs | FastAPI BackgroundTasks | Native; no extra process; no Redis; no Celery; scales perfectly for single-user |
| Media storage | Local filesystem | No cloud account; no API key; FastAPI serves files directly |
| Free LLM | Gemini 2.0 Flash | Truly free via Google AI Studio; no credit card; abstracted for easy swap |
| Embeddings | sentence-transformers (local) | Completely free; CPU-only; no API calls; no rate limits |
| Graph viz | Cytoscape.js | Most mature; handles 10k+ nodes; good React integration |
| Auth | None for MVP | Personal local tool; add later if needed |

---

## 16. Environment Variables Required

```env
# AI — only external dependency, completely free
GEMINI_API_KEY=          # https://aistudio.google.com/app/apikey (free, no credit card)

# LLM provider selection
LLM_PROVIDER=gemini      # or: ollama

# Ollama (only needed if LLM_PROVIDER=ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Local data paths
DATA_DIR=./data
MEDIA_DIR=./data/media
DB_PATH=./data/knowledge.db

# Ports
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

No cloud credentials. No tokens. No secrets beyond the optional free Gemini API key.

---

## 17. Folder Structure (Suggested)

```
/
├── frontend/                        # Next.js app
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── upload/
│   │       ├── chats/
│   │       │   └── [id]/
│   │       │       ├── page.tsx     # Dashboard
│   │       │       ├── graph/
│   │       │       ├── links/
│   │       │       ├── images/
│   │       │       ├── videos/
│   │       │       ├── docs/
│   │       │       ├── important/
│   │       │       ├── topics/
│   │       │       └── search/
│   │       └── search/              # Cross-chat search
│   ├── components/
│   │   ├── dashboard/
│   │   ├── graph/
│   │   ├── media/
│   │   ├── search/
│   │   └── ui/                      # shadcn/ui components
│   └── lib/
│       ├── api.ts                   # FastAPI client
│       └── utils.ts
│
├── backend/                         # FastAPI app
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── chats.py
│   │   │   ├── messages.py
│   │   │   ├── search.py
│   │   │   ├── graph.py
│   │   │   └── upload.py
│   │   ├── core/
│   │   │   └── config.py            # Settings from .env
│   │   ├── models/
│   │   │   └── db.py               # SQLAlchemy models
│   │   ├── services/
│   │   │   ├── parser.py           # WhatsApp export parser
│   │   │   ├── classifier.py       # Message type classifier
│   │   │   ├── embedder.py         # sentence-transformers (local, CPU)
│   │   │   ├── clusterer.py        # HDBSCAN / K-Means
│   │   │   ├── tagger.py           # Importance tagger
│   │   │   ├── og_fetcher.py       # Open Graph metadata via httpx
│   │   │   ├── pdf_extractor.py    # PyMuPDF
│   │   │   ├── graph_builder.py    # Graph node/edge computation
│   │   │   └── llm.py              # Abstracted LLM: Gemini Flash | Ollama
│   │   └── tasks/
│   │       └── pipeline.py         # 10-step pipeline as FastAPI BackgroundTask
│   ├── tests/
│   │   ├── test_parser.py
│   │   ├── test_classifier.py
│   │   └── test_search.py
│   └── requirements.txt
│
├── data/                            # GITIGNORED — all user data lives here
│   ├── knowledge.db
│   └── media/
│
├── .env                             # GITIGNORED
├── .gitignore                       # Must include: data/, .env
└── README.md                        # Setup: clone → pip install → npm install → run
```

---

*Document version: 2.0 — updated for fully local stack*
*Ingestion: WhatsApp chat export parser only. API deferred to Phase 2.*
*No external services: no Supabase, no Redis, no Celery, no S3, no GitHub data storage.*
*Free AI: Gemini 2.0 Flash (Google AI Studio, no credit card) + Ollama as local fallback.*
*Data stays on your machine. One optional API key. Everything else runs locally.*
