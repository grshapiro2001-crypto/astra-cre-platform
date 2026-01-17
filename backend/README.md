# CRE Platform Backend

FastAPI backend for the Commercial Real Estate Platform.

## Setup

### 1. Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Copy `.env.example` to `.env` and update values if needed:

```bash
cp .env.example .env
```

### 4. Setup Database

Make sure PostgreSQL is running (via Docker or locally), then run migrations:

```bash
# Create initial migration
alembic revision --autogenerate -m "Initial migration with users table"

# Apply migrations
alembic upgrade head
```

### 5. Run Development Server

```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Available Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and receive JWT token
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/logout` - Logout

### Health Check
- `GET /` - Root endpoint
- `GET /health` - Health check

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Settings
│   ├── database.py          # Database connection
│   ├── models/              # SQLAlchemy models
│   │   └── user.py
│   ├── schemas/             # Pydantic schemas
│   │   └── user.py
│   ├── api/
│   │   ├── deps.py          # Dependencies (auth)
│   │   └── routes/
│   │       └── auth.py      # Auth endpoints
│   ├── services/
│   │   └── auth_service.py  # JWT and password handling
│   └── utils/
├── alembic/                 # Database migrations
├── uploads/                 # File storage
├── requirements.txt
└── .env
```

## Database Migrations

### Create Migration

```bash
alembic revision --autogenerate -m "Description of changes"
```

### Apply Migrations

```bash
alembic upgrade head
```

### Rollback Migration

```bash
alembic downgrade -1
```

### View Migration History

```bash
alembic history
```

## Testing

```bash
pytest
```

## Development

### Add New Model

1. Create model in `app/models/`
2. Import in `app/models/__init__.py`
3. Import in `alembic/env.py`
4. Create migration: `alembic revision --autogenerate -m "Add model"`
5. Apply migration: `alembic upgrade head`

### Add New Endpoint

1. Create route file in `app/api/routes/`
2. Define endpoints with FastAPI decorators
3. Import and include router in `app/main.py`

## Common Commands

```bash
# Start server with auto-reload
uvicorn app.main:app --reload

# Start on different port
uvicorn app.main:app --reload --port 8001

# Run tests
pytest

# Run tests with coverage
pytest --cov=app

# Format code
black app/

# Type checking
mypy app/
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | - |
| SECRET_KEY | JWT signing key | - |
| ALGORITHM | JWT algorithm | HS256 |
| ACCESS_TOKEN_EXPIRE_MINUTES | Token expiration | 60 |
| APP_NAME | Application name | CRE Platform |
| DEBUG | Debug mode | False |
| UPLOAD_DIR | File upload directory | ./uploads |
| CORS_ORIGINS | Allowed CORS origins | localhost:5173 |

## Security Notes

- Never commit `.env` file
- Change SECRET_KEY in production
- Use HTTPS in production
- Set DEBUG=False in production
- Use strong passwords for database
- Keep dependencies updated
