# 🗺️ WhatsApp Knowledge Extractor — Project Roadmap

> **Single Source of Truth** for building the WhatsApp Knowledge Graph project.
> This document covers what the project is, how it's structured, the tech stack, best practices, and a sprint-by-sprint plan to build it from scratch.

---

## 📌 What Is This Project?

A **web application** that transforms WhatsApp chat exports into an organized, searchable, visual knowledge base. Users upload their WhatsApp `.txt` / `.zip` exports, and the app automatically:

- **Parses** messages, senders, timestamps, and media references
- **Classifies** content (links, images, videos, PDFs, audio, contacts, locations, plain text)
- **Clusters** messages into semantic topics using local NLP
- **Tags** important messages via keyword/emoji detection
- **Visualizes** everything in a rich dashboard with an interactive knowledge graph
- **Enables** full-text + semantic search across all uploaded chats

### Core Problem Solved

WhatsApp is an informal knowledge repository for millions — links, PDFs, images, notes — but retrieving anything later requires manual scrolling. This app turns chat chaos into an organized, searchable, interlinked knowledge graph.

### Target Users

- Individuals using "Saved Messages" as a notes app
- Small teams / families coordinating via WhatsApp groups
- Researchers, students, and professionals sharing resources

### Primary Markets

India, Southeast Asia, Latin America, Middle East — where WhatsApp dominates communication.

---

## 🛠️ Tech Stack

### Frontend

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 14** (App Router) | SSR, great DX |
| Language | **TypeScript** | Type safety |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent UI |
| Animations | **Framer Motion** | Smooth micro-animations, page transitions |
| Graph Viz | **Cytoscape.js** or **react-force-graph** | Interactive knowledge graph (10k+ nodes) |
| Charts | **Recharts** | Dashboard analytics |
| State | **Zustand** | Lightweight global state |
| File Upload | **react-dropzone** | Drag-and-drop UX |
| Progress | Native **EventSource** API | SSE from FastAPI |

### Backend

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **FastAPI** (Python 3.11+) | Async, BackgroundTasks, SSE support |
| Database | **SQLite + FTS5** | Zero setup, built into Python |
| ORM | **SQLAlchemy 2.0 + Alembic** | Type-safe queries, migrations |
| Background Jobs | **FastAPI BackgroundTasks** | No Redis, no Celery needed |
| Media Serving | **FastAPI StaticFiles** | Serve local files over HTTP |

### AI / NLP (All Free)

