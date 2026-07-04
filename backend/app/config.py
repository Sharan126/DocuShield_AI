import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    PROJECT_NAME: str = "DocuShield AI"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "7b0f22f7cdbfd6b63d72111c15f939e6a715a7cf6103328e18dbff67a731efc1")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./docushield.db")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./media/uploads")
    ELA_DIR: str = os.getenv("ELA_DIR", "./media/ela")
    DISABLE_HEAVY_AI: bool = os.getenv("DISABLE_HEAVY_AI", "false").lower() in ("true", "1", "yes")

    # Roles definitions
    ROLE_ADMIN: str = "Admin"
    ROLE_UNDERWRITER: str = "Underwriter"
    ROLE_AUDITOR: str = "Auditor"

    # Frontend and Email Configuration
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "no-reply@docushield.ai")
    EMAIL_DIR: str = os.getenv("EMAIL_DIR", "./media/emails")

settings = Settings()

# Ensure folders exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.ELA_DIR, exist_ok=True)
os.makedirs(settings.EMAIL_DIR, exist_ok=True)
