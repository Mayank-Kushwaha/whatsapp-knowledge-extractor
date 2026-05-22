  # How to Run — WhatsApp Knowledge Extractor

  > This guide gives you exact, working PowerShell commands to get the project running in Antigravity, VS Code, or any IDE terminal. It also explains every file in the project and walks through the complete UI flow.

  ---

  ## Table of Contents

  1. [Prerequisites](#1-prerequisites)
  2. [Backend Setup — Step by Step](#2-backend-setup--step-by-step)
  3. [Frontend Setup — Step by Step](#3-frontend-setup--step-by-step)
  4. [Running Both Servers](#4-running-both-servers)
  5. [Backend File Reference](#5-backend-file-reference)
  6. [Frontend File Reference](#6-frontend-file-reference)
  7. [Complete UI Flow](#7-complete-ui-flow)

  ---

  ## 1. Prerequisites

  Before running anything, confirm these are installed on your machine.

  ### Required Software

  | Tool | Minimum Version | How to Check | Download |
  |------|----------------|--------------|----------|
  | Python | 3.11+ | `python --version` | [python.org](https://www.python.org/downloads/) |
  | Node.js | 18+ | `node --version` | [nodejs.org](https://nodejs.org/) |
  | npm | 8+ | `npm --version` | Comes with Node.js |
  | Git | Any | `git --version` | [git-scm.com](https://git-scm.com/) |

  Run these in PowerShell to verify:

  ```powershell
  python --version
  node --version
  npm --version
  git --version
  ```

  ### Free Gemini API Key (Required for Topic Labeling)

  1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
  2. Sign in with any Google account
  3. Click **Create API Key**
  4. Copy the key — you'll paste it into `backend/.env` in the next step

  No credit card. No billing. The free tier gives you 15 requests/minute and 1,500/day — more than enough.

  > **Want fully offline?** Skip the Gemini key and use Ollama instead. Install from [ollama.com](https://ollama.com), run `ollama pull llama3`, then set `LLM_PROVIDER=ollama` in your `.env`.

  ---

  <!-- SECTION: PREREQUISITES -->

  ## 2. Backend Setup — Step by Step

  All commands below are for **PowerShell** (works in Antigravity terminal, VS Code terminal, Windows Terminal, or any IDE).

  ### Step 2.1 — Navigate to the backend directory

  ```powershell
  cd d:\Mayank\workspace\whatsapp-knowledge-extractor\backend
  ```

  ### Step 2.2 — Create a Python virtual environment

  ```powershell
  python -m venv venv
  ```

  This creates a `venv/` folder inside `backend/`. It isolates all Python packages from your global Python installation.

  ### Step 2.3 — Activate the virtual environment

  ```powershell
  .\venv\Scripts\Activate.ps1
  ```

  Your prompt should now show `(venv)` at the start. If you get an execution policy error, run this once as Administrator and then retry:

  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

  ### Step 2.4 — Install all Python dependencies

  ```powershell
  pip install -r requirements.txt
  ```

  This installs FastAPI, SQLAlchemy, sentence-transformers, hdbscan, PyMuPDF, Gemini SDK, and all other dependencies. First run takes 2–5 minutes depending on your connection.

  > **If `hdbscan` fails to build on Windows**, try:
  > ```powershell
  > pip install hdbscan --no-build-isolation
  > ```
  > If it still fails, the app automatically falls back to K-Means clustering — no action needed.

  ### Step 2.5 — Create the `.env` file

  Create a new file at `backend/.env` with this content:

  ```env
  # Free Gemini API key — get it at https://aistudio.google.com/app/apikey
  GEMINI_API_KEY=your_actual_key_here

  # LLM provider: "gemini" or "ollama"
  LLM_PROVIDER=gemini

  # Ollama (only needed if LLM_PROVIDER=ollama)
  OLLAMA_BASE_URL=http://localhost:11434
  OLLAMA_MODEL=llama3

  # Data paths — these defaults work without any changes
  DATA_DIR=./data
  MEDIA_DIR=./data/media
  DB_PATH=./data/knowledge.db

  # Ports
  BACKEND_PORT=8000
  FRONTEND_PORT=3000
  ```

  You can create this file from PowerShell:

  ```powershell
  # Run from inside backend/ with venv activated
  New-Item -Path ".env" -ItemType File
  notepad .env
  ```

  Paste the content above, replace `your_actual_key_here` with your Gemini key, and save.

  ### Step 2.6 — Run the database migration

  ```powershell
  # Still inside backend/ with venv activated
  alembic upgrade head
  ```

  This creates `data/knowledge.db` with all 9 tables (chats, senders, messages, messages_fts, media_items, links, clusters, important_flags, pipeline_status).

  Expected output:
  ```
  INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
  INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
  INFO  [alembic.runtime.migration] Running upgrade  -> <hash>, initial schema
  ```

  ### Step 2.7 — Verify the backend starts

  ```powershell
  uvicorn app.main:app --reload --port 8000
  ```

  Expected output:
  ```
  INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
  INFO:     Started reloader process
  INFO:     Started server process
  INFO:     Waiting for application startup.
  INFO:     Application startup complete.
  ```

  Open `http://localhost:8000/health` in your browser — you should see `{"status":"ok"}`.
  Open `http://localhost:8000/docs` to see the full interactive API documentation.

  Press `Ctrl+C` to stop the server for now.

  ---

  <!-- SECTION: BACKEND_SETUP -->

  ## 3. Frontend Setup — Step by Step

  Open a **second PowerShell terminal** (keep the backend terminal available for later).

  ### Step 3.1 — Navigate to the frontend directory

  ```powershell
  cd d:\Mayank\workspace\whatsapp-knowledge-extractor\frontend
  ```

  ### Step 3.2 — Install Node.js dependencies

  ```powershell
  npm install
  ```

  This installs Next.js, React, Tailwind CSS, Framer Motion, Cytoscape.js, Recharts, Zustand, react-dropzone, and all other frontend packages. Takes 1–3 minutes on first run.

  ### Step 3.3 — Verify the frontend starts

  ```powershell
  npm run dev
  ```

  Expected output:
  ```
    ▲ Next.js 16.2.6
    - Local:        http://localhost:3000
    - Network:      http://192.168.x.x:3000

  ✓ Starting...
  ✓ Ready in 2.1s
  ```

  Open `http://localhost:3000` — you should see the landing page.

  Press `Ctrl+C` to stop for now.

  ---

  <!-- SECTION: FRONTEND_SETUP -->

  ## 4. Running Both Servers

  You need **two terminals open at the same time**. Here's the exact sequence:

  ### Terminal 1 — Backend

  ```powershell
  # Open a new PowerShell terminal in your IDE
  cd d:\Mayank\workspace\whatsapp-knowledge-extractor\backend
  .\venv\Scripts\Activate.ps1
  uvicorn app.main:app --reload --port 8000
  ```

  Leave this running. You'll see log output here as requests come in.

  ### Terminal 2 — Frontend

  ```powershell
  # Open a second PowerShell terminal in your IDE
  cd d:\Mayank\workspace\whatsapp-knowledge-extractor\frontend
  npm run dev
  ```

  Leave this running too.

  ### Verify Both Are Up

  ```powershell
  # In a third terminal or browser:
  # Backend health check
  curl http://localhost:8000/health

  # Frontend — just open in browser
  start http://localhost:3000
  ```

  ### Quick Reference — All Commands at a Glance

  ```powershell
  # ── BACKEND ──────────────────────────────────────────────────────────────────
  cd d:\Mayank\workspace\whatsapp-knowledge-extractor\backend
  .\venv\Scripts\Activate.ps1
  uvicorn app.main:app --reload --port 8000

  # ── FRONTEND ─────────────────────────────────────────────────────────────────
  cd d:\Mayank\workspace\whatsapp-knowledge-extractor\frontend
  npm run dev

  # ── TESTS (optional) ─────────────────────────────────────────────────────────
  cd d:\Mayank\workspace\whatsapp-knowledge-extractor\backend
  .\venv\Scripts\Activate.ps1
  pytest tests/ -v

  # ── DATABASE RESET (if you want a clean slate) ────────────────────────────────
  cd d:\Mayank\workspace\whatsapp-knowledge-extractor\backend
  .\venv\Scripts\Activate.ps1
  Remove-Item -Path "data\knowledge.db" -Force
  alembic upgrade head
  ```

  ### Useful URLs Once Running

  | URL | What It Is |
  |-----|-----------|
  | `http://localhost:3000` | The app — start here |
  | `http://localhost:3000/app/upload` | Upload page |
  | `http://localhost:3000/app/chats` | All uploaded chats |
  | `http://localhost:8000/docs` | FastAPI interactive API docs (Swagger UI) |
  | `http://localhost:8000/redoc` | FastAPI API docs (ReDoc format) |
  | `http://localhost:8000/health` | Backend health check |

  ---

  <!-- SECTION: RUNNING -->

  ## 5. Backend File Reference

  The backend is a FastAPI application in `backend/`. Here's what every file does.

  ### Project Structure

  ```
  backend/
  ├── app/
  │   ├── main.py                  # App entry point
  │   ├── api/                     # HTTP route handlers (11 files)
  │   ├── core/                    # Configuration
  │   ├── models/                  # Database models
  │   ├── services/                # Business logic (11 files)
  │   └── tasks/                   # Background processing
  ├── alembic/                     # Database migrations
  ├── tests/                       # Unit tests
  ├── data/                        # SQLite DB + media files (gitignored)
  ├── requirements.txt             # Python dependencies
  ├── alembic.ini                  # Alembic config
  └── .env                         # Environment variables (gitignored)
  ```

  ---

  ### `app/main.py` — Application Entry Point

  **What it does**: Creates the FastAPI app instance, registers all API routers, configures CORS for the frontend, mounts the `data/media/` directory as a static file server, and defines the `/health` endpoint.

  **Key responsibilities**:
  - `CORSMiddleware` configured to allow `http://localhost:3000`
  - All 10 API routers registered with the `/api` prefix
  - `StaticFiles` mount at `/media` pointing to `data/media/` — this is how the frontend loads images, videos, and PDFs
  - `/health` and `/api/health` endpoints for uptime checks

  ---

  ### `app/core/config.py` — Settings

  **What it does**: Loads all environment variables from `backend/.env` using pydantic-settings. Provides a single `settings` object imported throughout the app.

  **Key settings exposed**: `GEMINI_API_KEY`, `LLM_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `DATA_DIR`, `MEDIA_DIR`, `DB_PATH`.

  ---

  ### `app/models/db.py` — Database Models

  **What it does**: Defines all SQLAlchemy 2.0 ORM models. Each class maps to a SQLite table.

  **Models defined**:
  - `Chat` — one row per uploaded chat export
  - `Sender` — unique senders within a chat
  - `Message` — every parsed message with type, embedding, cluster, importance
  - `MediaItem` — metadata for extracted media files
  - `Link` — URL records with Open Graph metadata
  - `Cluster` — topic clusters with label, summary, centroid embedding
  - `ImportantFlag` — importance flags with trigger type and value
  - `PipelineStatus` — processing progress tracker (10 steps)

  Also defines the SQLite session factory (`SessionLocal`) and `get_db()` dependency for FastAPI route injection.

  ---

  ### `app/api/upload.py` — File Upload Endpoint

  **What it does**: Handles `POST /api/chats/upload`. Accepts a `.zip` or `.txt` file, creates a chat record in the database, and kicks off the 10-step processing pipeline as a FastAPI `BackgroundTask`.

  **Flow**:
  1. Receive file via `UploadFile`
  2. Generate a UUID for the chat
  3. Save the raw file bytes to a temp location
  4. Create a `Chat` row with `status="processing"`
  5. Call `background_tasks.add_task(run_pipeline, chat_id, file_bytes)`
  6. Return `{"chat_id": chat_id, "status": "processing"}` immediately

  The frontend uses the returned `chat_id` to poll the SSE progress endpoint.

  ---

  ### `app/api/chats.py` — Chat Management Endpoints

  **What it does**: CRUD endpoints for chat records.

  **Endpoints**:
  - `GET /api/chats` — list all uploaded chats with message counts and sender counts
  - `GET /api/chats/{id}` — full chat details including stats breakdown by message type
  - `DELETE /api/chats/{id}` — delete a chat and all its data
  - `GET /api/chats/{id}/progress` — **SSE endpoint** that streams pipeline progress to the frontend using `StreamingResponse` with `text/event-stream` content type

  ---

  ### `app/api/messages.py` — Message Endpoints

  **What it does**: Paginated access to messages with filtering.

  **Endpoints**:
  - `GET /api/chats/{id}/messages` — paginated messages with optional filters: `type`, `sender_id`, `date_from`, `date_to`, `is_important`, `cluster_id`
  - `GET /api/chats/{id}/messages/{message_id}` — single message with context (surrounding messages)

  ---

  ### `app/api/links.py` — Links Endpoints

  **What it does**: Access to all extracted URLs with their Open Graph metadata.

  **Endpoints**:
  - `GET /api/chats/{id}/links` — all links with OG title, description, image, domain, link type; supports filtering by domain, sender, date
  - `GET /api/chats/{id}/links/domains` — domain breakdown with counts (for the dashboard pie chart)

  ---

  ### `app/api/important.py` — Important Messages Endpoints

  **What it does**: Access to importance-flagged messages and manual flagging controls.

  **Endpoints**:
  - `GET /api/chats/{id}/important` — all flagged messages grouped by trigger type
  - `POST /api/chats/{id}/messages/{message_id}/flag` — manually flag a message as important
  - `DELETE /api/chats/{id}/messages/{message_id}/flag` — remove manual importance flag

  ---

  ### `app/api/clusters.py` — Topic Cluster Endpoints

  **What it does**: Access to NLP-generated topic clusters.

  **Endpoints**:
  - `GET /api/chats/{id}/clusters` — all clusters with label, summary, message count, date range
  - `GET /api/chats/{id}/clusters/{cluster_id}/messages` — paginated messages within a specific cluster

  ---

  ### `app/api/search.py` — Search Endpoints

  **What it does**: Multi-mode search across messages.

  **Endpoints**:
  - `GET /api/chats/{id}/search?q=...` — combined keyword + semantic search within one chat; supports shorthand filters (`from:`, `type:`, `is:`, `domain:`, `before:`, `after:`)
  - `GET /api/search?q=...` — cross-chat search across all uploaded chats

  **How it works**: Parses shorthand filters from the query string, runs FTS5 keyword search and numpy cosine similarity semantic search in parallel, blends scores (60% keyword / 40% semantic), returns top results with surrounding context.

  ---

  ### `app/api/graph.py` — Knowledge Graph Endpoint

  **What it does**: Computes and returns the graph data for Cytoscape.js.

  **Endpoints**:
  - `GET /api/chats/{id}/graph` — returns `{nodes: [...], edges: [...]}` JSON; supports `max_nodes` param (default 500) and filter params by type/sender/cluster

  ---

  ### `app/api/media.py` — Media Serving

  **What it does**: Serves extracted media files (images, videos, PDFs, audio) from the local `data/media/` directory with correct MIME types.

  ---

  ### `app/api/export.py` — Export Endpoints

  **What it does**: Generates downloadable exports of filtered data.

  **Endpoints**:
  - `GET /api/chats/{id}/export?format=md|csv|json` — export all messages or filtered subset
  - `GET /api/chats/{id}/important/export` — export important messages as Markdown
  - `GET /api/chats/{id}/clusters/{cluster_id}/export` — export cluster with AI-generated summary

  ---

  ### `app/services/parser.py` — WhatsApp Export Parser

  **What it does**: Parses the WhatsApp `.txt` export format into structured message objects. This is the most complex service — 500+ lines handling every edge case.

  **Handles**:
  - Standard format: `[DD/MM/YY, HH:MM:SS] Sender: Message`
  - Multi-line messages (continuation lines without timestamps)
  - Date variants: `DD/MM/YY`, `MM/DD/YY`, `YYYY-MM-DD`
  - Time variants: 12-hour (`3:42 PM`) and 24-hour (`15:42`)
  - Unicode sender names (Hindi, Arabic, Tamil, emoji in names)
  - Deleted messages (`"This message was deleted"`)
  - Edited messages (strips `<This message was edited>` suffix)
  - Forwarded messages (flags as forwarded in metadata)
  - `<Media omitted>` → records as `unknown_media` type
  - System messages (encryption notice, group events) → skipped

  **Output**: List of dicts with `timestamp`, `sender`, `content`, `media_ref`, `raw_line`.

  ---

  ### `app/services/classifier.py` — Message Type Classifier

  **What it does**: Assigns a `type` to every parsed message using regex and file extension detection. Also creates `Link` and `MediaItem` database rows.

  **Classification logic**:
  - URL regex → creates a `Link` row; sub-classifies as `youtube`, `drive`, `amazon`, `twitter`, or `generic`
  - File extension matching → creates a `MediaItem` row; classifies as `image`, `video`, `pdf`, `document`, `audio`, or `contact`
  - Google Maps URL or "Location:" text → `location`
  - Everything else → `text`

  ---

  ### `app/services/og_fetcher.py` — Open Graph Metadata Fetcher

  **What it does**: Fetches Open Graph metadata (title, description, image URL) for all extracted URLs using async `httpx`. Rate-limited to ~1 request/second to avoid being blocked.

  **Behavior**: Gracefully skips URLs that timeout, return errors, or block scrapers. Stores results in the `links` table.

  ---

  ### `app/services/pdf_extractor.py` — PDF Text Extractor

  **What it does**: Uses PyMuPDF (`fitz`) to extract the first 2000 characters of text from PDF files. Stores the result in `media_items.extracted_text` for preview in the Documents view.

  ---

  ### `app/services/tagger.py` — Importance Tagger

  **What it does**: Scans every message for keyword and emoji triggers. Creates `ImportantFlag` rows and sets `messages.is_important = 1`.

  **Triggers**:
  - 20 keyword patterns: "important", "urgent", "remember", "don't forget", "reminder", "note:", "save this", "critical", "action item", "todo", "task:", etc.
  - 23 emoji triggers: ❗ ‼️ ⚠️ 📌 📍 🔴 🔖 ✅ ☑️ 🚨 and more

  ---

  ### `app/services/embedder.py` — Sentence Embeddings

  **What it does**: Generates 384-dimensional sentence embeddings for all text messages using the `sentence-transformers/all-MiniLM-L6-v2` model. Runs entirely on CPU — no GPU required.

  **Key details**:
  - Model downloads automatically on first run (~90MB, cached after that)
  - Processes messages in batches of 64 for memory efficiency
  - Stores embeddings as JSON arrays in `messages.embedding` column: `"[0.12, -0.34, ...]"`
  - Singleton pattern — model loads once per process

  ---

  ### `app/services/clusterer.py` — Topic Clustering

  **What it does**: Loads all message embeddings into a numpy matrix and clusters them into semantic topic groups.

  **Algorithm**:
  1. Try HDBSCAN first (density-based, automatically determines cluster count)
  2. Fall back to K-Means if HDBSCAN fails or produces too few clusters
  3. Assigns `cluster_id` to each message
  4. Creates `Cluster` rows with centroid embeddings

  ---

  ### `app/services/llm.py` — LLM Abstraction Layer

  **What it does**: Single abstraction for all LLM calls. Switching providers is a one-line `.env` change.

  **Providers**:
  - `gemini` (default): Uses `google-generativeai` SDK with `gemini-2.0-flash` model. Adds 4-second delay between calls to respect the free tier rate limit (15 req/min).
  - `ollama`: HTTP POST to `http://localhost:11434/api/generate`. Fully local, no internet, no rate limits.

  **Used for**: Generating 2–4 word topic labels and 1-sentence summaries for each cluster.

  ---

  ### `app/services/fts_builder.py` — FTS5 Index Builder

  **What it does**: Bulk-inserts all message content into the `messages_fts` SQLite FTS5 virtual table. This enables fast full-text search with `MATCH` queries across all messages.

  ---

  ### `app/services/semantic_search.py` — Semantic Search

  **What it does**: Implements cosine similarity search over stored embeddings using numpy. At query time, loads all embeddings from SQLite into a numpy matrix, encodes the query with the same sentence-transformers model, and returns the top-K most similar messages.

  Fast enough for up to ~100k messages without any vector database.

  ---

  ### `app/services/graph_builder.py` — Knowledge Graph Builder

  **What it does**: Computes the nodes and edges for the Cytoscape.js knowledge graph from SQLite data.

  **Node types**: `message`, `sender`, `cluster` (topic), `domain` (link domain)

  **Edge types**:
  - `sent_by` — message → sender
  - `belongs_to` — message → cluster
  - `shared_link` — message → domain
  - `participates_in` — sender → cluster (if sender has messages in that cluster)

  Returns top N nodes (default 500) with full metadata for rendering.

  ---

  ### `app/tasks/pipeline.py` — Processing Pipeline

  **What it does**: Orchestrates all 10 processing steps as a single FastAPI `BackgroundTask`. Each step updates the `pipeline_status` table so the SSE endpoint can stream progress to the frontend.

  **Steps in order**:
  1. Parse `.txt` / extract `.zip`
  2. Classify messages
  3. Fetch OG metadata for links
  4. Extract PDF text
  5. Generate embeddings
  6. Cluster embeddings
  7. Label clusters with LLM
  8. Tag important messages
  9. Build FTS5 index
  10. Mark chat as `ready`

  ---

  ### `tests/` — Unit Tests

  | File | What It Tests | Tests |
  |------|--------------|-------|
  | `test_parser.py` | All WhatsApp parser edge cases | 40 |
  | `test_classifier.py` | Message type classification | 37 |
  | `conftest.py` | Shared pytest fixtures (in-memory SQLite DB) | — |
  | `sample_chat.txt` | Real-format WhatsApp export for integration tests | — |

  Run with: `pytest tests/ -v`

  ---

  <!-- SECTION: BACKEND_FILES -->

  ## 6. Frontend File Reference

  The frontend is a Next.js 16 app with the App Router in `frontend/`. Here's what every file does.

  ### Project Structure

  ```
  frontend/
  ├── app/
  │   ├── layout.tsx               # Root HTML shell
  │   ├── page.tsx                 # Landing page (/)
  │   ├── globals.css              # Global styles + CSS variables
  │   └── app/                    # App shell (all authenticated pages)
  │       ├── layout.tsx           # Sidebar + top bar layout
  │       ├── upload/page.tsx      # Upload page
  │       ├── chats/
  │       │   ├── page.tsx         # Chat list
  │       │   └── [id]/            # Per-chat pages
  │       │       ├── page.tsx     # Dashboard
  │       │       ├── graph/       # Knowledge graph
  │       │       ├── links/       # Links view
  │       │       ├── images/      # Images gallery
  │       │       ├── videos/      # Videos view
  │       │       ├── docs/        # Documents view
  │       │       ├── important/   # Important messages
  │       │       ├── topics/      # Topic clusters
  │       │       └── search/      # Per-chat search
  │       ├── search/page.tsx      # Cross-chat search
  │       └── settings/page.tsx    # Settings
  ├── components/
  │   └── ui/                     # shadcn/ui components
  ├── lib/
  │   ├── api.ts                  # Backend API client
  │   ├── store.ts                # Zustand global state
  │   └── utils.ts                # Utility functions
  ├── package.json                # Dependencies
  ├── next.config.ts              # Next.js config
  └── tsconfig.json               # TypeScript config
  ```

  ---

  ### `app/layout.tsx` — Root Layout

  **What it does**: The outermost HTML shell. Sets the `<html>` and `<body>` tags, loads fonts, applies the dark theme class, and wraps the app in any global providers.

  **Every page in the app renders inside this layout.**

  ---

  ### `app/page.tsx` — Landing Page (`/`)

  **What it does**: The public-facing landing page. Shows the hero section with animated gradient background, feature cards, and a "Get Started" CTA button that navigates to `/app/upload`.

  **Key UI elements**:
  - Animated mesh gradient background (Framer Motion)
  - Headline and subheadline with gradient text
  - 6 feature cards with glassmorphism styling and hover lift animations (staggered with Framer Motion)
  - Shimmer CTA button with arrow animation
  - Dark mode design throughout

  ---

  ### `app/globals.css` — Global Styles

  **What it does**: Defines CSS custom properties for the color system (all 9 media type colors), base Tailwind directives, and any global overrides.

  **Color variables defined here**:
  - `--color-link` (blue), `--color-image` (coral), `--color-video` (purple)
  - `--color-pdf` (amber), `--color-audio` (teal), `--color-important` (yellow)
  - `--color-text` (gray), `--color-contact` (green), `--color-location` (orange)

  ---

  ### `app/app/layout.tsx` — App Shell Layout

  **What it does**: The layout wrapper for all pages under `/app/*`. Renders the collapsible sidebar (chat list navigation) and the top bar (breadcrumbs + search shortcut). Applies Framer Motion page transition animations via `AnimatePresence`.

  **Sidebar behavior**:
  - Shows all uploaded chats as navigation items
  - Collapses to icon-only on mobile
  - Active chat highlighted
  - "Upload New Chat" button at the bottom

  ---

  ### `app/app/upload/page.tsx` — Upload Page (`/app/upload`)

  **What it does**: The file upload interface. Uses `react-dropzone` for drag-and-drop, validates file types (`.zip` and `.txt` only), uploads to `POST /api/chats/upload`, then opens an `EventSource` SSE connection to stream the 10-step pipeline progress.

  **Key UI elements**:
  - Animated dashed-border drop zone (border pulses on drag-over)
  - File type validation with error display
  - 10-step progress bar — each step shows an icon, name, and status (pending / running / complete / error)
  - Auto-redirect to `/app/chats/[id]` dashboard 1.5 seconds after completion

  **SSE connection**:
  ```typescript
  const es = new EventSource(`/api/chats/${chatId}/progress`);
  es.onmessage = (e) => {
    const status = JSON.parse(e.data);
    setProgress(status);
    if (status.complete) { es.close(); router.push(`/app/chats/${chatId}`); }
  };
  ```

  ---

  ### `app/app/chats/page.tsx` — Chat List (`/app/chats`)

  **What it does**: Shows all uploaded chats as cards. Each card displays the chat name, message count, date range, sender count, and processing status badge.

  **Animations**: Cards stagger in with Framer Motion fade-up on load.

  ---

  ### `app/app/chats/[id]/page.tsx` — Dashboard (`/app/chats/[id]`)

  **What it does**: The main analytics dashboard for a specific chat. Fetches chat stats from `GET /api/chats/{id}` and renders all panels.

  **Panels**:
  - 4 summary stat cards (total messages, senders, date range, media items) — numbers animate up with a count-up effect on load
  - Per-type breakdown — one row per media type with count, color-coded progress bar, and a "View All" link
  - Activity heatmap — Recharts bar chart showing message frequency by day of week
  - Top senders — horizontal bar chart of most active senders
  - Link domain breakdown — progress bars for top 6 domains (YouTube, Drive, Amazon, etc.)

  ---

  ### `app/app/chats/[id]/links/page.tsx` — Links View

  **What it does**: Shows all extracted URLs with Open Graph preview cards. Fetches from `GET /api/chats/{id}/links`.

  **Features**:
  - Domain filter chips at the top (YouTube, Drive, Amazon, Twitter, Generic)
  - Each link card shows: favicon, OG title, OG description, OG image, domain badge, sender name, date
  - Collapsible filter panel (by sender, date range)
  - Framer Motion stagger animations on card list
  - Empty state with prompt to upload a chat with links

  ---

  ### `app/app/chats/[id]/images/page.tsx` — Images Gallery

  **What it does**: Masonry grid of all extracted images served from `data/media/` via the backend's static file mount.

  **Features**:
  - CSS columns masonry layout (no JS masonry library needed)
  - `IntersectionObserver` for lazy loading — images only load when scrolled into view
  - Click any image → opens a `LightboxModal` with spring animation (Framer Motion)
  - Lightbox shows: full-size image, sender name, timestamp, download button
  - "Download All" button

  ---

  ### `app/app/chats/[id]/videos/page.tsx` — Videos View

  **What it does**: Lists all video content — both YouTube links and locally extracted video files.

  **Features**:
  - YouTube links show thumbnail (via `img.youtube.com/vi/{id}/hqdefault.jpg`) and an "Embed" button
  - Clicking "Embed" opens a modal with the YouTube iframe player
  - Local `.mp4`/`.mov` files render with an HTML5 `<video>` element with controls
  - Sender name and date shown on each card

  ---

  ### `app/app/chats/[id]/docs/page.tsx` — Documents View

  **What it does**: Lists all PDF and document files extracted from the chat.

  **Features**:
  - Each card shows: file name, file size, MIME type icon, sender, date
  - "Preview" button expands a collapsible panel showing the first 500 characters of extracted PDF text
  - "Download" button links to the file served from the backend
  - Filter by file type (PDF, DOCX, XLSX, etc.)

  ---

  ### `app/app/chats/[id]/important/page.tsx` — Important Messages Feed

  **What it does**: Chronological feed of all messages flagged as important.

  **Features**:
  - Filter chips: All / Keyword / Emoji / Manual
  - Each message card has amber highlight styling
  - Shows the trigger that caused the flag (e.g., "Flagged by keyword: 'important'")
  - Toggle button to manually unflag a message (calls `DELETE /api/chats/{id}/messages/{id}/flag`)
  - "Export as Markdown" button — downloads all important messages as a `.md` file
  - Empty state if no important messages found

  ---

  ### `app/app/chats/[id]/topics/page.tsx` — Topics View

  **What it does**: Card grid of all NLP-discovered topic clusters.

  **Features**:
  - Each cluster card shows: topic label (2–4 words from Gemini), 1-sentence summary, message count, date range
  - Stagger animation on card grid load (Framer Motion)
  - Click a card → expands to show all messages in that cluster with a timeline
  - Back button returns to the cluster grid

  ---

  ### `app/app/chats/[id]/search/page.tsx` — Per-Chat Search

  **What it does**: Search interface for a single chat. Calls `GET /api/chats/{id}/search`.

  **Features**:
  - Debounced search input (350ms) — results update as you type
  - Type filter chips (link, image, video, pdf, text, important)
  - "Important only" toggle
  - Shorthand filter help text (shows examples: `from:Mom`, `type:link`, `is:important`)
  - Results show the matched message with 2 surrounding context messages
  - Matched terms highlighted in yellow
  - Framer Motion `AnimatePresence` for result list transitions

  ---

  ### `app/app/search/page.tsx` — Cross-Chat Global Search

  **What it does**: Search across all uploaded chats simultaneously. Calls `GET /api/search`.

  **Features**:
  - Same search UI as per-chat search
  - Results grouped by chat name
  - Shows which chat each result came from
  - Cross-chat toggle to switch between global and single-chat mode

  ---

  ### `app/app/chats/[id]/graph/page.tsx` — Knowledge Graph

  **What it does**: The interactive knowledge graph visualization. Fetches graph data from `GET /api/chats/{id}/graph` and renders it with Cytoscape.js via `react-cytoscapejs`.

  **Features**:
  - Node colors by type: blue (links), coral (images), purple (videos), amber (docs/PDFs), teal (audio), yellow (important), gray (text), emerald (senders), indigo (topics)
  - Node size scales with connection count and importance score
  - Force-directed layout (`cose`) with physics simulation
  - Click a node → animated side panel slides in showing node metadata (message content, sender, date, cluster, connections)
  - Filter bar at top: All / Senders / Topics / Domains / Important
  - Zoom in/out buttons, fit-to-screen button
  - Loading spinner while graph data fetches
  - Empty state if chat has no graph data yet

  ---

  ### `app/app/settings/page.tsx` — Settings

  **What it does**: App configuration page.

  **Settings available**:
  - LLM provider selector (Gemini / Ollama)
  - Gemini API key input field (masked)
  - Ollama base URL and model name
  - Data directory path display
  - "Clear all data" button (with confirmation dialog)

  ---

  ### `lib/api.ts` — Backend API Client

  **What it does**: Typed TypeScript fetch wrappers for every backend endpoint. All API calls in the frontend go through this file — no raw `fetch()` calls scattered across components.

  **Exports**:
  - `chatApi` — `getChats()`, `getChat(id)`, `deleteChat(id)`, `getProgress(id)` (returns EventSource)
  - `messageApi` — `getMessages(chatId, filters)`, `getMessage(chatId, messageId)`
  - `linkApi` — `getLinks(chatId, filters)`, `getDomains(chatId)`
  - `importantApi` — `getImportant(chatId)`, `flagMessage(chatId, messageId)`, `unflagMessage(chatId, messageId)`
  - `clusterApi` — `getClusters(chatId)`, `getClusterMessages(chatId, clusterId)`
  - `searchApi` — `search(chatId, query, filters)`, `globalSearch(query)`
  - `graphApi` — `getGraph(chatId, params)`
  - `exportApi` — `exportMessages(chatId, format)`, `exportImportant(chatId)`, `exportCluster(chatId, clusterId)`
  - `TYPE_CONFIG` — color, icon, and label mapping for all 9 message types (used across all views for consistent styling)

  ---

  ### `lib/store.ts` — Zustand Global State

  **What it does**: Global client-side state store. Avoids prop drilling across deeply nested components.

  **State slices**:
  - `theme` — `'dark' | 'light'` (dark by default)
  - `sidebarOpen` — boolean, controls sidebar collapse on mobile
  - `chats` — array of all uploaded chats (populated on app load)
  - `currentChatId` — the currently selected chat
  - `uploadState` — `{ status, progress, chatId }` for the upload flow

  ---

  ### `lib/utils.ts` — Utility Functions

  **What it does**: Shared helper functions used across components.

  **Key exports**:
  - `cn(...classes)` — Tailwind class merging using `clsx` + `tailwind-merge`
  - `formatDate(date)` — formats timestamps for display
  - `formatFileSize(bytes)` — converts bytes to human-readable string
  - `getDomainFromUrl(url)` — extracts domain from a URL string
  - `getYouTubeId(url)` — extracts YouTube video ID for thumbnail generation

  ---

  ### `components/ui/` — shadcn/ui Components

  **What it does**: Pre-built, accessible UI components from shadcn/ui. These are copied into the project (not imported from a package) so they can be customized.

  **Components present**: Button, Card, Badge, Dialog, Input, Select, Tabs, Tooltip, Progress, Skeleton, and more. All styled with Tailwind and compatible with the dark theme.

  ---

  ### `next.config.ts` — Next.js Configuration

  **What it does**: Configures Next.js for this project.

  **Key config**:
  - API rewrites: proxies `/api/*` requests to `http://localhost:8000/api/*` — this is why the frontend can call `/api/chats` without specifying the full backend URL
  - Image domains: allows images from `localhost:8000` for OG images and media served by FastAPI

  ---

  <!-- SECTION: FRONTEND_FILES -->
  <!-- SECTION: UI_FLOW -->
