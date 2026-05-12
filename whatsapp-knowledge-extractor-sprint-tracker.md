---
description: "WhatsApp Knowledge Extractor Sprint Workflow — Handles all 9 sprints (Sprint 0–8). Use: /whatsapp-knowledge-extractor-sprint-tracker start sprint <N> to execute a sprint."
---

# WhatsApp Knowledge Extractor — Sprint Execution Workflow

// turbo-all

## Sources of Truth

**ALWAYS read these files before doing ANY work:**

1. **Roadmap** → `d:\Mayank\workspace\whatsapp-knowledge-extractor\Project-knowledge\roadmap.md`
   - Contains: project overview, tech stack, folder structure, best practices, sprint descriptions
2. **Sprint Tracker** → `d:\Mayank\workspace\whatsapp-knowledge-extractor\Project-knowledge\sprint-tracker.md`
   - Contains: live progress dashboard, per-sprint task checklists, verification checklists, completion logs
   - **This is the LIVE state** — always read it first to know current progress

**Project Root**: `d:\Mayank\workspace\whatsapp-knowledge-extractor`

---

## Sprint Overview (9 Total)

| Sprint | Name | Focus Area | Key Skills |
|--------|------|-----------|------------|
| **0** | Project Init & Scaffold | Setup, git, scaffold | — |
| **1** | WhatsApp Parser + Upload API | Backend, parsing | — |
| **2** | Classification + Enrichment | Backend, NLP | — |
| **3** | Upload UI + Dashboard | **Frontend, UI/UX** | `ui-ux-pro-max`, `frontend-design`, `framer-motion` |
| **4** | Per-Type Detail Views | **Frontend, UI/UX** | `ui-ux-pro-max`, `frontend-design`, `framer-motion` |
| **5** | NLP Pipeline | Backend, AI/ML | — |
| **6** | Search | Full-stack | `frontend-design` |
| **7** | Knowledge Graph | **Frontend, Visualization** | `ui-ux-pro-max`, `frontend-design`, `framer-motion` |
| **8** | Polish & Launch | Full-stack, QA | `ui-ux-pro-max`, `frontend-design` |

---

## How To Use This Workflow

The user triggers this workflow with a command like:
- `start sprint 0`
- `start sprint 3`
- `resume sprint 5`
- `check sprint status`

The AI must then follow the execution steps below.

---

## Step 1 — Read Current State

Read the sprint tracker to understand current progress:

```
view_file d:\Mayank\workspace\whatsapp-knowledge-extractor\Project-knowledge\sprint-tracker.md (lines 1-50)
```

Check the **Progress Dashboard** and **Sprint Status Board** at the top of the file.

**Decision logic:**
- If user says `start sprint N`:
  - Check that Sprint N-1 is `✅ Completed` (unless N=0)
  - If Sprint N-1 is NOT completed → **STOP** and tell user: "Sprint N-1 must be completed first"
  - If Sprint N is already `✅ Completed` → tell user it's already done
  - If Sprint N is `⚠️ Partially Done` → resume from first unchecked task
  - If Sprint N is `⬜ Not Started` → proceed to Step 2
- If user says `resume sprint N`:
  - Sprint N must be `🔄 In Progress` or `⚠️ Partially Done`
  - Read the task table for Sprint N and find the first `⬜` task
  - Proceed to Step 3, starting from that task
- If user says `check sprint status`:
  - Read and display the Progress Dashboard from sprint-tracker.md
  - Show which sprint is current, how many completed, and the progress bar
  - **STOP** — no execution needed

---

## Step 2 — Initialize Sprint

### 2a. Read Sprint Details from Roadmap

Read the full sprint section from the roadmap for context:

```
view_file d:\Mayank\workspace\whatsapp-knowledge-extractor\Project-knowledge\roadmap.md
```

Find the sprint section (search for `Sprint N —`) and read:
- Goal
- All tasks
- How to execute
- Verification checklist

### 2b. Read Sprint Details from Tracker

Read the sprint section from the tracker:

```
view_file d:\Mayank\workspace\whatsapp-knowledge-extractor\Project-knowledge\sprint-tracker.md
```

Find the sprint section (search for `SPRINT N —`) and read:
- Task table with current status of each task
- Post-Sprint Verification Checklist
- Completion Log

