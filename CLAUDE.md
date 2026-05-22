# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

### What this is

WhatsApp Knowledge Extractor is a local-first web app that turns WhatsApp `.zip`/`.txt` chat exports into a searchable, classified, clustered, and graph-visualized knowledge base. Messages are parsed, classified by type (link/image/video/PDF/doc/audio/contact/location/text), enriched (Open Graph, PDF text extraction), embedded with a local sentence-transformer, clustered with HDBSCAN, labeled by Gemini 2.0 Flash, indexed in SQLite FTS5, and rendered through a Next.js dashboard with a Cytoscape.js knowledge graph. No paid APIs, no cloud storage — user data stays on disk.

### Repo layout

The repo root is `D:\Mayank\workspace\whatsapp-knowledge-extractor`. `backend/` is the FastAPI service (Python 3.11, SQLAlchemy 2.0, SQLite with FTS5, sentence-transformers, HDBSCAN, Gemini) — all backend commands run from this directory. `frontend/` is the Next.js 16 / React 19 / TypeScript / Tailwind v4 client that proxies to the backend — all frontend commands run from this directory. `skills/` contains three Claude Code skill packages (`design-taste-frontend`, `ui-ux-designer`, `ui-ux-pro-max`) used while building the UI. `Project-knowledge-whatsapp/` holds the product spec, roadmap, and how-to-run docs. `whatsapp-knowledge-extractor-sprint-tracker.md` is the sprint-execution workflow definition. `render.yaml` declares the Render deployment for the backend. `README.md` is the public-facing setup guide.

### Commands

#### Backend (cwd: `backend/`)

- Create venv: `python -m venv venv`
- Activate venv (PowerShell): `.\venv\Scripts\Activate.ps1`
- Install: `pip install -r requirements.txt`
- Migrate DB: `alembic upgrade head`
- Run dev server: `uvicorn app.main:app --reload --port 8000`
- Run tests: `pytest tests/ -v`
- Health check: `curl http://localhost:8000/health`

#### Frontend (cwd: `frontend/`)

