import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
import app.models  # noqa: F401 — import all models so Base.metadata knows about them
from app.api.routes import auth, upload, properties, deal_folders, scoring, data_bank, criteria, chat, organizations

logger = logging.getLogger(__name__)

# Create all database tables on startup (ensures tables exist for fresh deployments)
logger.warning("Creating database tables... (tables registered: %s)", list(Base.metadata.tables.keys()))
Base.metadata.create_all(bind=engine)

# Auto-migrate: add missing columns and fix column types on existing tables
def run_migrations():
    """Add columns and fix types that create_all can't handle on existing tables."""
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        inspector = inspect(engine)
        existing_cols = {c['name']: c for c in inspector.get_columns('properties')}

        # Add missing columns
        new_columns = [
            ("user_guidance_price", "FLOAT"),
            ("non_revenue_units", "FLOAT"),
            ("latitude", "FLOAT"),
            ("longitude", "FLOAT"),
            ("organization_id", "INTEGER"),
        ]
        for col_name, col_type in new_columns:
            if col_name not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE properties ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    logger.warning(f"Migration: added column properties.{col_name}")
                except Exception as e:
                    logger.warning(f"Migration skip {col_name}: {e}")

        # Fix columns that may be stored as TEXT but should be NUMERIC(20,6)
        numeric_columns = [
            "renovation_cost_per_unit", "renovation_total_cost", "renovation_rent_premium",
            "renovation_stabilized_revenue",
            "y1_loss_to_lease", "y1_concessions", "y1_credit_loss", "y1_net_rental_income",
            "y1_utility_reimbursements", "y1_parking_storage_income", "y1_other_income",
            "y1_real_estate_taxes", "y1_insurance", "y1_replacement_reserves", "y1_net_cash_flow",
            "t12_loss_to_lease", "t12_concessions", "t12_credit_loss", "t12_net_rental_income",
            "t12_utility_reimbursements", "t12_parking_storage_income", "t12_other_income",
            "t12_real_estate_taxes", "t12_insurance", "t12_replacement_reserves", "t12_net_cash_flow",
            "t12_revenue", "t12_total_expenses", "t12_gsr",
            "t3_loss_to_lease", "t3_concessions", "t3_credit_loss", "t3_net_rental_income",
            "t3_utility_reimbursements", "t3_parking_storage_income", "t3_other_income",
            "t3_real_estate_taxes", "t3_insurance", "t3_replacement_reserves", "t3_net_cash_flow",
        ]
        for col_name in numeric_columns:
            if col_name in existing_cols:
                col_info = existing_cols[col_name]
                col_type_str = str(col_info['type']).upper()
                # If stored as TEXT or VARCHAR, convert to NUMERIC
                if 'TEXT' in col_type_str or 'VARCHAR' in col_type_str or 'CHAR' in col_type_str:
                    try:
                        conn.execute(text(
                            f"ALTER TABLE properties ALTER COLUMN {col_name} "
                            f"TYPE NUMERIC(20,6) USING NULLIF({col_name}, '')::NUMERIC(20,6)"
                        ))
                        conn.commit()
                        logger.warning(f"Migration: converted properties.{col_name} from TEXT to NUMERIC(20,6)")
                    except Exception as e:
                        logger.warning(f"Migration type fix skip {col_name}: {e}")
            else:
                # Column doesn't exist yet, add it
                try:
                    conn.execute(text(f"ALTER TABLE properties ADD COLUMN {col_name} NUMERIC(20,6)"))
                    conn.commit()
                    logger.warning(f"Migration: added NUMERIC column properties.{col_name}")
                except Exception as e:
                    logger.warning(f"Migration add skip {col_name}: {e}")

        # Also fix unit_mix numeric columns
        try:
            unit_mix_cols = {c['name']: c for c in inspector.get_columns('property_unit_mix')}
            unit_mix_numeric = ["in_place_rent", "proforma_rent", "renovation_premium"]
            for col_name in unit_mix_numeric:
                if col_name in unit_mix_cols:
                    col_type_str = str(unit_mix_cols[col_name]['type']).upper()
                    if 'TEXT' in col_type_str or 'VARCHAR' in col_type_str or 'CHAR' in col_type_str:
                        try:
                            conn.execute(text(
                                f"ALTER TABLE property_unit_mix ALTER COLUMN {col_name} "
                                f"TYPE NUMERIC(20,6) USING NULLIF({col_name}, '')::NUMERIC(20,6)"
                            ))
                            conn.commit()
                            logger.warning(f"Migration: converted property_unit_mix.{col_name} to NUMERIC(20,6)")
                        except Exception as e:
                            logger.warning(f"Migration unit_mix skip {col_name}: {e}")
        except Exception as e:
            logger.warning(f"Migration unit_mix error: {e}")

        # Add organization_id to deal_folders if missing
        try:
            df_cols = {c['name'] for c in inspector.get_columns('deal_folders')}
            if 'organization_id' not in df_cols:
                conn.execute(text("ALTER TABLE deal_folders ADD COLUMN organization_id INTEGER"))
                conn.commit()
                logger.warning("Migration: added column deal_folders.organization_id")
        except Exception as e:
            logger.warning(f"Migration deal_folders org_id skip: {e}")

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
app.include_router(organizations.router, prefix="/api/v1")

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