### 2c. Update Tracker — Mark Sprint as In Progress

Update `sprint-tracker.md` with the following changes:

1. In the **Progress Dashboard** table:
   - Set `In Progress` → `Sprint N — [Name]`
   - Set `Current Sprint` → `🔄 Sprint N — [Name]`

2. In the **Sprint Status Board** table:
   - Change Sprint N's Status from `⬜ Not Started` to `🔄 In Progress`
   - Set Started column to current date

3. In the Sprint N section:
   - Change `**Status**: ⬜ Not Started` to `**Status**: 🔄 In Progress`
   - Set `**Started At**: [current timestamp]`

### 2d. Activate Required Skills

**CRITICAL**: Before executing any frontend/UI sprint, activate these skills:

- **Sprints 3, 4, 7, 8** (heavy frontend/design work):
  - Read and apply `ui-ux-pro-max` skill for professional UI/UX design
  - Read and apply `frontend-design` skill for frontend architecture
  - Use **Framer Motion** for all animations and transitions
  - Use **dark mode first** design approach
  - Follow the color coding system from the roadmap:
    - 🔵 Links → Blue
    - 🩷 Images → Coral/Pink
    - 🟣 Videos → Purple
    - 🟠 PDFs/Docs → Amber
    - 🟢 Audio → Teal
    - 🟡 Important → Yellow/Amber
    - ⚪ Plain text → Gray

- **Sprint 6** (search UI):
  - Read and apply `frontend-design` skill

- **All sprints**: Follow the best practices from the roadmap (TypeScript strict, Python type hints, no paid APIs, etc.)

---

## Step 3 — Execute Sprint Tasks

Work through each task in the sprint's task table **sequentially**.

For each task:

1. **Read the task** from the tracker's task table
2. **Implement it** following the roadmap's guidance
3. **Test it** to make sure it works
4. **Update the tracker** — change that task's Status from `⬜` to `✅` in sprint-tracker.md

### Execution Rules

- **Working directory**: Always `d:\Mayank\workspace\whatsapp-knowledge-extractor`
- **Frontend code**: Goes in `frontend/` directory
- **Backend code**: Goes in `backend/` directory
- **Never use paid APIs** (OpenAI, Anthropic, Cohere) — only Gemini Flash (free) or Ollama
- **All LLM calls** through `services/llm.py` abstraction
- **All embedding calls** through `services/embedder.py`
- **Database**: SQLite only, file at `data/knowledge.db`
- **Media files**: Stored in `data/media/<chat_id>/`

### If a Task Fails

1. Note the error in the task's Notes column
2. Try to fix it
3. If unfixable, mark the task as `❌` and add error details
4. Continue with remaining tasks if possible
5. Note the issue in the Completion Log

### After Each Major Task Group

Verify nothing is broken:
- Backend starts: `cd backend && python -m uvicorn app.main:app --reload --port 8000`
- Frontend starts: `cd frontend && npm run dev`
- No import errors or crashes

---

## Step 4 — Run Verification Checklist

After ALL tasks in the sprint are completed:

1. **Read the Post-Sprint Verification Checklist** from sprint-tracker.md for this sprint
2. **Execute each check** one by one
3. **Mark each check** as `✅` (pass) or `❌` (fail) in sprint-tracker.md
4. **Run existing tests**: `cd backend && pytest tests/` (if tests exist)
5. **Verify frontend starts**: `cd frontend && npm run dev`
6. **Verify backend starts**: `cd backend && python -m uvicorn app.main:app --port 8000`

### If Any Check Fails

- Fix the issue
- Re-run the check
- If still failing: mark it `❌`, note the issue, and proceed

### All Checks Must Pass Before Committing