| Component | Technology | Cost |
|-----------|-----------|------|
| Embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`) | Free, local CPU |
| Semantic Search | `numpy` cosine similarity | Free, local |
| Topic Labeling | **Gemini 2.0 Flash** (Google AI Studio) | Free, no billing |
| LLM Fallback | **Ollama** (`llama3`) | Free, fully local |
| PDF Extraction | **PyMuPDF** (`fitz`) | Free, local |
| Link Metadata | `beautifulsoup4` + `httpx` | Free |
| Clustering | `scikit-learn` / `hdbscan` | Free, local |

### What's NOT Used (and Why)

| Removed | Replacement | Reason |
|---------|------------|--------|
| Supabase | SQLite (local) | No external service |
| Redis / Celery | FastAPI BackgroundTasks | Overkill for single-user |
| S3 / R2 | Local `data/media/` | No cloud account |
| pgvector | numpy cosine similarity | No PostgreSQL needed |
| OpenAI / paid LLMs | Gemini Flash + Ollama | Zero cost |

---

## 🏗️ Project Structure

```
whatsapp-knowledge-extractor/
├── frontend/                        # Next.js 14 app
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
│   │       ├── search/              # Cross-chat search
│   │       └── settings/
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
│   │   │   └── config.py
│   │   ├── models/
│   │   │   └── db.py
│   │   ├── services/
│   │   │   ├── parser.py
│   │   │   ├── classifier.py
│   │   │   ├── embedder.py
│   │   │   ├── clusterer.py
│   │   │   ├── tagger.py
│   │   │   ├── og_fetcher.py
│   │   │   ├── pdf_extractor.py
│   │   │   ├── graph_builder.py
│   │   │   └── llm.py
│   │   └── tasks/
│   │       └── pipeline.py
│   ├── tests/
│   │   ├── test_parser.py
│   │   ├── test_classifier.py
│   │   └── test_search.py
│   └── requirements.txt
│
├── data/                            # GITIGNORED
│   ├── knowledge.db
│   └── media/
│
├── Project-knowledge/
│   ├── project-knowledge.md
│   └── roadmap.md
│
├── .env                             # GITIGNORED
├── .gitignore
└── README.md
```

---

## 🎨 UI/UX Design Principles

- **Dark mode first** — WhatsApp users are accustomed to dark interfaces
- **Progressive disclosure** — summary stats first, deep detail on demand
- **Non-blocking uploads** — browse existing chats while new ones process
- **Mobile-responsive** — dashboard usable on phones
- **Empty states** — clear onboarding prompts before first upload
- **SSE progress bars** — real-time step-by-step pipeline progress
- **Consistent color coding** across all views:
  - 🔵 Links → Blue
  - 🩷 Images → Coral/Pink
  - 🟣 Videos → Purple
  - 🟠 PDFs/Docs → Amber
  - 🟢 Audio → Teal
  - 🟡 Important → Yellow/Amber
  - ⚪ Plain text → Gray

---

## ✅ Best Practices

### Development Skills to Use

> **Mandatory**: Use the following skills during development for premium UI/UX:
> - `impeccable` — for code quality and polish
> - `ui-ux-pro-max` — for professional-grade interface design
> - `ui-designer` — for design system and component patterns
> - `frontend-design` — for frontend architecture decisions
> - `framer-motion` — for smooth animations and micro-interactions

### Code Quality

- TypeScript strict mode on frontend
- Python type hints throughout backend
- All LLM calls through `services/llm.py` abstraction
- All embedding calls through `services/embedder.py`
- Never use paid APIs (OpenAI, Anthropic, Cohere, etc.)
- Unit tests for parser, classifier, and search
- ESLint + Prettier for frontend; Ruff for backend

### Git Workflow

- Initialize git repo in `whatsapp-knowledge-extractor/` root
- `.gitignore` must include: `data/`, `.env`, `node_modules/`, `__pycache__/`, `.next/`
- Commit after each sprint is verified working
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Push to remote after each sprint passes verification

### Architecture Rules

- Fully local — no external services, no cloud databases
- Only external dependency: optional free Gemini API key
- Data stays on user's machine
- Leave placeholder hooks in ingestion layer for future API connectors
- SQLite for storage (upgrade path to PostgreSQL documented but NOT implemented)

---

## 📊 Database Schema

```sql
-- Core tables
chats (id, name, type, created_at, message_count, date_range_start, date_range_end, status)
senders (id, chat_id, display_name, phone_number)
messages (id, chat_id, sender_id, content, timestamp, type, is_important, importance_reason, cluster_id, embedding, raw_line)
messages_fts — FTS5 virtual table for full-text search
media_items (id, message_id, chat_id, type, original_filename, local_path, mime_type, file_size_bytes, extracted_text)
links (id, message_id, url, domain, og_title, og_description, og_image_url, link_type)
clusters (id, chat_id, label, summary, message_count, centroid_embedding)
important_flags (id, message_id, trigger_type, trigger_value, flagged_at)
pipeline_status (chat_id, current_step, steps_complete, steps_total, error, updated_at)
```

---

## 🔄 Processing Pipeline (10 Steps)

When a user uploads a chat, these steps run as a FastAPI BackgroundTask with SSE progress:

| Step | Name | Action |
|------|------|--------|
| 1 | Parse | Extract `.txt` from zip; save media to `data/media/`; create message rows |
| 2 | Classify | Regex + pattern matching to assign type to each message |
| 3 | Enrich Links | Fetch Open Graph metadata via httpx (async, rate-limited) |
| 4 | Extract PDF Text | PyMuPDF extraction (first 2000 chars per file) |
| 5 | Embed | Batch encode text with sentence-transformers on CPU |
| 6 | Cluster | HDBSCAN/K-Means on numpy embedding matrix |
| 7 | Label Clusters | Gemini Flash → 2-4 word topic label + summary |
| 8 | Tag Importance | Keyword + emoji regex matching |
| 9 | Build FTS Index | Bulk insert into FTS5 virtual table |
| 10 | Mark Complete | Set status = 'ready'; SSE delivers completion event |

---

## 🗓️ Application Routes

```
/                          → Landing page
/app                       → Dashboard home
/app/upload                → Upload chat export
/app/chats                 → All uploaded chats list
/app/chats/[id]            → Chat overview dashboard
/app/chats/[id]/graph      → Knowledge graph view
/app/chats/[id]/links      → Links detail view
/app/chats/[id]/images     → Images gallery view
/app/chats/[id]/videos     → Videos list view
/app/chats/[id]/docs       → PDFs & documents view
/app/chats/[id]/important  → Important messages feed
/app/chats/[id]/topics     → Topic clusters view
/app/chats/[id]/search     → Search within chat
/app/search                → Cross-chat global search
/app/settings              → App settings
```

---

## 🚀 SPRINTS

> **Rules for every sprint:**
> 1. After completing each sprint, **stop and verify** nothing is broken
> 2. Run all existing tests and ensure they pass
> 3. Verify frontend and backend both start without errors
> 4. Only after verification: `git add . && git commit && git push`
> 5. Use skills: `impeccable`, `ui-ux-pro-max`, `ui-designer`, `frontend-design`, and Framer Motion

---

### 🏁 Sprint 0 — Project Initialization & Scaffold (Day 1–2)

**Goal**: Initialize the repository, scaffold both frontend and backend, and confirm they communicate.

#### Tasks

- [ ] Initialize a **git repository** in `d:\Mayank\workspace\whatsapp-knowledge-extractor\`
  ```bash
  cd d:\Mayank\workspace\whatsapp-knowledge-extractor
  git init
  ```
- [ ] Create `.gitignore` with: `data/`, `.env`, `node_modules/`, `__pycache__/`, `.next/`, `*.pyc`, `venv/`, `.venv/`
- [ ] Scaffold **Next.js 14** frontend in `frontend/`:
  ```bash
  npx -y create-next-app@latest ./frontend --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
  ```
- [ ] Install frontend dependencies: `shadcn/ui`, `zustand`, `react-dropzone`, `recharts`, `framer-motion`, `cytoscape`
- [ ] Scaffold **FastAPI** backend in `backend/`:
  - Create folder structure: `app/`, `app/api/`, `app/core/`, `app/models/`, `app/services/`, `app/tasks/`, `tests/`
  - Create `requirements.txt` with all Python dependencies
  - Create `app/main.py` with CORS enabled for `localhost:3000`
- [ ] Set up **SQLite + SQLAlchemy 2.0 + Alembic**:
  - Define all models from the schema (chats, senders, messages, media_items, links, clusters, important_flags, pipeline_status)
  - Run initial Alembic migration
- [ ] Create `data/` and `data/media/` directories with `.gitkeep`
- [ ] Create `.env` template with all required env vars
- [ ] Verify `sentence-transformers` model downloads and runs on CPU
- [ ] Configure FastAPI to serve media via StaticFiles
- [ ] Confirm frontend `fetch()` to backend `/health` endpoint works

#### Verification Checkpoint ✅

- [ ] `git status` shows clean working tree
- [ ] `npm run dev` starts frontend on port 3000
- [ ] `uvicorn app.main:app --reload` starts backend on port 8000
- [ ] Frontend can call backend API (CORS working)
- [ ] SQLite database file created at `data/knowledge.db`
- [ ] All Alembic migrations run without errors
- [ ] **Commit & Push**: `git add . && git commit -m "feat: project scaffold with Next.js + FastAPI + SQLite" && git push`

---

### 📝 Sprint 1 — WhatsApp Parser + Upload API (Day 3–5)

**Goal**: Build the core parser and upload pipeline. Users can upload a `.txt`/`.zip` export and see it parsed into the database.

#### Tasks

- [ ] Implement `backend/app/services/parser.py`:
  - Parse WhatsApp `.txt` format: `[DD/MM/YY, HH:MM:SS] Sender: Message`
  - Handle all edge cases from spec Section 11:
    - Multi-line messages
    - Date format variants (DD/MM/YY, MM/DD/YY, YYYY-MM-DD)
    - Time format variants (12h and 24h)
    - Unicode sender names (Hindi, Arabic, Tamil, emoji)
    - Deleted messages (`"This message was deleted"`)
    - Edited messages (`"<This message was edited>"`)
    - Forwarded messages
    - `<Media omitted>` handling
    - System messages (skip)
  - Output: list of parsed message dicts
- [ ] Implement upload API: `POST /api/chats/upload`
  - Accept `.zip` or `.txt` file
  - Extract media from `.zip` to `data/media/<chat_id>/`
  - Kick off parsing as a `BackgroundTask`
  - Return `{ chat_id, status: "processing" }`
- [ ] Implement `pipeline_status` tracking in SQLite
- [ ] Implement SSE progress endpoint: `GET /api/chats/{chat_id}/progress`
- [ ] Store parsed messages to SQLite (bulk insert)
- [ ] Write **unit tests** for the parser covering all edge cases
- [ ] Create basic API endpoints:
  - `GET /api/chats` — list all chats
  - `GET /api/chats/{id}` — chat details + stats
  - `GET /api/chats/{id}/messages` — paginated messages

#### Verification Checkpoint ✅

- [ ] Parser handles all edge case test inputs correctly
- [ ] Upload endpoint accepts `.zip` and `.txt` files
- [ ] Messages appear in SQLite after upload
- [ ] Media files extracted to correct directories
- [ ] SSE progress stream works (test with curl)
- [ ] All unit tests pass: `pytest tests/`
- [ ] **Commit & Push**: `git commit -m "feat: WhatsApp parser + upload API + SSE progress" && git push`

---

### 🏷️ Sprint 2 — Classification + Enrichment Engine (Day 6–8)

**Goal**: Every message gets classified by type. Links get OG metadata. PDFs get text extracted.

#### Tasks

- [ ] Implement `backend/app/services/classifier.py`:
  - Regex URL detection with sub-classification (YouTube, Drive, Amazon, Twitter, news, generic)
  - File extension detection (images, videos, PDFs, docs, audio, contacts)
  - Location detection (Google Maps links, "Location:" pattern)
  - Set `type` field on every message row
  - Create `links` table rows for URL messages
  - Create `media_items` table rows for media messages
- [ ] Implement `backend/app/services/og_fetcher.py`:
  - Async `httpx` fetcher for Open Graph metadata (title, description, image)
  - Rate-limited: ~1 req/sec to avoid blocks
  - Batched processing for multiple links
  - Graceful failure (skip if site blocks/timeouts)
- [ ] Implement `backend/app/services/pdf_extractor.py`:
  - PyMuPDF text extraction (first 2000 chars per PDF)
  - Store in `media_items.extracted_text`
- [ ] Implement `backend/app/services/tagger.py`:
  - Keyword triggers: "important", "urgent", "remember", "don't forget", "reminder", "note:", etc.
  - Emoji triggers: ❗ ‼️ ⚠️ 📌 📍 🔴 🔖 ✅ ☑️ 🚨
  - Create `important_flags` rows
  - Set `messages.is_important = 1`
- [ ] Add classification + enrichment as Steps 2–4 and Step 8 in the pipeline
- [ ] API endpoints:
  - `GET /api/chats/{id}/messages?type=link` — filter by type
  - `GET /api/chats/{id}/links` — all links with OG data
  - `GET /api/chats/{id}/important` — flagged messages
- [ ] Write unit tests for classifier

#### Verification Checkpoint ✅

- [ ] Messages correctly classified (links, images, videos, PDFs, etc.)
- [ ] OG metadata fetched for real URLs (test with YouTube, GitHub links)
- [ ] PDF text extraction works for sample PDFs
- [ ] Important messages flagged correctly
- [ ] API filters return correct results
- [ ] All tests pass
- [ ] **Commit & Push**: `git commit -m "feat: message classification + link enrichment + importance tagging" && git push`

---

### 🎨 Sprint 3 — Upload UI + Dashboard (Day 9–12)

**Goal**: Build the frontend — landing page, upload page with drag-and-drop + progress, chat list, and the main analytics dashboard.

> **Use skills**: `impeccable`, `ui-ux-pro-max`, `ui-designer`, `frontend-design`, Framer Motion

#### Tasks

- [ ] **Landing page** (`/`):
  - Hero section with animated gradient background (Framer Motion)
  - Feature cards with hover micro-animations
  - CTA button → navigate to `/app/upload`
  - Dark mode design with premium feel
- [ ] **App layout** (`/app/layout.tsx`):
  - Sidebar with chat list navigation
  - Top bar with search shortcut
  - Responsive: sidebar collapses on mobile
  - Framer Motion page transitions
- [ ] **Upload page** (`/app/upload`):
  - `react-dropzone` drag-and-drop zone with animated border
  - File type validation (`.zip`, `.txt` only)
  - SSE-powered progress bar (native `EventSource`)
  - Step-by-step progress display (which pipeline step is running)
  - Auto-redirect to dashboard on completion
- [ ] **Chat list** (`/app/chats`):
  - Card list of all uploaded chats
  - Show name, message count, date range, status
  - Stagger animation on load (Framer Motion)
- [ ] **Dashboard** (`/app/chats/[id]`):
  - Summary stat cards (total messages, senders, date range, media items) with count-up animation
  - Per-type panels (count + quick-access list for each media type)
  - Activity heatmap (Recharts) — message frequency by day/hour
  - Top senders breakdown (bar chart)
  - Link domain breakdown (pie/bar chart)
  - Click-through to filtered detail views
- [ ] **Zustand store** for global app state (current chat, sidebar state, theme)
- [ ] **API client** (`lib/api.ts`) — typed fetch wrappers for all backend endpoints
- [ ] Consistent color coding across all dashboard elements

#### Verification Checkpoint ✅

- [ ] Landing page looks premium with animations
- [ ] Upload flow works end-to-end (drop file → progress → redirect)
- [ ] Dashboard loads with real data from backend
- [ ] Charts render correctly with Recharts
- [ ] Responsive on mobile (sidebar collapses)
- [ ] Dark mode renders correctly
- [ ] No console errors
- [ ] **Commit & Push**: `git commit -m "feat: upload UI + analytics dashboard with Framer Motion" && git push`

---

### 📄 Sprint 4 — Per-Type Detail Views (Day 13–15)

**Goal**: Build dedicated views for each media type — links, images, videos, documents, and important messages.

> **Use skills**: `impeccable`, `ui-ux-pro-max`, `frontend-design`, Framer Motion

#### Tasks

- [ ] **Links view** (`/app/chats/[id]/links`):
  - List all URLs with title, domain, favicon, date shared
  - OG preview cards (title + description + image)
  - Group by domain (YouTube, Drive, Amazon, etc.)
  - Filter by domain, sender, date
  - Framer Motion list animations
- [ ] **Images view** (`/app/chats/[id]/images`):
  - Masonry grid layout of extracted images
  - Click to expand with sender info and date (modal with Framer Motion)
  - Download individual or all images
  - Lazy loading for performance
- [ ] **Videos view** (`/app/chats/[id]/videos`):
  - Video links with thumbnail previews
  - YouTube embed preview where possible
  - Local video files with HTML5 `<video>` playback
- [ ] **Documents view** (`/app/chats/[id]/docs`):
  - List with file name, size, sender, date
  - PDF text extraction preview (first 500 chars)
  - Download button
- [ ] **Important view** (`/app/chats/[id]/important`):
  - Chronological feed of all flagged messages
  - Grouped by trigger type (keyword, emoji, manual)
  - Manual flag/unflag toggle
  - Export to markdown
  - Amber highlight styling
- [ ] All views should use consistent type-based color coding
- [ ] All views should have empty states with onboarding prompts

#### Verification Checkpoint ✅

- [ ] All 5 detail views render correctly with real data
- [ ] Images served from `data/media/` via FastAPI
- [ ] Link OG cards display correctly
- [ ] Empty states show when no items of that type exist
- [ ] Manual importance flagging works
- [ ] **Commit & Push**: `git commit -m "feat: per-type detail views (links, images, videos, docs, important)" && git push`

---

### 🧠 Sprint 5 — NLP Pipeline (Embeddings + Clustering + Topics) (Day 16–19)

**Goal**: Wire up the NLP backend — sentence embeddings, topic clustering, LLM labeling, and FTS5 index. Build the Topics UI.

#### Tasks

- [ ] Implement `backend/app/services/embedder.py`:
  - Load `all-MiniLM-L6-v2` model (downloads once, then cached)
  - Batch encode messages (batch size 64)
  - Store embeddings as JSON arrays in `messages.embedding`
  - Handle large chats with `concurrent.futures.ProcessPoolExecutor`
- [ ] Implement `backend/app/services/clusterer.py`:
  - Load all embeddings into numpy matrix
  - HDBSCAN clustering (preferred) or K-Means fallback
  - Set `cluster_id` on each message
  - Create `clusters` table rows with centroid embeddings
- [ ] Implement `backend/app/services/llm.py`:
  - LLM abstraction layer with provider switch via `LLM_PROVIDER` env var
  - Gemini 2.0 Flash integration (Google AI Studio SDK)
  - Ollama fallback (HTTP to `localhost:11434`)
  - Rate limiting for Gemini free tier (15 req/min, 1500 req/day)
  - Prompt: "Label this cluster in 2-4 words: [sample messages]"
  - Generate cluster summary (1 sentence)
- [ ] Build FTS5 index (Step 9 of pipeline):
  - Bulk insert all message content into `messages_fts` virtual table
- [ ] Wire Steps 5–9 into the processing pipeline
- [ ] API endpoints:
  - `GET /api/chats/{id}/clusters` — all clusters with label, summary, count
  - `GET /api/chats/{id}/clusters/{cluster_id}/messages` — messages in cluster
- [ ] **Topics view** (`/app/chats/[id]/topics`):
  - Card grid of discovered clusters
  - Each card: topic label, message count, date range, summary
  - Click into cluster to see all messages
  - Timeline within the cluster
  - Framer Motion card animations

#### Verification Checkpoint ✅

- [ ] Embeddings generated for all text messages
- [ ] Clusters created with reasonable groupings
- [ ] Cluster labels are sensible (test with real chat data)
- [ ] FTS5 full-text search returns results
- [ ] Topics view renders cluster cards
- [ ] LLM abstraction switches between Gemini and Ollama via env var
- [ ] Full pipeline (all 10 steps) runs end-to-end without errors
- [ ] **Commit & Push**: `git commit -m "feat: NLP pipeline — embeddings, clustering, LLM labeling, FTS5" && git push`

---

### 🔍 Sprint 6 — Search (Day 20–22)

**Goal**: Full-text + semantic + filtered search across single and multiple chats.

#### Tasks

- [ ] Implement search API (`backend/app/api/search.py`):
  - **Keyword search**: SQLite FTS5 `MATCH` query
  - **Semantic search**: Load embeddings → numpy cosine similarity → top-K results
  - **Filter search**: by sender, date range, type, cluster, importance
  - **Shorthand filter parser**: `from:Mom`, `type:link`, `is:important`, `domain:youtube.com`, `before:2024-01`, `after:2023-06`
  - Combined endpoint: keyword + semantic + filters in one query
  - Cross-chat search: search across all uploaded chats
- [ ] **Search UI** (`/app/chats/[id]/search` and `/app/search`):
  - Search input with auto-complete suggestions
  - Filter chips (type, sender, date, importance)
  - Shorthand filter support in the search bar
  - Results show message in context (surrounding messages visible)
  - Highlight matched terms in results
  - Framer Motion result list animations
  - Cross-chat search toggle

#### Verification Checkpoint ✅

- [ ] FTS5 keyword search returns accurate results
- [ ] Semantic search returns semantically related messages
- [ ] Filters work correctly (sender, type, date, importance)
- [ ] Shorthand filters parse correctly
- [ ] Cross-chat search works
- [ ] Search UI is responsive and fast
- [ ] **Commit & Push**: `git commit -m "feat: full-text + semantic search with filters" && git push`

---

### 🕸️ Sprint 7 — Knowledge Graph Visualization (Day 23–26)

**Goal**: Interactive knowledge graph with Cytoscape.js — the visual centerpiece of the app.

> **Use skills**: `impeccable`, `ui-ux-pro-max`, `frontend-design`, Framer Motion

#### Tasks

- [ ] Implement `backend/app/services/graph_builder.py`:
  - Compute graph nodes from messages, senders, clusters, and link domains
  - Compute edges: "sent by", "replied to", "same topic", "same domain", "same time window"
  - Default: top 500 nodes; expand on demand for large graphs
  - Node metadata: type, importance, connection count
- [ ] API endpoint: `GET /api/chats/{id}/graph` — returns nodes + edges JSON
- [ ] **Graph view** (`/app/chats/[id]/graph`):
  - Cytoscape.js integration in Next.js
  - Node color by type (blue=links, coral=images, purple=videos, amber=docs, teal=audio, yellow=important, gray=text)
  - Node size scales with importance / connection count
  - Click node → expand connections + show detail side panel
  - Zoom, pan, and drag controls
  - Filter controls: by type, sender, cluster
  - Toggle: full graph vs. filtered views
  - Layout: force-directed (cose-bilkent) with physics
  - Smooth animated transitions when filtering/expanding
  - Loading skeleton while graph computes

#### Verification Checkpoint ✅

- [ ] Graph renders with correct node colors and sizes
- [ ] Click-to-expand works on nodes
- [ ] Detail side panel shows message/sender/cluster info
- [ ] Filter controls correctly show/hide nodes
- [ ] Performance acceptable with 500+ nodes
- [ ] Responsive on tablet/desktop
- [ ] **Commit & Push**: `git commit -m "feat: interactive knowledge graph with Cytoscape.js" && git push`

---

### 🎁 Sprint 8 — Polish, Export, Multi-Chat & Launch (Day 27–30)

**Goal**: Final polish — error handling, exports, multi-chat support, empty states, landing page, README, and end-to-end testing.

#### Tasks

- [ ] **Multi-chat support**:
  - Upload multiple chat exports, assign names
  - Switch between chats via sidebar
  - Cross-chat search
  - Unified "All Chats" graph view
- [ ] **Export features**:
  - Export any filtered view as `.md`, `.csv`, or `.json`
  - Export important messages as markdown
  - Export topic cluster as AI-generated summary
  - Copy individual message content
- [ ] **Error handling & edge cases**:
  - Pipeline error recovery (retry failed steps)
  - Upload validation (file size, format)
  - Network error handling on frontend
  - Toast notifications for actions (Framer Motion animated)
- [ ] **Empty states & onboarding**:
  - First-time user flow (no chats → prompt to upload)
  - Empty states for all detail views
  - Help tooltips / brief explanations
- [ ] **Settings page** (`/app/settings`):
  - LLM provider selection (Gemini / Ollama)
  - Data directory path display
  - API key configuration
- [ ] **README.md**:
  - Project description
  - Setup: clone → install → run (3 commands)
  - Screenshots
  - Tech stack summary
  - Environment variables
- [ ] **End-to-end testing**:
  - Test with real WhatsApp export files (personal, group, large 50k+ messages)
  - Test all media types
  - Test search, graph, and exports
  - Cross-browser testing (Chrome, Firefox)
  - Mobile responsiveness check
- [ ] Performance audit:
  - Large chat handling (lazy loading, pagination)
  - Graph performance with many nodes
  - Search response times

#### Verification Checkpoint ✅

- [ ] All features work end-to-end with real WhatsApp data
- [ ] Multi-chat switching works
- [ ] Exports produce valid `.md`, `.csv`, `.json` files
- [ ] Empty states render correctly
- [ ] Settings page works
- [ ] README is complete with setup instructions
- [ ] No console errors, no unhandled exceptions
- [ ] Mobile responsive across all pages
- [ ] **Final Commit & Push**: `git commit -m "feat: polish, exports, multi-chat, launch-ready" && git push`

---

## 📋 Sprint Summary Table

| Sprint | Name | Days | Key Deliverables |
|--------|------|------|-----------------|
| **0** | Project Init & Scaffold | 1–2 | Git repo, Next.js + FastAPI scaffold, SQLite schema, env setup |
| **1** | Parser + Upload API | 3–5 | WhatsApp parser, upload endpoint, SSE progress, unit tests |
| **2** | Classification + Enrichment | 6–8 | Message classifier, OG fetcher, PDF extractor, importance tagger |
| **3** | Upload UI + Dashboard | 9–12 | Landing page, upload UX, analytics dashboard, Framer Motion |
| **4** | Per-Type Detail Views | 13–15 | Links, images, videos, docs, important views |
| **5** | NLP Pipeline | 16–19 | Embeddings, clustering, LLM labeling, FTS5, topics view |
| **6** | Search | 20–22 | Full-text + semantic + filtered search UI |
| **7** | Knowledge Graph | 23–26 | Cytoscape.js interactive graph visualization |
| **8** | Polish & Launch | 27–30 | Multi-chat, exports, error handling, README, E2E testing |

---

## ⚠️ Out of Scope (Future Phases)

- WhatsApp Business API / real-time sync
- Voice note transcription
- Conversational AI chatbot over knowledge base
- Browser extension or mobile native app
- Multi-user access or public sharing
- Cloud database, external storage, or third-party auth
- Billing or subscription system

---

## 🔑 Environment Variables

```env
GEMINI_API_KEY=          # https://aistudio.google.com/app/apikey (free)
LLM_PROVIDER=gemini      # or: ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
DATA_DIR=./data
MEDIA_DIR=./data/media
DB_PATH=./data/knowledge.db
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

---

*Roadmap version: 1.0 — Generated from project-knowledge.md v2.0*
*Total sprints: 9 (Sprint 0–8) | Estimated timeline: 30 days*
*Skills to use: impeccable, ui-ux-pro-max, ui-designer, frontend-design, Framer Motion*
