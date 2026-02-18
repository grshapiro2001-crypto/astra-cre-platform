import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
import app.models  # noqa: F401 — import all models so Base.metadata knows about them
from app.api.routes import auth, upload, properties, deal_folders, scoring, data_bank, criteria, chat

logger = logging.getLogger(__name__)

# Create all database tables on startup (ensures tables exist for fresh deployments)
logger.warning("Creating database tables... (tables registered: %s)", list(Base.metadata.tables.keys()))
Base.metadata.create_all(bind=engine)

# Auto-migrate: add missing columns to existing tables
def run_migrations():
    """Add columns that create_all can't add to existing tables."""
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        inspector = inspect(engine)
        existing_cols = [c['name'] for c in inspector.get_columns('properties')]
        migrations = [
            ("user_guidance_price", "FLOAT"),
            ("non_revenue_units", "FLOAT"),
        ]
        for col_name, col_type in migrations:
            if col_name not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE properties ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    logger.warning(f"Migration: added column properties.{col_name}")
                except Exception as e:
                    logger.warning(f"Migration skip {col_name}: {e}")

try:
    run_migrations()
except Exception as e:
    logger.warning(f"Migration error: {e}")
logger.warning("Database tables created successfully.")

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(upload.router)
app.include_router(properties.router, prefix="/api/v1")
app.include_router(deal_folders.router, prefix="/api/v1")
app.include_router(scoring.router, prefix="/api/v1")
app.include_router(data_bank.router, prefix="/api/v1")
app.include_router(criteria.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "Welcome to CRE Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