If critical checks fail (frontend won't start, backend crashes, tests fail), **DO NOT commit**. Fix first.

---

## Step 5 — Git Commit & Push

After all verification checks pass:

```bash
cd d:\Mayank\workspace\whatsapp-knowledge-extractor
git add .
git commit -m "<commit message from tracker>"
git push
```

Use the exact commit message specified in the sprint's "Git Commit" section in the tracker.

Record the commit hash from the output.

---

## Step 6 — Update Sprint Tracker (Post-Completion)

Update `sprint-tracker.md` with the following changes:

### 6a. Update the Sprint Section

1. Change `**Status**: 🔄 In Progress` to `**Status**: ✅ Completed`
2. Set `**Completed At**: [current timestamp]`
3. In the **Completion Log**:
   - Set `Sprint N Result: SUCCESS`
   - Set `Commit Hash: [actual hash from git]`
   - Set `Issues Encountered: [any issues, or NONE]`

### 6b. Update the Progress Dashboard (TOP of file)

| Field | New Value |
|-------|-----------|
| `Completed` | Increment by 1 (e.g., `1 / 9`) |
| `In Progress` | `None` |
| `Remaining` | Decrement by 1 |
| `Current Sprint` | `⏳ Sprint N+1 — [Name]` (or `🎉 All Complete!` if N=8) |
| `Overall Progress` | Update the progress bar (see format below) |
| `Last Updated` | Current timestamp |
| `Last Commit Hash` | The commit hash from Step 5 |

**Progress bar values:**
```
Sprint 0 done: ██░░░░░░░░░░░░░░░░░░ 11%
Sprint 1 done: ████░░░░░░░░░░░░░░░░ 22%
Sprint 2 done: ██████░░░░░░░░░░░░░░ 33%
Sprint 3 done: ████████░░░░░░░░░░░░ 44%
Sprint 4 done: ██████████░░░░░░░░░░ 55%
Sprint 5 done: ████████████░░░░░░░░ 66%
Sprint 6 done: ██████████████░░░░░░ 77%
Sprint 7 done: ████████████████░░░░ 88%
Sprint 8 done: ████████████████████ 100%
```

### 6c. Update the Sprint Status Board (TOP of file)

Change Sprint N's row:
- Status → `✅ Completed`
- Completed → current date
- Commit → commit hash (first 7 chars)

---

## Step 7 — Report to User

After updating the tracker, report:

```
✅ Sprint N — [Name] completed successfully!

Summary:
- Tasks completed: X / Y
- Verification checks passed: Z / W
- Commit: [hash]

Next sprint: Sprint N+1 — [Name]
To start: "start sprint N+1"

Overall progress: [progress bar] XX%
```

---

## Sprint-Specific Execution Guides

### Sprint 0 — Project Init & Scaffold

**What to do:**
1. `git init` in project root
2. Create `.gitignore`
3. Scaffold Next.js 14 in `frontend/` with: `npx -y create-next-app@latest ./frontend --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm`
4. Install frontend deps: `npm install zustand react-dropzone recharts framer-motion cytoscape react-cytoscapejs @types/cytoscape`
5. Init shadcn/ui: `npx shadcn@latest init`
6. Create backend folder structure manually
7. Create `requirements.txt` with: fastapi, uvicorn, sqlalchemy, alembic, python-multipart, httpx, beautifulsoup4, sentence-transformers, scikit-learn, hdbscan, numpy, pymupdf, google-generativeai, python-dotenv
8. Create `app/main.py` with FastAPI + CORS
9. Set up SQLAlchemy models for all 8 tables
10. Init Alembic + run migration
11. Create data directories
12. Create `.env` template
13. Test sentence-transformers model download
14. Test frontend↔backend CORS

**Key checks:** Both servers start. CORS works. SQLite DB created.

---

### Sprint 1 — WhatsApp Parser + Upload API

**What to do:**
1. Build `services/parser.py` — the WhatsApp .txt parser
2. Handle ALL edge cases (multi-line, date/time variants, Unicode names, deleted/edited/forwarded messages, media omitted, system messages)
3. Build upload API endpoint
4. Build SSE progress endpoint
5. Build pipeline status tracking
6. Build basic CRUD endpoints for chats/messages
7. Write unit tests for parser

**Key checks:** Parser handles all formats. Upload works. SSE streams. Messages in DB. Tests pass.

---

### Sprint 2 — Classification + Enrichment

**What to do:**
1. Build `services/classifier.py` — regex type classification
2. Build `services/og_fetcher.py` — Open Graph metadata
3. Build `services/pdf_extractor.py` — PyMuPDF text extraction
4. Build `services/tagger.py` — importance tagging
5. Wire into pipeline (Steps 2-4, 8)
6. Build filter APIs
7. Write classifier tests

**Key checks:** Messages classified. OG data fetched. PDFs extracted. Important tagged. APIs work.

---

### Sprint 3 — Upload UI + Dashboard

> **🎨 DESIGN SPRINT — Use skills: `ui-ux-pro-max`, `frontend-design`, Framer Motion**

**What to do:**
1. Build landing page with animated hero (Framer Motion), dark mode, premium design
2. Build app layout with collapsible sidebar + page transitions
3. Build upload page with react-dropzone + SSE progress bar
4. Build chat list with stagger animations
5. Build dashboard with stat cards (count-up), charts (Recharts), heatmap
6. Set up Zustand store
7. Build API client (`lib/api.ts`)

**Design requirements:**
- Dark mode first
- Framer Motion animations everywhere (page transitions, card stagger, hover effects, count-up)
- Consistent color coding for media types
- Premium, not generic — curated color palettes, modern typography
- Mobile responsive

**Key checks:** Landing looks premium. Upload works E2E. Dashboard shows real data. Charts render. Responsive. Dark mode. No console errors.

---

### Sprint 4 — Per-Type Detail Views

> **🎨 DESIGN SPRINT — Use skills: `ui-ux-pro-max`, `frontend-design`, Framer Motion**

**What to do:**
1. Links view — OG cards, domain grouping, filters
2. Images view — masonry grid, lightbox modal, lazy loading
3. Videos view — thumbnails, YouTube embeds, HTML5 video
4. Documents view — file list, PDF preview, download
5. Important view — chronological feed, manual flag toggle, export to markdown
6. Empty states for all views

**Key checks:** All 5 views render with real data. Images served from backend. Modals animate. Empty states work.

---

### Sprint 5 — NLP Pipeline

**What to do:**
1. Build `services/embedder.py` — sentence-transformers batch encoding
2. Build `services/clusterer.py` — HDBSCAN/K-Means clustering
3. Build `services/llm.py` — Gemini Flash + Ollama abstraction
4. Build FTS5 index population
5. Wire pipeline Steps 5-9
6. Build cluster APIs
7. Build Topics view UI with Framer Motion cards

**Key checks:** Embeddings generated. Clusters created. Labels sensible. FTS5 works. Topics UI renders. LLM provider switches via env var. Full 10-step pipeline runs.

---

### Sprint 6 — Search

> **Use skill: `frontend-design`**

**What to do:**
1. Build search API — FTS5 keyword + numpy semantic + filters + shorthand parser
2. Build combined search endpoint
3. Build cross-chat search
4. Build Search UI — input, filter chips, context display, highlights, animations

**Key checks:** Keyword search works. Semantic search works. Filters work. Shorthands parse. Cross-chat works. UI responsive.

---

### Sprint 7 — Knowledge Graph

> **🎨 DESIGN SPRINT — Use skills: `ui-ux-pro-max`, `frontend-design`, Framer Motion**

**What to do:**
1. Build `services/graph_builder.py` — compute nodes + edges
2. Build graph API endpoint
3. Build Cytoscape.js graph view — colors, sizes, click-expand, filters, layout
4. Build detail side panel
5. Optimize for 500+ nodes

**Key checks:** Graph renders. Colors correct. Click-expand works. Filters work. Performance OK. Responsive.

---

### Sprint 8 — Polish & Launch

> **Use skills: `ui-ux-pro-max`, `frontend-design`**

**What to do:**
1. Multi-chat support (upload multiple, sidebar switch, cross-chat graph)
2. Export features (.md, .csv, .json, AI summaries)
3. Error handling (pipeline retry, upload validation, network errors, toasts)
4. Empty states + onboarding
5. Settings page
6. README.md
7. Full E2E testing with real WhatsApp exports
8. Performance audit

**Key checks:** Multi-chat works. Exports valid. Errors handled. Empty states render. Settings work. README complete. Full E2E passes. Mobile responsive. No errors.

---

## Error Recovery

If the AI session is interrupted mid-sprint:

1. The sprint-tracker.md has the live state
2. Completed tasks are marked `✅`, remaining are `⬜`
3. User says: _"resume sprint N"_ or _"start sprint N"_ (workflow detects partial state)
4. AI reads tracker, finds first `⬜` task, and continues from there
5. All previously committed code is safe in git

**The sprint-tracker.md is the single source of recovery.**
