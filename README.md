# CRE Platform

A web platform for commercial real estate professionals featuring PDF analysis, property library management, and financial comparison tools.

## Project Structure

```
Claude Test/
├── backend/          # Python FastAPI backend
├── frontend/         # React + TypeScript frontend
└── docker-compose.yml # PostgreSQL setup
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ (via Docker or local install)
- Docker & Docker Compose (recommended for PostgreSQL)

## Quick Start

### 1. Start PostgreSQL

**Option A: Using Docker (Recommended)**
```bash
docker compose up -d
```

**Option B: Local PostgreSQL**
If you have PostgreSQL installed locally, update the connection string in `backend/.env`:
```
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/cre_platform
```

### 2. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head

# Start backend server
uvicorn app.main:app --reload
```

Backend will be running at: http://localhost:8000
API docs available at: http://localhost:8000/docs

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be running at: http://localhost:5173

## Testing Phase 1

1. Open http://localhost:5173 in your browser
2. Click "Create a new account"
3. Register with email and password
4. You should be auto-logged in and redirected to the dashboard
5. Try logging out and logging back in
6. Verify protected routes work (try accessing /dashboard without login)

## Features by Phase

### Phase 1: Authentication ✅ (Current)
- User registration and login
- JWT-based authentication
- Protected routes
- Basic dashboard layout

### Phase 2: PDF Upload & Extraction (Next)
- Upload Offering Memorandums and BOVs
- Extract property data automatically
- Manual correction of extracted data
- Save properties to library

### Phase 3: Library Management
- Folder organization
- Property cards and list views
- Search and filter
- Property details modal

### Phase 4: Financial Comparison
- Side-by-side property comparison
- Color-coded metrics
- Export to CSV
- Save comparisons

### Phase 5: Enhancement & Polish
- Improved extraction accuracy
- Responsive design
- Data visualizations
- Production deployment

## Technology Stack

**Backend:**
- FastAPI (Python web framework)
- PostgreSQL (Database)
- SQLAlchemy (ORM)
- Alembic (Migrations)
- JWT (Authentication)

**Frontend:**
- React 18 + TypeScript
- Vite (Build tool)
- Tailwind CSS (Styling)
- Zustand (State management)
- React Router (Routing)
- Axios (HTTP client)

## Development

### Backend Development

```bash
cd backend

# Run tests
pytest

# Create new migration
alembic revision --autogenerate -m "Description"
alembic upgrade head

# Check database
# Use your PostgreSQL client or pgAdmin to connect to:
# Host: localhost
# Port: 5432
# Database: cre_platform
# User: cre_user
# Password: cre_password
```

### Frontend Development

```bash
cd frontend

# Run linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://cre_user:cre_password@localhost:5432/cre_platform
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
APP_NAME=CRE Platform
DEBUG=True
UPLOAD_DIR=./uploads
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000/api/v1
```

## Troubleshooting

### Backend Issues

**Port 8000 already in use:**
```bash
# Find and kill the process
lsof -ti:8000 | xargs kill -9
```

**Database connection error:**
- Check if PostgreSQL is running
- Verify DATABASE_URL in backend/.env
- Ensure migrations are up to date: `alembic upgrade head`

**Import errors:**
- Ensure virtual environment is activated
- Reinstall dependencies: `pip install -r requirements.txt`

### Frontend Issues

**Port 5173 already in use:**
```bash
# Kill the process
lsof -ti:5173 | xargs kill -9
```

**API connection error:**
- Ensure backend is running on port 8000
- Check VITE_API_URL in frontend/.env
- Check browser console for CORS errors

**Build errors:**
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear npm cache: `npm cache clean --force`

## API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Status

**Phase 1: Complete ✅**
- Backend API with authentication
- Frontend UI with login/register
- Protected routes
- Basic dashboard

**Next Steps:**
- Phase 2: Implement PDF upload and extraction
- Add property model and CRUD endpoints
- Build PDF uploader component
- Implement text extraction with pdfplumber

## License

Proprietary - Internal use only
