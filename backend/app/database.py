from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Determine if SQLite is used
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# Configure database engine
if is_sqlite:
    engine = create_engine(
        settings.DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get db session in FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_db_migrations():
    from sqlalchemy import text
    columns = [
        ("document_id", "VARCHAR"),
        ("upload_time", "DATETIME"),
        ("analysis_status", "VARCHAR"),
        ("risk_score", "FLOAT"),
        ("layoutlm_intelligence", "TEXT"),
        ("signature_similarity", "FLOAT"),
        ("possible_forgery", "BOOLEAN"),
        ("gnn_fraud_probability", "FLOAT"),
        ("gnn_risk_level", "VARCHAR")
    ]
    with engine.begin() as conn:
        for col, col_type in columns:
            actual_type = col_type
            if not is_sqlite and col_type == "DATETIME":
                actual_type = "TIMESTAMP"
            try:
                conn.execute(text(f"ALTER TABLE documents ADD COLUMN {col} {actual_type}"))
            except Exception as e:
                # Column probably already exists or table doesn't exist
                pass

        # Migrate users table
        # 1. Rename hashed_password to password_hash if needed
        try:
            conn.execute(text("ALTER TABLE users RENAME COLUMN hashed_password TO password_hash"))
        except Exception:
            pass

        # 2. Add password_hash column in case rename failed and it doesn't exist
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR"))
        except Exception:
            pass

        # 3. Copy password hash values if both columns somehow coexist and password_hash is empty
        try:
            conn.execute(text("UPDATE users SET password_hash = hashed_password WHERE password_hash IS NULL AND hashed_password IS NOT NULL"))
        except Exception:
            pass

        # 4. Add other new user fields
        user_fields = [
            ("name", "VARCHAR"),
            ("created_by", "INTEGER"),
            ("last_login", "DATETIME")
        ]
        for col, col_type in user_fields:
            actual_type = col_type
            if not is_sqlite and col_type == "DATETIME":
                actual_type = "TIMESTAMP"
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {actual_type}"))
            except Exception:
                pass


