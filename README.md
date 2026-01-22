# Astra CRE Platform

AI-powered commercial real estate deal analysis platform. Upload OMs/BOVs, extract financial metrics with Claude AI, organize into deal folders, and compare properties side-by-side.

## Quick Start

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Backend
```bash
cd backend
source venv/bin/activate  # Mac/Linux
# OR: venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
# Runs at http://localhost:8000
```

## Features

- **AI Document Extraction** - Upload PDF (OM/BOV), Claude extracts all metrics in seconds
- **Deal Folders** - Organize properties into folders
- **Property Detail** - View extracted financials, cap rates, returns
- **Side-by-Side Comparison** - Compare 2-5 properties with gradient highlighting
- **Investment Criteria Filtering** - Highlight rows based on IRR, cap rate, etc.
- **BOV Multi-Tier Pricing** - Display 2-5 pricing scenarios from BOV documents
- **CSV Export** - Export comparison data

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Python FastAPI + SQLAlchemy + SQLite
- **AI:** Anthropic Claude Sonnet 4

## Documentation

### For Developers & AI Assistants

- **[Core Rules](.ai/01-CORE-RULES.md)** - Coding standards, constraints, patterns
- **[Architecture](.ai/02-ARCHITECTURE.md)** - Technical decisions and why we made them
- **[Codebase](.ai/03-CODEBASE.md)** - What exists (check before building!)
- **[Current Work](.ai/04-CURRENT-WORK.md)** - Active tasks and priorities
- **[Prompt Templates](.ai/05-PROMPTS.md)** - Reusable prompts for Claude Code

### For Reference Only
- **[Full Context](.ai/CONTEXT-FULL.md)** - Comprehensive project context (archived)

## Repository

**GitHub:** github.com/grshapiro2001-crypto/astra-cre-platform

## Getting Started

1. Clone repository
2. Set up backend (Python 3.11+, create venv, install deps)
3. Set up frontend (Node 18+, npm install)
4. Add `.env` in backend with `ANTHROPIC_API_KEY=your_key`
5. Run both servers
6. Open http://localhost:5173

## Current Status

**Phase:** MVP Complete - Planning Portfolio Analysis Feature  
**Last Updated:** January 21, 2026

---

**Maintained by Griffin Shapiro**