- Install: `npm install`
- Dev: `npm run dev` (http://localhost:3000)
- Build: `npm run build`
- Start production build: `npm run start`
- Lint: `npm run lint` (runs `eslint` via `eslint-config-next`)

### Architecture

#### Backend

The FastAPI app entry point is `backend/app/main.py`. It configures CORS from `ALLOWED_ORIGINS` (derived from `FRONTEND_ORIGIN`), mounts `data/media/` at `/media` via `StaticFiles`, exposes `/health` and `/api/health`, and registers ten routers from `backend/app/api/`: `upload.py`, `chats.py`, `messages.py`, `links.py`, `important.py`, `media.py`, `clusters.py`, `search.py`, `graph.py`, `export.py`. Settings load through `app/core/config.py` via `python-dotenv`.

The ingestion pipeline lives in `backend/app/tasks/pipeline.py` and is dispatched as a FastAPI `BackgroundTask` from `app/api/upload.py`. The ten steps (constant `PIPELINE_STEPS`) are:

1. Parsing messages — `services/parser.py`
2. Classifying content — `services/classifier.py`
3. Enriching links (OG metadata) — `services/og_fetcher.py`
4. Extracting PDF text — `services/pdf_extractor.py`
5. Generating embeddings — `services/embedder.py`
6. Clustering topics — `services/clusterer.py`
7. Labeling clusters — `services/llm.py` (Gemini 2.0 Flash, with Ollama fallback)
8. Tagging importance — `services/tagger.py`
9. Building search index — `services/fts_builder.py`
10. Finalizing — `tasks/pipeline.py` marks chat status `ready`

The SSE progress endpoint is `GET /api/chats/{chat_id}/progress` in `app/api/upload.py` (returns `StreamingResponse` with `media_type="text/event-stream"`). Export endpoints in `app/api/export.py` also use `StreamingResponse` for `.md`/`.csv`/`.json` downloads. Semantic search uses numpy cosine similarity over stored embeddings (`services/semantic_search.py`); keyword search uses the SQLite FTS5 virtual table. The graph endpoint computes nodes/edges from SQL via `services/graph_builder.py`.

The DB layer is in `app/models/db.py` (SQLAlchemy 2.0 ORM). Tables: `chats`, `senders`, `messages`, `messages_fts` (FTS5 virtual), `media_items`, `links`, `clusters`, `important_flags`, `pipeline_status`. Migrations live in `backend/alembic/versions/` (initial: `001_initial_schema.py`); Alembic is configured by `alembic.ini`.

The LLM abstraction in `services/llm.py` chooses Gemini 2.0 Flash or Ollama based on `LLM_PROVIDER`. Gemini calls are rate-limited to one every ~4 seconds (15 req/min free tier). All LLM access in the codebase must go through this module.

On Render, the backend persists `data/` to a 1 GB persistent disk mounted at `/data`. `render.yaml` runs `pip install -r requirements.txt` at build time only — Alembic migrations run at startup (`alembic upgrade head && uvicorn ...`) because the disk is not mounted during build.

#### Frontend

Next.js 16 with the App Router. The route tree intentionally nests an `app/app/` segment under `frontend/app/`: `frontend/app/layout.tsx` and `frontend/app/page.tsx` are the public root (landing page), while everything under `frontend/app/app/` is the authenticated app shell with its own `layout.tsx` (sidebar, top bar). Pages: `app/app/upload/page.tsx`, `app/app/chats/page.tsx`, `app/app/chats/[id]/page.tsx` plus `graph/`, `links/`, `images/`, `videos/`, `docs/`, `important/`, `topics/`, `search/` sub-routes, `app/app/search/page.tsx` (cross-chat), and `app/app/settings/page.tsx`.

`frontend/lib/api.ts` is the typed fetch client. `API_BASE` is empty in the browser so all `/api/*` and `/media/*` calls are relative and flow through the Next.js rewrite proxy in `next.config.ts`; the proxy forwards to `process.env.NEXT_PUBLIC_API_URL` in production (Vercel → Render) or `http://localhost:8000` in dev. One exception: `uploadChat()` POSTs directly to `NEXT_PUBLIC_API_URL` at runtime to bypass Vercel's 4.5 MB proxy body limit. Server-Sent Events for pipeline progress are consumed via `createProgressStream()` from `lib/api.ts`. Global state lives in `frontend/lib/store.ts` (Zustand `useAppStore`: theme, sidebar, current chat). Visualisations use Cytoscape.js + `react-cytoscapejs` for the graph and Recharts for dashboard charts; animations use Framer Motion.

### Skills directory

- `skills/design-taste-frontend/` — high-agency frontend skill for strict design taste, color, motion, and responsive layout rules.
- `skills/ui-ux-designer/` — interface design, wireframes, design systems, accessibility guidance.
- `skills/ui-ux-pro-max/` — comprehensive UI/UX reference (color palettes, font pairings, UX guidelines, chart picks) with a searchable data set under `data/` and helper `scripts/`.

### Deployment

Backend deploys to Render via `render.yaml`: `rootDir: backend`, runtime `python`, build `pip install -r requirements.txt`, start `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`, with a 1 GB persistent disk named `data` mounted at `/data`. Secrets (`GEMINI_API_KEY`, `FRONTEND_ORIGIN`, `DATA_DIR=/data`, `MEDIA_DIR=/data/media`, `DB_PATH=/data/knowledge.db`) are set in the Render dashboard, not in `render.yaml`. Frontend deploys to Vercel with `NEXT_PUBLIC_API_URL` set to the Render service URL — this single variable drives both the build-time rewrite destination in `next.config.ts` and the runtime upload target in `lib/api.ts`. CORS on the backend should include the Vercel origin via `FRONTEND_ORIGIN`.

### Sprint status

All 9 sprints (Sprint 0 through Sprint 8) are complete per the workflow at `whatsapp-knowledge-extractor-sprint-tracker.md` (the live tracker is `Project-knowledge-whatsapp/sprint-tracker.md`).

### Conventions and gotchas

- Next.js 16 has breaking changes versus older versions; this repo pins `next@16.2.6` and `react@19.2.4`. Before writing any frontend code, read the relevant guide in `frontend/node_modules/next/dist/docs/` and the project memory at `frontend/AGENTS.md` (which `frontend/CLAUDE.md` re-exports via `@AGENTS.md`).
- The `frontend/app/app/` nesting is intentional: the outer `app/` is the App Router root, the inner `app/` is the authenticated product shell URL prefix (`/app/...`). Do not flatten it.
- TypeScript is strict (`tsconfig.json`). Path alias `@/*` resolves to the `frontend/` root.
- Any client page that calls `useSearchParams()` must be wrapped in `<Suspense>`, or prerender will fail at build time (this applies to `app/app/upload/page.tsx` and similar client pages).
- The Vercel proxy has a 4.5 MB body limit; uploads must hit `NEXT_PUBLIC_API_URL` directly. `next.config.ts` also sets `experimental.proxyClientMaxBodySize: "100mb"` for the rewrite proxy.
- SQLite FTS5 is built into the bundled SQLite; the virtual table `messages_fts` is built by `services/fts_builder.py` in pipeline step 9 and queried by `services/semantic_search.py`/`api/search.py`. Keep inserts batched.
- Gemini free tier is 15 req/min and 1500/day; `services/llm.py` enforces a 4-second floor between calls. Never call any LLM outside this module.
- HDBSCAN can fail to install on Windows (`pip install hdbscan --no-build-isolation`); the clusterer falls back to scikit-learn K-Means automatically.
- All user data (DB, media) lives under `backend/data/` locally and `/data` on Render. Never commit anything from these paths.
- No paid APIs anywhere — Gemini 2.0 Flash (free) or Ollama only.
- Frontend route folder names use lowercase (`/app/upload`, `/app/chats`, `/app/settings`) — URLs are lowercased and case-sensitive.

### Env vars

Backend (`backend/.env`, names only):

- `GEMINI_API_KEY`
- `LLM_PROVIDER` (`gemini` or `ollama`)
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- `EMBEDDING_MODEL`, `EMBEDDING_BATCH_SIZE`
- `DATA_DIR`, `MEDIA_DIR`, `DB_PATH`
- `BACKEND_PORT`, `FRONTEND_PORT`
- `FRONTEND_ORIGIN` (comma-separated list of allowed CORS origins)

Frontend (Vercel project env, names only):

- `NEXT_PUBLIC_API_URL` (Render backend URL; drives both `next.config.ts` rewrites and direct uploads from `lib/api.ts`)
