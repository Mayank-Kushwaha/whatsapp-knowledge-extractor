# Production Deployment Guide
# WhatsApp Knowledge Extractor — Render (backend) + Vercel (frontend)

> This guide covers everything you need to take this project from local dev to a live production deployment. Read it top to bottom before you start clicking buttons.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Important Limitations to Understand First](#2-important-limitations-to-understand-first)
3. [Deploy the Backend on Render](#3-deploy-the-backend-on-render)
4. [Deploy the Frontend on Vercel](#4-deploy-the-frontend-on-vercel)
5. [Link Frontend and Backend Together](#5-link-frontend-and-backend-together)
6. [Environment Variables — Complete Reference](#6-environment-variables--complete-reference)
7. [How CORS and API Routing Work in Production](#7-how-cors-and-api-routing-work-in-production)
8. [Production Checklist](#8-production-checklist)
9. [Things to Keep in Mind in Production](#9-things-to-keep-in-mind-in-production)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Architecture Overview

```
Browser
  │
  ▼
Vercel (Next.js frontend)
  │  All /api/* and /media/* requests are rewritten by
  │  next.config.ts to proxy to the Render backend.
  │  The browser never makes a cross-origin request —
  │  it always talks to the same Vercel domain.
  ▼
Render (FastAPI backend)
  │
  ├── SQLite database (data/knowledge.db — persisted on Render disk)
  ├── Media files (data/media/ — persisted on Render disk)
  └── Gemini API (external, free)
```

**Why this architecture eliminates CORS issues**: The frontend never calls the Render URL directly from the browser. Instead, Next.js rewrites `/api/*` and `/media/*` to the Render backend server-side. From the browser's perspective, every request goes to `your-app.vercel.app` — same origin, no CORS preflight needed.

---

## 2. Important Limitations to Understand First

Before deploying, understand these constraints so you're not surprised.

### SQLite on Render — Persistent Disk Required

This app uses SQLite and a local `data/media/` directory. Render's free tier does **not** include a persistent disk — the filesystem resets on every deploy or restart. This means:

- **Free tier**: All uploaded chats and media are lost on every redeploy or instance restart. Fine for demos, not for real use.
- **Paid tier ($7/month)**: Add a Render Persistent Disk. Mount it at `/data`. All data survives restarts and deploys.

If you want persistent data on the free tier, you need to migrate to PostgreSQL + cloud storage (S3/R2). That's a significant refactor — not covered here.

### Render Free Tier Spins Down

On Render's free tier, the backend service spins down after 15 minutes of inactivity. The first request after spin-down takes 30–60 seconds to respond (cold start). This is normal. Upgrade to a paid instance ($7/month) to keep it always-on.

### Sentence-Transformers Model Download

The `all-MiniLM-L6-v2` model (~90MB) downloads on first startup. On Render this happens during the first deploy and is cached in the build. Subsequent deploys reuse the cache. First cold start after a cache miss will be slow.

### File Upload Size Limits

Vercel has a 4.5MB request body limit on the free tier for serverless functions. Since the frontend proxies uploads through Vercel's rewrite, large `.zip` files (>4.5MB) will fail with a 413 error.

**Solutions**:
- Upgrade to Vercel Pro (100MB limit)
- Or configure the upload page to POST directly to the Render backend URL (bypassing the Vercel proxy for uploads only — see Section 5)

---

## 3. Deploy the Backend on Render

### Step 3.1 — Prepare your repository

Make sure your code is pushed to GitHub. Render deploys from a Git repo.

```bash
git add .
git commit -m "chore: production-ready config"
git push origin main
```

### Step 3.2 — Create a new Web Service on Render

1. Go to [render.com](https://render.com) and sign in
2. Click **New** → **Web Service**
3. Connect your GitHub account and select the `whatsapp-knowledge-extractor` repository
4. Configure the service:

| Field | Value |
|-------|-------|
| **Name** | `whatsapp-extractor-api` (or any name you like) |
| **Region** | Choose closest to your users |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | Free (or Starter $7/mo for always-on + persistent disk) |

> **Critical**: The start command must use `--host 0.0.0.0` and `--port $PORT`. Render injects the `PORT` environment variable — do not hardcode 8000.

### Step 3.3 — Add a Persistent Disk (paid tier only, recommended)

If you're on a paid Render plan:

1. In your Web Service settings → **Disks** → **Add Disk**
2. Set **Mount Path** to `/data`
3. Set **Size** to at least 1GB (more if you expect large media files)

Then set these environment variables on Render (see Step 3.4):
```
DATA_DIR=/data
MEDIA_DIR=/data/media
DB_PATH=/data/knowledge.db
```

If you're on the free tier, skip this — just know data won't persist.

### Step 3.4 — Set Environment Variables on Render

In your Render Web Service → **Environment** tab, add these variables:

**Required:**
```
GEMINI_API_KEY          your_gemini_api_key_here
LLM_PROVIDER            gemini
```

**Required for persistent data (paid tier with disk):**
```
DATA_DIR                /data
MEDIA_DIR               /data/media
DB_PATH                 /data/knowledge.db
```

**CORS — set AFTER you have your Vercel URL (Step 4):**
```
FRONTEND_ORIGIN         https://your-app.vercel.app
```

**Optional (defaults are fine):**
```
EMBEDDING_MODEL         all-MiniLM-L6-v2
EMBEDDING_BATCH_SIZE    64
```

> Do NOT set `BACKEND_PORT` or `FRONTEND_PORT` on Render. Render manages the port via `$PORT`.

### Step 3.5 — Deploy and verify

1. Click **Create Web Service** — Render will start the first build
2. Watch the build logs — the first build takes 3–5 minutes (installing sentence-transformers)
3. Once deployed, your backend URL will be something like: `https://whatsapp-extractor-api.onrender.com`
4. Test it: open `https://whatsapp-extractor-api.onrender.com/health` in your browser
5. Expected response: `{"status":"healthy","service":"whatsapp-knowledge-extractor","version":"0.1.0"}`

---

## 4. Deploy the Frontend on Vercel

### Step 4.1 — Import the project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure the project:

| Field | Value |
|-------|-------|
| **Framework Preset** | Next.js (auto-detected) |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `.next` (default) |
| **Install Command** | `npm install` (default) |

### Step 4.2 — Set Environment Variables on Vercel

In the project settings → **Environment Variables**, add:

```
NEXT_PUBLIC_API_URL     https://whatsapp-extractor-api.onrender.com
```

Replace the URL with your actual Render backend URL from Step 3.5.

> This variable is used by `next.config.ts` at **build time** to configure the rewrite destination. It is NOT used by the browser at runtime (the browser uses relative `/api/*` URLs that go through the Vercel proxy).

### Step 4.3 — Deploy

Click **Deploy**. Vercel builds and deploys in about 1–2 minutes.

Your frontend URL will be something like: `https://whatsapp-extractor.vercel.app`

---

## 5. Link Frontend and Backend Together

This is the most important section. Here's exactly what needs to happen for the two services to work together.

### Step 5.1 — Update FRONTEND_ORIGIN on Render

Now that you have your Vercel URL, go back to Render → your Web Service → **Environment** and update:

```
FRONTEND_ORIGIN         https://whatsapp-extractor.vercel.app
```

Then click **Save Changes** — Render will redeploy automatically.

This tells the FastAPI CORS middleware to accept requests from your Vercel domain. Without this, direct API calls from the browser would be blocked.

> **Note**: Because the frontend uses the Vercel rewrite proxy (requests go through Vercel's servers, not the browser), CORS is technically not needed for normal page usage. But it IS needed for the SSE (EventSource) progress stream, which browsers open as a direct connection. So set it correctly.

### Step 5.2 — Verify the rewrite proxy is working

After both services are deployed:

1. Open your Vercel app in the browser
2. Open DevTools → Network tab
3. Upload a chat file
4. You should see requests to `/api/chats/upload` going to `your-app.vercel.app` — NOT to `onrender.com`
5. The response should come back successfully

If you see requests going directly to `onrender.com` from the browser, the rewrite proxy is not configured correctly — check `next.config.ts`.

### Step 5.3 — Handle large file uploads (if needed)

If your WhatsApp exports are larger than 4.5MB, the Vercel proxy will reject them. To fix this, make the upload go directly to Render instead of through the proxy.

In `frontend/app/app/upload/page.tsx`, find where `uploadChat` is called and replace it with a direct call to the Render URL for uploads only:

```typescript
// In your upload page component, use the Render URL directly for uploads
const UPLOAD_URL = process.env.NEXT_PUBLIC_API_URL || "";

const res = await fetch(`${UPLOAD_URL}/api/chats/upload`, {
  method: "POST",
  body: formData,
});
```

This makes the upload go directly to Render (bypassing Vercel's 4.5MB limit) while all other API calls still go through the Vercel proxy. The upload endpoint is a POST with a file body — CORS will apply here, so make sure `FRONTEND_ORIGIN` is set correctly on Render.

---

## 6. Environment Variables — Complete Reference

### Render (backend) — what to set

| Variable | Required | Value | Notes |
|----------|----------|-------|-------|
| `GEMINI_API_KEY` | Yes | Your Gemini key | From aistudio.google.com |
| `LLM_PROVIDER` | Yes | `gemini` | Or `ollama` if you have an Ollama server |
| `FRONTEND_ORIGIN` | Yes | `https://your-app.vercel.app` | Your Vercel URL — set after Step 4 |
| `DATA_DIR` | Paid only | `/data` | Path to Render persistent disk mount |
| `MEDIA_DIR` | Paid only | `/data/media` | Must be inside DATA_DIR |
| `DB_PATH` | Paid only | `/data/knowledge.db` | Must be inside DATA_DIR |
| `EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | Default is fine |
| `EMBEDDING_BATCH_SIZE` | No | `64` | Reduce to `32` if you hit memory limits |

**Do NOT set on Render:**
- `BACKEND_PORT` — Render uses `$PORT` automatically
- `FRONTEND_PORT` — not relevant on Render
- `OLLAMA_BASE_URL` / `OLLAMA_MODEL` — unless you have an Ollama server

### Vercel (frontend) — what to set

| Variable | Required | Value | Notes |
|----------|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | Yes | `https://whatsapp-extractor-api.onrender.com` | Your Render backend URL |

**Do NOT set on Vercel:**
- Any backend variables (`GEMINI_API_KEY`, `LLM_PROVIDER`, etc.) — these belong on Render only
- `FRONTEND_ORIGIN` — this is a backend variable

### Local development — what to set in `backend/.env`

```env
GEMINI_API_KEY=your_key_here
LLM_PROVIDER=gemini
DATA_DIR=./data
MEDIA_DIR=./data/media
DB_PATH=./data/knowledge.db
BACKEND_PORT=8000
FRONTEND_PORT=3000
# FRONTEND_ORIGIN is not needed locally — localhost:3000 is always allowed
```

The frontend does not need a `.env` file locally — it uses relative URLs that the Next.js dev server proxies to `localhost:8000`.

---

## 7. How CORS and API Routing Work in Production

Understanding this prevents a lot of confusion.

### The rewrite proxy approach (what this project uses)

```
Browser → GET https://your-app.vercel.app/api/chats
              │
              │  Vercel rewrite rule in next.config.ts:
              │  /api/:path* → https://render-backend.onrender.com/api/:path*
              │
              ▼  (server-side, not visible to browser)
         Render → GET https://render-backend.onrender.com/api/chats
              │
              ▼
         Response flows back through Vercel to browser
```

From the browser's perspective, the request went to `your-app.vercel.app`. No cross-origin request was made. No CORS preflight. No CORS headers needed for this path.

### Why CORS is still configured on the backend

Two reasons:

1. **SSE (EventSource)**: The pipeline progress stream uses `EventSource`, which browsers open as a direct connection to the URL returned by `createProgressStream()`. In `lib/api.ts`, `API_BASE` is `""` (empty string) in the browser, so `EventSource` connects to `your-app.vercel.app/api/chats/{id}/progress` — which Vercel rewrites to Render. This goes through the proxy, so CORS is not needed here either.

2. **Direct upload fallback**: If you configure large file uploads to go directly to the Render URL (Section 5.3), the browser makes a cross-origin POST. CORS is required for this. The `FRONTEND_ORIGIN` env var on Render handles it.

3. **Future-proofing**: If you ever call the Render API directly from a script, mobile app, or another service, CORS is already configured correctly.

### The `NEXT_PUBLIC_API_URL` variable

This variable is used in two places:

- `next.config.ts` — at **build time** to set the rewrite destination. This is a server-side config, not exposed to the browser.
- `lib/api.ts` — as a fallback for server-side rendering (SSR) and API route handlers running on Vercel's Node.js runtime. The browser code always uses `""` (empty string) for `API_BASE`.

---

## 8. Production Checklist

Work through this in order before considering the deployment done.

### Backend (Render)

- [ ] Service is deployed and `/health` returns `{"status":"healthy"}`
- [ ] `GEMINI_API_KEY` is set and valid
- [ ] `LLM_PROVIDER=gemini` is set
- [ ] `FRONTEND_ORIGIN` is set to your Vercel URL
- [ ] If using paid tier: Persistent Disk is mounted at `/data` and `DATA_DIR`, `MEDIA_DIR`, `DB_PATH` point to `/data`
- [ ] Build logs show `alembic upgrade head` completed without errors
- [ ] No errors in the Render service logs

### Frontend (Vercel)

- [ ] Project is deployed and the landing page loads
- [ ] `NEXT_PUBLIC_API_URL` is set to your Render backend URL
- [ ] Build completed without TypeScript errors
- [ ] No errors in the Vercel build logs

### Integration

- [ ] Open the app → click "Get Started" → Upload page loads
- [ ] Upload a small `.txt` WhatsApp export → progress bar appears and completes
- [ ] Dashboard loads with data after upload
- [ ] Search works (type a query in the search bar)
- [ ] Knowledge graph loads
- [ ] Media files (images) display correctly
- [ ] No CORS errors in browser DevTools console
- [ ] No 4xx/5xx errors in browser DevTools Network tab

---

## 9. Things to Keep in Mind in Production

### Data persistence is the biggest risk

SQLite + local filesystem is not designed for cloud deployment. On Render's free tier, your data disappears on every restart. If you're showing this to users or using it seriously:

- Use Render's paid tier with a Persistent Disk
- Or migrate the database to a managed PostgreSQL (Render, Supabase, Neon) and media files to S3/Cloudflare R2

### The sentence-transformers model adds ~90MB to your build

The `all-MiniLM-L6-v2` model downloads on first startup. Render caches it between deploys. If you're hitting memory limits on the free tier (512MB RAM), reduce `EMBEDDING_BATCH_SIZE` to `16` or `32`.

### Render free tier cold starts

After 15 minutes of inactivity, the free tier spins down. The next request takes 30–60 seconds. Users will see a loading spinner. To avoid this:
- Upgrade to Render Starter ($7/month) for always-on
- Or set up an uptime monitor (UptimeRobot, Better Uptime) to ping `/health` every 10 minutes

### File upload size limits

| Platform | Limit |
|----------|-------|
| Vercel free (via proxy) | 4.5 MB |
| Vercel Pro (via proxy) | 100 MB |
| Direct to Render | No limit (Render handles it) |

Most WhatsApp text-only exports are under 4.5MB. Exports with media can be much larger. If your users export with media, configure direct uploads to Render (Section 5.3).

### SSE (progress stream) and Vercel

Vercel's serverless functions have a maximum execution time (10 seconds on free, 60 seconds on Pro). The SSE progress stream is a long-lived connection that can run for several minutes on large chats.

The rewrite proxy in `next.config.ts` forwards SSE connections to Render, but Vercel may time out the connection before the pipeline finishes. If users see the progress bar stop updating mid-way:

- The pipeline is still running on Render — it hasn't failed
- The frontend will reconnect automatically if you implement reconnection logic in the upload page
- Or configure the SSE endpoint to use the Render URL directly (same as the upload workaround in Section 5.3)

### Never commit secrets

The `.gitignore` already excludes `backend/.env`. Double-check:

```bash
git status
# backend/.env should NOT appear in the output
```

If it does appear, remove it:
```bash
git rm --cached backend/.env
git commit -m "chore: remove .env from tracking"
```

### GEMINI_API_KEY security

The Gemini API key is only used server-side in the FastAPI backend. It is never sent to the browser. It is set as an environment variable on Render, not in any frontend code. This is correct and safe.

### Vercel preview deployments

Every pull request on Vercel gets a preview deployment URL like `https://your-app-git-branch-name.vercel.app`. These preview URLs are NOT in your `FRONTEND_ORIGIN` on Render, so CORS will block direct requests from preview deployments.

For preview deployments to work fully, either:
- Add the preview URL pattern to `FRONTEND_ORIGIN` on Render (comma-separated)
- Or accept that previews work for UI-only testing but API calls may fail

---

## 10. Troubleshooting

### "Failed to fetch" or network errors in the browser

1. Check that `NEXT_PUBLIC_API_URL` is set correctly on Vercel
2. Check that the Render service is running (visit the `/health` URL directly)
3. Check browser DevTools → Network tab — what URL is the request going to?
4. If the request is going to `localhost:8000` in production, the rewrite proxy is not working — check `next.config.ts`

### CORS errors in the browser console

You'll see: `Access to fetch at 'https://render-url.onrender.com' from origin 'https://vercel-url.vercel.app' has been blocked by CORS policy`

This means a request is going directly to Render from the browser (bypassing the Vercel proxy). Fix:
1. Make sure `API_BASE` in `lib/api.ts` is `""` (empty string) in the browser — it should be, based on the `typeof window !== "undefined"` check
2. Make sure `FRONTEND_ORIGIN` on Render includes your Vercel URL
3. Redeploy the Render service after changing `FRONTEND_ORIGIN`

### 413 Request Entity Too Large on upload

The file is too large for Vercel's proxy. See Section 5.3 for the direct upload workaround.

### Progress bar stops updating / SSE disconnects

The SSE connection timed out through Vercel's proxy. The pipeline is still running on Render. Options:
- Add reconnection logic to the upload page's `EventSource` handler
- Or point the SSE `EventSource` directly at the Render URL

### Alembic migration fails on Render

Check the build logs. Common causes:
- `DATA_DIR` path doesn't exist yet — the `config.py` creates it on startup, but Alembic runs during build before startup. Fix: add `mkdir -p /data` to the build command: `mkdir -p /data && pip install -r requirements.txt && alembic upgrade head`
- Wrong `DB_PATH` — make sure it points to a writable location

### Render build fails with "hdbscan" error

`hdbscan` sometimes fails to compile on certain Linux environments. Add `--no-build-isolation` to the pip install:

```
pip install -r requirements.txt --no-build-isolation && alembic upgrade head
```

Or remove `hdbscan` from `requirements.txt` — the app falls back to K-Means automatically.

### Sentence-transformers model not found

The model downloads on first startup. If the build times out before it finishes downloading, add a pre-download step to the build command:

```
pip install -r requirements.txt && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')" && alembic upgrade head
```

This downloads and caches the model during the build phase so startup is fast.

---

## Quick Reference — URLs and Variables

| What | Where | Value |
|------|-------|-------|
| Backend health check | Browser | `https://your-render-service.onrender.com/health` |
| Backend API docs | Browser | `https://your-render-service.onrender.com/docs` |
| Frontend app | Browser | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_API_URL` | Vercel env vars | `https://your-render-service.onrender.com` |
| `FRONTEND_ORIGIN` | Render env vars | `https://your-app.vercel.app` |
| `GEMINI_API_KEY` | Render env vars | Your key from aistudio.google.com |

---

*Production Guide version: 1.0*
*Stack: FastAPI on Render + Next.js on Vercel*
*Last updated: 2026-05-17*
