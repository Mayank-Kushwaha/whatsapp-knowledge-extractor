# 📱 WhatsApp Knowledge Extractor

Turn your WhatsApp chat exports into a searchable, classified, visually-graphed knowledge base. Sign in with Google, drag-and-drop a chat export, and get a topic-clustered dashboard, a knowledge graph, and multi-mode search across every link, image, video, PDF, and important note you ever sent.

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%2B%20FastAPI-green)
![DB](https://img.shields.io/badge/db-Turso%20(libSQL)%20%2F%20SQLite-lightgrey)
![Media](https://img.shields.io/badge/media-Cloudinary%20%2F%20Local-orange)
![Auth](https://img.shields.io/badge/auth-Google%20OAuth-red)
![AI](https://img.shields.io/badge/embeddings-Gemini%20%2F%20Local-purple)
![Deploy](https://img.shields.io/badge/deploy-Vercel%20%2B%20Render%20(stateless)-blue)

---

## What Is This?

WhatsApp Knowledge Extractor is a full-stack web app that ingests `.zip` or `.txt` WhatsApp exports and turns them into a personal, multi-user knowledge base. Every message is parsed, classified by type, enriched (OG metadata for links, text extraction for PDFs), embedded with a sentence-embedding model, clustered into semantic topics, labeled with Gemini 2.0 Flash, and indexed in SQLite/FTS5. The frontend surfaces it as a dashboard with per-type views, an interactive Cytoscape knowledge graph, cross-chat search, and Markdown/CSV/JSON export.

The backend runs against **two interchangeable storage layers**, selected at startup from environment variables:

| Layer | Local / dev default | Production default (Render free tier) |
|-------|---------------------|----------------------------------------|
| Relational DB | Local SQLite file (`./data/knowledge.db`) | **Turso** (managed libSQL over HTTPS) |
| Media files (images, videos, PDFs, audio, docs) | Local filesystem (`./data/media`) | **Cloudinary** (uploads + CDN) |

This split makes the Render container fully **stateless** — no persistent disk is required in production. The exact same Alembic migrations, ORM queries, FTS5 virtual tables, and StaticFiles helpers run unchanged across both modes; only `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` and `MEDIA_BACKEND=cloudinary` flip them over.

**The core problem it solves**: WhatsApp is the world's largest informal notes app. People paste Drive links, YouTube videos, PDFs, addresses, and reminders into chats and never find them again. This app turns that chaos into something you can actually search and browse.

### Who Is It For?

- People who use "Saved Messages" or personal chats as a notes app
- Small teams or families coordinating shared resources via WhatsApp
- Researchers, students, and professionals who share materials in groups
- Anyone in India, Southeast Asia, Latin America, or the Middle East where WhatsApp is the primary communication layer

---

## What's New

- **Turso (libSQL) database backend** — set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` and the SQLAlchemy engine targets a managed libSQL database over HTTPS instead of a local SQLite file. libSQL is wire-compatible with SQLite, so the same schema, FTS5 search tables, and Alembic migrations run unchanged. Falls back to a local `knowledge.db` automatically when the env vars are absent, so dev still works offline.
- **Cloudinary media storage backend** — set `MEDIA_BACKEND=cloudinary` and uploaded media files (images, videos, PDFs, audio, docs) are streamed to Cloudinary instead of `./data/media`. Each file is scoped to `users/<owner_id>/chats/<chat_id>/<type>/` and `media_items.local_path` stores the returned `secure_url`. Chat deletion best-effort deletes the per-chat Cloudinary folder for all three resource types (image / video / raw).
- **Stateless Render free-tier deployment** — with Turso + Cloudinary configured, the backend container holds no persistent state. No 1 GB disk attachment, no DATA_DIR survivorship issues across restarts.
- **Google OAuth sign-in (NextAuth v5 / Auth.js v5)** — every chat is scoped to the signed-in user's Google `sub`. No more shared inbox; multiple people can use the same deployment without seeing each other's data.
- **Pluggable embedding provider** — choose between hosted **Gemini embeddings (`gemini-embedding-001`, 768-dim)** for production and **local sentence-transformers (`all-MiniLM-L6-v2`, 384-dim)** for fully-offline development.
- **Vercel + Render production recipe** — environment-driven CORS, Vercel preview-deploy support, direct-to-backend uploads that bypass Vercel's 4.5 MB proxy limit.
- **Token-rotated sessions** — Google ID tokens are refreshed automatically in the NextAuth JWT callback; users stay signed in indefinitely.

---

## Features

### Storage Backends (Switch via Env Vars)

| Concern | Local mode | Cloud mode |
|---------|------------|------------|
| Database | SQLite file at `DB_PATH` (default `./data/knowledge.db`). WAL journaling + foreign keys enabled via PRAGMA on connect. | Turso (libSQL over HTTPS). Activates when both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set. Engine URL is rewritten to `sqlite+libsql://<host>/?secure=true` and the auth token is passed via `connect_args` (NOT the URL query string — sqlalchemy-libsql 0.2.0 silently drops the latter). |
| Media files | `MEDIA_BACKEND=local` (default). Files saved under `MEDIA_DIR/<chat_id>/`, served by FastAPI `StaticFiles` mounted at `/media`. | `MEDIA_BACKEND=cloudinary`. Files streamed to Cloudinary; `media_items.local_path` stores the `secure_url`. The `/media` mount is skipped on startup. |
| URL rendering on the frontend | `mediaUrl()` prefixes the value with `${API_BASE}/media/`. | `mediaUrl()` detects an absolute `https://` URL and renders it as-is — no proxying. |

Switching is purely env-driven — no code changes, and no migration step. The two modes can be mixed (e.g. Turso DB + local media on a paid Render disk, or local SQLite + Cloudinary for one-off testing).

### Authentication
- Sign in with Google (NextAuth v5 Google provider)
- The frontend forwards the Google ID token to the backend as `Authorization: Bearer <id_token>`
- Backend verifies the token's signature against Google's JWKS and checks the `aud` claim against `GOOGLE_CLIENT_ID`
- Every chat is owned by a single user (`chats.owner_id = <Google sub>`); the API returns 404 (not 403) on cross-user access so nothing leaks about other users' data
- Refresh tokens are stored in the session JWT and rotated automatically when the ID token is within 60s of expiry

### Upload & Ingestion
- Drag-and-drop upload of WhatsApp `.zip` export (with media) or standalone `.txt` file
- Uploads bypass Vercel's 4.5 MB proxy body limit by POSTing directly to the backend at `NEXT_PUBLIC_API_URL`
- Real-time 10-step progress bar powered by Server-Sent Events
- Handles chats with 50,000+ messages
- Extracts every embedded media file (images, videos, PDFs, audio, documents) and persists it through the configured storage backend — local filesystem in dev, Cloudinary in production

### Auto-Classification
Every message is classified into one of:

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
- **Keywords**: "important", "urgent", "remember", "don't forget", "reminder", "note:", "save this", "critical", "action item", "todo", "task:"
- **Emojis**: ❗ ‼️ ⚠️ 📌 📍 🔴 🔖 ✅ ☑️ 🚨
- **Manual flagging** — flag/unflag any message inside the app

### Embeddings (Two Providers, Switch via `EMBEDDING_PROVIDER`)

| Mode | Model | Dimensions | Best For |
|------|-------|------------|----------|
| `gemini` (default) | `gemini-embedding-001` | 768 | Production. Hosted, fast, no local RAM cost. Free tier: 100 req/min, 1,000 req/day. |
| `local` | `sentence-transformers/all-MiniLM-L6-v2` | 384 | Dev / offline. Runs on CPU, no quotas. Needs ~500 MB RAM (PyTorch). OOMs on Render free tier. |

The embedder auto-throttles Gemini calls (~92 RPM by default) and parses Google's `retry_delay` header on 429 errors to back off correctly. Embedding dimensions differ per provider, so switching providers requires re-uploading existing chats.

### Topic Clustering
- HDBSCAN density-based clustering (with K-Means fallback if HDBSCAN fails to install)
- Each cluster gets a 2–4 word label + 1-sentence summary from Gemini 2.0 Flash (free tier)
- Browse all topics in the Topics view

### Multi-Mode Search
- **Keyword search**: SQLite FTS5 full-text search
- **Semantic search**: Cosine similarity over stored embeddings (numpy)
- **Filter search**: By sender, date range, type, cluster, importance
- **Shorthand filters**: `from:Mom`, `type:link`, `is:important`, `domain:youtube.com`, `before:2024-01`, `after:2023-06`
- **Cross-chat search**: Across all of your uploaded chats simultaneously

### Analytics Dashboard
- Summary stat cards: total messages, unique senders, date range, media items
- Per-type panels with counts and quick-access lists
- Activity heatmap: message frequency by day of week / hour of day
- Top senders breakdown; link-domain breakdown

### Knowledge Graph
- Interactive Cytoscape.js node-link graph
- Nodes represent messages, senders, topics, and link domains
- Node color encodes type; node size encodes importance / connections
- Click any node to expand connections + see a detail panel
- Filter by type, sender, or cluster; zoom, pan, drag

### Per-Type Detail Views
- **Links**: OG preview cards (title, description, image); grouped by domain
- **Images**: Masonry grid with click-to-expand lightbox; download
- **Videos**: YouTube embed previews; HTML5 playback for local videos
- **Documents**: PDF text preview (first 500 chars); download
- **Important**: Chronological feed grouped by trigger type; export to Markdown

### Export
- `.md`, `.csv`, or `.json` for any filtered view
- Markdown export of important messages
- AI-generated summary per topic cluster

---

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 8+ | `npm --version` |
| Git | recent | `git --version` |

You will also need:

- **A Google Cloud OAuth 2.0 Client ID + Secret** (for sign-in). Create one at [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) → Credentials → Create Credentials → OAuth client ID → Web application. Add `http://localhost:3000/api/auth/callback/google` (and your production URL) as authorized redirect URIs.
- **A free Gemini API key** for cluster labeling and (in `gemini` mode) embeddings. Get one at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — no credit card required.

**Production-only** (skip for local dev):

- **A Turso account + database** for managed libSQL. Install the [Turso CLI](https://docs.turso.tech/cli/installation), then `turso db create whatsapp-extractor`, `turso db show whatsapp-extractor --url` (for `TURSO_DATABASE_URL`), and `turso db tokens create whatsapp-extractor` (for `TURSO_AUTH_TOKEN`). Free tier covers 9 GB total storage and 1 billion row reads / month.
- **A Cloudinary account** for media hosting. Sign up at [cloudinary.com](https://cloudinary.com/), then grab `Cloud Name`, `API Key`, and `API Secret` from the dashboard's "Account Details" panel. Free tier is 25 GB storage + 25 GB monthly delivery bandwidth.

If you prefer to run fully offline, you can swap the LLM for Ollama and the embedder for the local provider, and leave the Turso/Cloudinary env vars unset (the engine falls back to local SQLite + local filesystem).

---

## How to Export Your WhatsApp Chat

### Android
1. Open WhatsApp → open the chat
2. Three-dot menu (⋮) → **More** → **Export Chat**
3. Choose **Include Media** (full export) or **Without Media** (text only)
4. Save the `.zip` file to your computer

### iOS
1. Open WhatsApp → open the chat
2. Tap the contact/group name at the top → **Export Chat**
3. Choose **Attach Media** or **Without Media**
4. AirDrop / email / save the `.zip` file

---

## Setup & Installation

### 1. Clone

```bash
git clone <your-repo-url>
cd whatsapp-knowledge-extractor
```

### 2. Backend

```bash
cd backend

# Virtual environment
python -m venv venv

# Activate (Windows PowerShell)
.\venv\Scripts\Activate.ps1
# or (macOS/Linux)
source venv/bin/activate

# Install
pip install -r requirements.txt
```

### 3. Backend Environment Variables

Copy `.env.example` to `backend/.env`:

```env
# === Authentication ===
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com

# === LLM (cluster labeling) ===
GEMINI_API_KEY=your-gemini-api-key
LLM_PROVIDER=gemini                  # "gemini" or "ollama"
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# === Embeddings ===
EMBEDDING_PROVIDER=gemini            # "gemini" (production) or "local" (dev)
EMBEDDING_MODEL=gemini-embedding-001 # or all-MiniLM-L6-v2 for local
EMBEDDING_BATCH_SIZE=64

# === Database ===
# Leave BOTH blank for local SQLite (default — uses DB_PATH below).
# Set both to point at a Turso libSQL database (production).
TURSO_DATABASE_URL=                  # libsql://<db>-<org>.turso.io
TURSO_AUTH_TOKEN=                    # turso db tokens create <name>

# === Media storage ===
MEDIA_BACKEND=local                  # "local" (dev) or "cloudinary" (prod)
CLOUDINARY_CLOUD_NAME=               # required if MEDIA_BACKEND=cloudinary
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# === Paths (used for local DB/media; harmless when Turso/Cloudinary are on) ===
DATA_DIR=./data
MEDIA_DIR=./data/media
DB_PATH=./data/knowledge.db

# === Server ===
BACKEND_PORT=8000
FRONTEND_PORT=3000

# === CORS — production ===
# Comma-separated list. Local dev is auto-allowed.
FRONTEND_ORIGIN=
```

### 4. Database

```bash
# inside backend/ with venv active
alembic upgrade head
```

By default this creates `data/knowledge.db` (local SQLite) with all tables including `chats.owner_id` for Google-scoped ownership.

If `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in `backend/.env`, Alembic runs the same migrations against the remote Turso database instead. The same command works for both modes; the engine in `app/models/db.py` picks the right backend at import time, and `alembic/env.py` reuses that engine so the auth token survives.

### 5. Frontend

```bash
cd ../frontend
npm install
```

Create `frontend/.env.local`:

```env
# NextAuth v5 / Auth.js
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Google OAuth — same client as the backend
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Backend URL (uploads bypass the Vercel/Next rewrite proxy and POST here directly)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Running Locally

You need two terminals.

### Terminal 1 — Backend

```bash
cd backend
.\venv\Scripts\Activate.ps1   # Windows
# source venv/bin/activate    # macOS/Linux
uvicorn app.main:app --reload --port 8000
```

API at `http://localhost:8000`. Docs at `http://localhost:8000/docs`. Health check:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

App at `http://localhost:3000`.

### First-Run Flow
1. Visit `http://localhost:3000` → sign in with Google
2. Upload your `.zip`/`.txt`
3. Watch the 10-step SSE progress bar
4. Land on the dashboard; explore Topics, Graph, Search, Important, etc.

---

## Processing Pipeline

When you upload, these 10 steps run as a FastAPI BackgroundTask. Progress streams to the UI via SSE.

| Step | Name | Source |
|------|------|--------|
| 1 | Parse messages | `services/parser.py` |
| 2 | Classify content | `services/classifier.py` |
| 3 | Enrich links (OG metadata) | `services/og_fetcher.py` |
| 4 | Extract PDF text | `services/pdf_extractor.py` |
| 5 | Generate embeddings (Gemini or local) | `services/embedder.py` |
| 6 | Cluster topics (HDBSCAN / K-Means) | `services/clusterer.py` |
| 7 | Label clusters (Gemini 2.0 Flash) | `services/llm.py` |
| 8 | Tag importance | `services/tagger.py` |
| 9 | Build FTS5 search index | `services/fts_builder.py` |
| 10 | Mark complete; emit SSE done event | `tasks/pipeline.py` |

---

## Application Routes

| Route | Page |
|-------|------|
| `/` | Landing page (sign-in CTA) |
| `/api/auth/[...nextauth]` | NextAuth handler (Google sign-in callback) |
| `/docs` | In-app docs |
| `/app/upload` | Upload chat export |
| `/app/chats` | Your uploaded chats |
| `/app/chats/[id]` | Chat dashboard |
| `/app/chats/[id]/graph` | Knowledge graph |
| `/app/chats/[id]/links` | Links view with OG cards |
| `/app/chats/[id]/images` | Image gallery + lightbox |
| `/app/chats/[id]/videos` | Videos + YouTube embeds |
| `/app/chats/[id]/docs` | PDFs and documents |
| `/app/chats/[id]/important` | Important messages |
| `/app/chats/[id]/topics` | Topic clusters |
| `/app/chats/[id]/search` | Per-chat search |
| `/app/search` | Cross-chat global search |
| `/app/settings` | LLM / embedding provider, API key |

---

## Project Structure

```
whatsapp-knowledge-extractor/
├── frontend/                          # Next.js 16, React 19, TypeScript, Tailwind v4
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (wraps Providers / SessionProvider)
│   │   ├── page.tsx                   # Landing page with Google sign-in
│   │   ├── providers.tsx              # NextAuth SessionProvider
│   │   ├── globals.css
│   │   ├── api/auth/[...nextauth]/route.ts   # NextAuth v5 handlers
│   │   ├── docs/page.tsx              # In-app documentation
│   │   └── app/                       # Authenticated app shell
│   │       ├── layout.tsx             # Sidebar + top bar (requires session)
│   │       ├── upload/page.tsx
│   │       ├── chats/page.tsx
│   │       ├── chats/[id]/page.tsx
│   │       ├── chats/[id]/{graph,links,images,videos,docs,important,topics,search}/page.tsx
│   │       ├── search/page.tsx
│   │       └── settings/page.tsx
│   ├── auth.ts                        # NextAuth v5 config: Google provider, JWT, token refresh
│   ├── components/ui/                 # shadcn/ui
│   ├── lib/
│   │   ├── api.ts                     # Typed fetch client; attaches Bearer ID token
│   │   ├── store.ts                   # Zustand global state
│   │   └── utils.ts
│   ├── next.config.ts                 # Rewrites /api → NEXT_PUBLIC_API_URL
│   ├── proxy.ts
│   └── package.json
│
├── backend/                           # FastAPI, Python 3.11+
│   ├── app/
│   │   ├── main.py                    # FastAPI entrypoint, CORS, routers, StaticFiles for media
│   │   ├── api/                       # upload, chats, messages, links, important, clusters,
│   │   │                              # search, graph, media, export
│   │   ├── core/
│   │   │   ├── config.py              # Env-driven settings (paths, providers, OAuth, CORS)
│   │   │   └── auth.py                # Google ID token verification + require_owned_chat
│   │   ├── models/db.py               # SQLAlchemy 2.0 ORM (chats.owner_id, etc.)
│   │   ├── services/
│   │   │   ├── parser.py
│   │   │   ├── classifier.py          # writes media via services/storage.py
│   │   │   ├── storage.py             # MediaStorage interface: LocalStorage | CloudinaryStorage
│   │   │   ├── og_fetcher.py
│   │   │   ├── pdf_extractor.py
│   │   │   ├── tagger.py
│   │   │   ├── embedder.py            # Gemini (gemini-embedding-001) or local sentence-transformers
│   │   │   ├── clusterer.py
│   │   │   ├── llm.py                 # Gemini 2.0 Flash with Ollama fallback
│   │   │   ├── fts_builder.py
│   │   │   ├── semantic_search.py
│   │   │   └── graph_builder.py
│   │   └── tasks/pipeline.py          # 10-step BackgroundTask pipeline
│   ├── alembic/versions/              # 001_initial_schema, 002_add_owner_id_to_chats
│   ├── tests/                         # pytest (parser + classifier)
│   ├── data/                          # gitignored — DB + media
│   ├── requirements.txt
│   ├── alembic.ini
│   └── .env                           # gitignored
│
├── render.yaml                        # Render deployment (backend)
├── .env.example
├── .gitignore
└── README.md
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | **Yes** | — | OAuth 2.0 Web Client ID. Backend verifies the `aud` claim against this. Must match the frontend's `GOOGLE_CLIENT_ID`. |
| `GEMINI_API_KEY` | Yes (unless Ollama + local) | — | Free key from [aistudio.google.com](https://aistudio.google.com/app/apikey). Used for cluster labeling and (in `gemini` mode) embeddings. |
| `LLM_PROVIDER` | No | `gemini` | `gemini` or `ollama` |
| `OLLAMA_BASE_URL` | If Ollama | `http://localhost:11434` | |
| `OLLAMA_MODEL` | If Ollama | `llama3` | |
| `EMBEDDING_PROVIDER` | No | `gemini` | `gemini` (production) or `local` (dev / offline) |
| `EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | For `local`, any sentence-transformers model. For `gemini`, defaults to `gemini-embedding-001`. |
| `EMBEDDING_BATCH_SIZE` | No | `64` | Capped at 100 for Gemini. |
| `EMBEDDING_MIN_INTERVAL` | No | `0.65` | Seconds between Gemini calls. Default ≈ 92 RPM (under free-tier 100 RPM). Raise on paid tier. |
| `TURSO_DATABASE_URL` | Production (Render free) | — | `libsql://<db>-<org>.turso.io`. When BOTH this and `TURSO_AUTH_TOKEN` are set, the engine switches to Turso/libSQL over HTTPS. Unset → local SQLite at `DB_PATH`. |
| `TURSO_AUTH_TOKEN` | Production (Render free) | — | JWT from `turso db tokens create <name>`. Passed via `connect_args={"auth_token": ...}`, NOT the URL query string. |
| `MEDIA_BACKEND` | No | `local` | `local` writes to `MEDIA_DIR` and serves via `/media`. `cloudinary` uploads to Cloudinary and stores the `secure_url` in `media_items.local_path`. |
| `CLOUDINARY_CLOUD_NAME` | If `MEDIA_BACKEND=cloudinary` | — | From the Cloudinary dashboard. |
| `CLOUDINARY_API_KEY` | If `MEDIA_BACKEND=cloudinary` | — | |
| `CLOUDINARY_API_SECRET` | If `MEDIA_BACKEND=cloudinary` | — | |
| `DATA_DIR` | No | `./data` | Root data dir for local SQLite + local media. Unused when both Turso and Cloudinary are configured. |
| `MEDIA_DIR` | No | `./data/media` | Only meaningful when `MEDIA_BACKEND=local`. |
| `DB_PATH` | No | `./data/knowledge.db` | Only meaningful when Turso env vars are absent. |
| `BACKEND_PORT` | No | `8000` | |
| `FRONTEND_PORT` | No | `3000` | |
| `FRONTEND_ORIGIN` | Production | `http://localhost:3000` | Comma-separated CORS origins (e.g. your Vercel URL). |
| `ALLOWED_ORIGIN_REGEX` | No | `https://.*\.vercel\.app` | Regex for dynamic origins (Vercel preview deploys). |

### Frontend (`frontend/.env.local` or Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | **Yes** | NextAuth JWT signing secret. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | Production | Public URL (e.g. `https://your-app.vercel.app`). |
| `AUTH_TRUST_HOST` | Production | `true` |
| `GOOGLE_CLIENT_ID` | **Yes** | Same value as backend. |
| `GOOGLE_CLIENT_SECRET` | **Yes** | OAuth client secret from Google Cloud Console. |
| `NEXT_PUBLIC_API_URL` | **Yes** | Backend URL. Drives both the Next rewrite proxy and the direct upload target (uploads bypass Vercel's 4.5 MB proxy limit). |

### Running Fully Offline (No Internet After Setup)

```env
# backend/.env
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

Then `ollama pull llama3` once. Google sign-in still requires internet at sign-in time, but ingestion afterwards is offline.

---

## Database Schema

Single relational schema — local SQLite (`data/knowledge.db`) in dev, Turso (libSQL) in production. libSQL is a SQLite fork; the table definitions, FTS5 virtual table, ORM queries, and Alembic migrations are byte-for-byte identical across both. PRAGMA-based tweaks (WAL journal, foreign keys) only run on the local engine — Turso manages journaling server-side.

| Table | Purpose |
|-------|---------|
| `chats` | One row per uploaded chat. Includes `owner_id` (Google `sub`) for multi-user scoping. |
| `senders` | Unique senders per chat |
| `messages` | Every parsed message (content, timestamp, type, importance, cluster, embedding JSON) |
| `messages_fts` | FTS5 virtual table for full-text search |
| `media_items` | Media file metadata (path, MIME, size, extracted PDF text) |
| `links` | URL metadata (domain, OG title/description/image, link type) |
| `clusters` | Topic clusters (label, summary, message count, centroid embedding) |
| `important_flags` | Importance flags (trigger type: keyword/emoji/manual) |
| `pipeline_status` | Live progress (current step, error state) |

---

## Tech Stack

### Frontend

| Tech | Version | Purpose |
|------|---------|---------|
| Next.js | 16.2.6 | React framework, App Router |
| React | 19.2.4 | UI |
| TypeScript | 5.x | |
| NextAuth (Auth.js) | 5.0.0-beta.25 | Google OAuth, JWT sessions, token refresh |
| Tailwind CSS | 4.x | |
| shadcn/ui | 4.x | Component library |
| Framer Motion | 12.x | Animations |
| Cytoscape.js + react-cytoscapejs | 3.33 / 2.0 | Knowledge graph |
| Recharts | 3.x | Dashboard charts |
| Zustand | 5.x | Global state |
| react-dropzone | 15.x | Upload |

### Backend

| Tech | Version | Purpose |
|------|---------|---------|
| FastAPI | 0.115.12 | API framework |
| Uvicorn | 0.34.3 | ASGI server |
| SQLAlchemy | 2.0.41 | ORM |
| Alembic | 1.15.2 | Migrations |
| sqlalchemy-libsql | 0.2.0 | Turso (libSQL) dialect — engages when `TURSO_DATABASE_URL` is set |
| cloudinary | 1.41.0 | Cloudinary uploads + folder deletion (used when `MEDIA_BACKEND=cloudinary`) |
| google-auth | 2.35.0 | Google ID token verification |
| google-generativeai | 0.8.5 | Gemini Flash + Gemini embeddings |
| sentence-transformers | 4.1.0 | Local embeddings (optional, dev-only) |
| scikit-learn | 1.6.1 | K-Means clustering |
| hdbscan | 0.8.40 | Density-based clustering |
| numpy | 2.2.6 | Embedding math |
| httpx | 0.28.1 | Async HTTP (OG fetcher) |
| beautifulsoup4 | 4.13.4 | HTML parsing |
| pymupdf | 1.25.5 | PDF text extraction |
| python-dotenv | 1.1.0 | `.env` loading |

---

## Deployment

### Backend → Render (Stateless, Free Tier)

`render.yaml` is checked in.

- `rootDir: backend`
- `buildCommand: pip install -r requirements.txt`
- `startCommand: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **No persistent disk required.** Database state lives in Turso, media in Cloudinary. The container filesystem is allowed to be fully ephemeral.
- Migrations target the remote Turso URL at startup, so they run safely even with a stateless filesystem.

Committed defaults (in `render.yaml`):

- `LLM_PROVIDER=gemini`
- `EMBEDDING_MODEL=gemini-embedding-001`
- `EMBEDDING_BATCH_SIZE=64`
- `MEDIA_BACKEND=cloudinary`

Set in the Render dashboard (do **not** commit secrets):

- `GOOGLE_CLIENT_ID` — must match the frontend NextAuth Google client
- `GEMINI_API_KEY`
- `FRONTEND_ORIGIN` — your Vercel URL (comma-separated if multiple)
- `TURSO_DATABASE_URL` — from `turso db show <name> --url`
- `TURSO_AUTH_TOKEN` — from `turso db tokens create <name>`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `EMBEDDING_PROVIDER=gemini` — free tier has 512 MB RAM; the local sentence-transformers provider will OOM

If you do attach a paid persistent disk later, you can leave `MEDIA_BACKEND` unset (defaults to `local`) and `TURSO_*` blank — the same container falls back to local SQLite + local media without code changes.

### Frontend → Vercel

Set in the Vercel project env:

- `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST=true`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_API_URL` = your Render service URL

Add `https://<your-app>.vercel.app/api/auth/callback/google` to the OAuth client's authorized redirect URIs in Google Cloud Console.

---

## Running Tests

```bash
cd backend
.\venv\Scripts\Activate.ps1   # or: source venv/bin/activate
pytest tests/ -v
```

Covers the parser (40 tests) and classifier (37 tests).

---

## Troubleshooting

**Sign-in loops back to the landing page**
Make sure `AUTH_SECRET` is set in `frontend/.env.local`, your Google OAuth client lists `http://localhost:3000/api/auth/callback/google` (or your Vercel callback) as an authorized redirect URI, and `GOOGLE_CLIENT_ID` is identical on both frontend and backend.

**Backend returns 401 on every API call**
The `Authorization: Bearer <id_token>` header is missing or the token has expired and the refresh failed. Sign out and sign back in. Confirm `GOOGLE_CLIENT_ID` matches between the two services.

**Render backend OOMs during embedding**
You are on the free tier (512 MB RAM) with `EMBEDDING_PROVIDER=local`. Switch to `gemini` — local sentence-transformers + PyTorch needs ~500 MB.

**Turso returns `Unauthorized: empty JWT token`**
The auth token was dropped on the wire. Make sure `TURSO_AUTH_TOKEN` is set as an env var (not just embedded in `TURSO_DATABASE_URL` as a query string) — `app/models/db.py` passes it through `connect_args` because sqlalchemy-libsql 0.2.0 silently drops `?authToken=` from URLs. If you regenerated the token, restart the Render service so the new value is picked up.

**`alembic upgrade head` connects to local SQLite instead of Turso**
Both `TURSO_DATABASE_URL` AND `TURSO_AUTH_TOKEN` must be set — if either is empty, `app/core/config.py` falls back to `sqlite:///{DB_PATH}`. Confirm with `python -c "from app.core.config import DATABASE_URL, USING_TURSO; print(USING_TURSO, DATABASE_URL)"` from inside `backend/` with the venv active.

**Cloudinary upload fails for PDFs / audio / .vcf files**
These go to Cloudinary's `raw` resource type, not `image`. The storage layer already picks the right `resource_type` based on the media classification, but if you bypass it manually, anything that isn't an obvious image/video needs `resource_type="raw"` or Cloudinary's image pipeline will reject it.

**Media URLs render as `/media/https://res.cloudinary.com/...` on the frontend**
You're on an old build of `frontend/lib/api.ts` that doesn't detect absolute URLs. The current `mediaUrl()` short-circuits when the value already starts with `http(s)://`. Pull latest and redeploy the frontend.

**Switched `MEDIA_BACKEND` mid-deployment and old chats now show broken media**
`media_items.local_path` stores whatever the backend wrote at upload time — a relative path under local mode, a Cloudinary `secure_url` under cloud mode. Already-uploaded chats keep pointing at the original storage. Either keep the previous backend reachable, or re-upload affected chats.

**Gemini embeddings hit the daily 1,000-request quota during dev**
Switch to `EMBEDDING_PROVIDER=local` in `backend/.env`. You'll need to re-upload chats because the embedding dimensions differ (768 vs 384).

**Upload fails on Vercel with "Request Entity Too Large"**
Vercel's serverless proxy caps bodies at 4.5 MB. `uploadChat()` already POSTs directly to `NEXT_PUBLIC_API_URL` to bypass this — make sure that variable is set in the Vercel project env to your Render URL (not left blank).

**Frontend shows "Failed to fetch"**
Backend isn't running on `8000`, or CORS is blocking the request. Confirm `FRONTEND_ORIGIN` on the backend includes your frontend URL (comma-separated for multiple).

**`hdbscan` install fails on Windows**
`pip install hdbscan --no-build-isolation`. If it still fails, the clusterer auto-falls back to K-Means.

**`alembic upgrade head` fails with "no such table"**
Run it from inside `backend/` with the venv active.

**PowerShell venv activation blocked**
Once, as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Gemini cluster-labeling rate-limit (free tier)**
Free tier is 15 req/min and 1,500/day. `services/llm.py` enforces a 4-second floor between calls.

---

## Roadmap / Not Yet Included

- WhatsApp Business API / real-time sync
- Voice note transcription (audio is stored but not transcribed)
- Conversational chatbot over the knowledge base
- Browser extension or native mobile app
- Multi-user *shared* workspaces (chats are per-Google-user; no cross-user sharing yet)

---

## License

MIT.
