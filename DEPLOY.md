# Astra CRE Platform — Production Deployment Guide

## Architecture Overview

```
┌─────────────────────┐        HTTPS        ┌──────────────────────┐
│   Vercel (Frontend)  │  ──────────────────▶│  Render (Backend)    │
│   React + Vite + TS  │                     │  FastAPI + SQLAlchemy│
│   Tailwind + shadcn  │                     │  SQLite + Anthropic  │
│                      │                     │                      │
│  astra-cre.vercel.app│                     │  astra-cre-backend.  │
│                      │                     │  onrender.com        │
└─────────────────────┘                     └──────────────────────┘
```

- **Frontend** hosted on Vercel (free tier) — static React SPA
- **Backend** hosted on Render (free tier) — FastAPI web service
- Frontend talks to backend via `VITE_API_URL` environment variable
- Backend allows frontend origin via `CORS_ORIGINS` environment variable

---

## Environment Variables

### Frontend (Vercel)

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `https://astra-cre-backend.onrender.com/api/v1` | Backend API base URL |

### Backend (Render)

| Variable | Value | Description |
|----------|-------|-------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Anthropic API key for Claude |
| `CORS_ORIGINS` | `https://astra-cre.vercel.app` | Comma-separated allowed frontend origins |
| `SECRET_KEY` | *(auto-generated)* | JWT signing key (Render generates this) |
| `DATABASE_URL` | `sqlite:///./app.db` | Database connection string |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Anthropic API endpoint |
| `DEBUG` | `false` | Disable debug mode in production |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded PDFs |

---

## Step-by-Step: Deploy Frontend to Vercel

1. **Sign up / log in** at [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. **Import Git Repository**: Connect your GitHub account and select `grshapiro2001-crypto/astra-cre-platform`
4. **Configure project settings**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (should auto-detect from `vercel.json`)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
5. **Add Environment Variable**:
   - Key: `VITE_API_URL`
   - Value: `https://astra-cre-backend.onrender.com/api/v1`
6. Click **"Deploy"**
7. After deployment, note the assigned URL (e.g., `https://astra-cre.vercel.app` or similar)
8. (Optional) Go to **Settings → Domains** to set a custom domain

---

## Step-by-Step: Deploy Backend to Render

1. **Sign up / log in** at [render.com](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. **Connect Repository**: Link your GitHub account and select `grshapiro2001-crypto/astra-cre-platform`
4. **Configure service**:
   - **Name**: `astra-cre-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Add Environment Variables** (under "Environment" section):
   - `ANTHROPIC_API_KEY` = your `sk-ant-...` key
   - `CORS_ORIGINS` = the Vercel URL from step 7 above (e.g., `https://astra-cre.vercel.app`)
   - `SECRET_KEY` = click "Generate" or paste a random 32+ char string
   - `DATABASE_URL` = `sqlite:///./app.db`
   - `ANTHROPIC_BASE_URL` = `https://api.anthropic.com`
   - `DEBUG` = `false`
   - `UPLOAD_DIR` = `./uploads`
6. **Instance Type**: Free (or Starter if you need persistent disk for SQLite)
7. Click **"Create Web Service"**

> **Note on SQLite + Render Free Tier**: Render's free tier uses ephemeral storage — the SQLite database resets on each deploy. For user testing this is acceptable. For persistent data, upgrade to a paid tier with disk, or switch to Render's managed PostgreSQL.

---

## Post-Deployment Checklist

After both services are deployed:

- [ ] **Set CORS_ORIGINS on Render** to the actual Vercel URL (e.g., `https://astra-cre.vercel.app`)
- [ ] **Set ANTHROPIC_API_KEY on Render** to your real `sk-ant-...` key
- [ ] **Test**: Can load the frontend in browser
- [ ] **Test**: Can register a new account and log in
- [ ] **Test**: Can upload a PDF and get extraction results
- [ ] **Test**: Can view property details page
- [ ] **Test**: Comparison feature works with multiple properties
- [ ] **Test**: Deal folders can be created and properties organized

---

## Troubleshooting

### Frontend loads but API calls fail (CORS errors)

- Open browser DevTools → Console. Look for `Access-Control-Allow-Origin` errors.
- **Fix**: On Render, set `CORS_ORIGINS` to exactly match your Vercel URL (no trailing slash).
  - Correct: `https://astra-cre.vercel.app`
  - Wrong: `https://astra-cre.vercel.app/`

### Frontend loads but shows blank page / routing broken

- Vercel needs the SPA rewrite rule to serve `index.html` for all routes.
- **Fix**: Verify `frontend/vercel.json` exists with the `rewrites` config and redeploy.

### Backend returns 500 errors

- Check Render logs (Dashboard → your service → "Logs" tab).
- Common causes:
  - Missing `ANTHROPIC_API_KEY` → extraction endpoints fail
  - Missing `SECRET_KEY` → auth endpoints fail
  - Missing `DATABASE_URL` → all database operations fail

### PDF upload/extraction fails

- Verify `ANTHROPIC_API_KEY` is set correctly on Render (starts with `sk-ant-`).
- Verify `ANTHROPIC_BASE_URL` is `https://api.anthropic.com` (not localhost).
- Check Render logs for the specific error message.

### "401 Unauthorized" on all requests

- The JWT `SECRET_KEY` on Render must remain constant between deploys.
- If it changes, all existing tokens become invalid. Users need to log in again.

### Database is empty after redeploy

- Render free tier uses ephemeral disk — SQLite data doesn't persist across deploys.
- **Options**:
  1. Accept this for testing (re-upload documents after each deploy)
  2. Upgrade to Render Starter plan + add a Disk
  3. Switch `DATABASE_URL` to a managed PostgreSQL instance (Render offers free PostgreSQL)

### Vercel build fails

- Run locally first: `cd frontend && npx tsc --noEmit && npm run build`
- Check for TypeScript errors or missing dependencies.
- Verify `VITE_API_URL` is set in Vercel environment variables.

### Render build fails

- Check that `backend/requirements.txt` has all dependencies listed.
- The `psycopg2-binary` package requires no additional system deps (binary wheel).
- Run locally: `cd backend && pip install -r requirements.txt` to verify.
