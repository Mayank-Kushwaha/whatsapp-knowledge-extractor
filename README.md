# 📱 WhatsApp Knowledge Extractor

Transform your WhatsApp chat exports into an organized, searchable, visual knowledge base.

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20FastAPI%20%2B%20SQLite-green)
![AI](https://img.shields.io/badge/AI-Gemini%20Flash%20(free)-purple)

---

## ✨ Features

- **📤 Upload & Parse** — Drag-and-drop WhatsApp `.txt`/`.zip` exports with real-time SSE progress
- **🏷️ Auto-Classification** — Messages classified by type (links, images, videos, PDFs, audio, etc.)
- **🧠 Topic Clustering** — NLP-powered semantic clustering with auto-generated topic labels
- **🔍 Multi-Mode Search** — FTS5 keyword + semantic search with shorthand filters (`from:Mom type:link`)
- **🕸️ Knowledge Graph** — Interactive Cytoscape.js visualization of senders, topics, and domains
- **⭐ Importance Tagging** — Auto-detect important messages via keywords/emojis
- **📊 Analytics Dashboard** — Charts, heatmaps, sender breakdowns, domain analysis
- **📁 Per-Type Views** — Dedicated views for links, images, videos, documents, important messages
- **📥 Export** — Export as Markdown, CSV, or JSON with filters
- **🌐 Cross-Chat Search** — Search across all uploaded chats simultaneously

---

## 🚀 Quick Start (3 Commands)

```bash
# 1. Clone & install backend
cd whatsapp-knowledge-extractor/backend
pip install -r requirements.txt

# 2. Install frontend
cd ../frontend
npm install

# 3. Run both servers
# Terminal 1:
cd backend && uvicorn app.main:app --reload --port 8000
# Terminal 2:
cd frontend && npm run dev
```

Open http://localhost:3000 and upload your WhatsApp export!

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| Next.js 14 (App Router) | React framework with SSR |
| TypeScript | Type safety |
| Tailwind CSS + shadcn/ui | Styling |
| Framer Motion | Animations |
| Cytoscape.js | Knowledge graph |
| Recharts | Dashboard charts |
| Zustand | State management |

### Backend
| Technology | Purpose |
|-----------|---------|
| FastAPI | API framework |
| SQLite + FTS5 | Database + full-text search |
| SQLAlchemy 2.0 | ORM |
| sentence-transformers | Local embeddings (CPU) |
| HDBSCAN / K-Means | Topic clustering |
| Gemini Flash / Ollama | LLM for labeling (free) |

---

## 📁 Project Structure

```
whatsapp-knowledge-extractor/
├── frontend/          # Next.js 14 app
│   ├── app/           # App Router pages
│   ├── lib/           # API client, utilities
│   └── components/    # Reusable UI components
├── backend/           # FastAPI app
│   ├── app/api/       # REST endpoints
│   ├── app/services/  # Business logic
│   ├── app/models/    # SQLAlchemy models
│   └── app/tasks/     # Background pipeline
└── data/              # Local storage (gitignored)
    ├── knowledge.db   # SQLite database
    └── media/         # Extracted media files
```

---

## 🔑 Environment Variables

Create `backend/.env`:

```env
GEMINI_API_KEY=          # Free: https://aistudio.google.com/app/apikey
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

## 📱 How to Export WhatsApp Chats

1. Open WhatsApp → Chat → ⋮ Menu → More → Export Chat
2. Choose "Without Media" (for text only) or "Include Media" (for full export)
3. Save the `.txt` or `.zip` file
4. Upload it to the app!

---

## 🧪 Processing Pipeline

When you upload a chat, these 10 steps run automatically:

1. **Parse** — Extract messages, senders, timestamps
2. **Classify** — Detect links, images, videos, PDFs, etc.
3. **Enrich Links** — Fetch Open Graph metadata
4. **Extract PDFs** — OCR text from PDF files
5. **Embed** — Generate sentence embeddings (local, CPU)
6. **Cluster** — Group messages into semantic topics
7. **Label** — AI-generate topic labels and summaries
8. **Tag Importance** — Flag important messages
9. **Index** — Build FTS5 full-text search index
10. **Complete** — Ready to explore!

---

## 📜 License

MIT — Use it however you like. No cloud, no tracking, your data stays local.