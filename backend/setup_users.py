import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import User
from app.security import get_password_hash

engine = create_engine("sqlite:///./docushield.db")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def setup_users():
    db = SessionLocal()
    
    users_to_seed = [
        # Underwriters
        {
            "username": "sharan_underwriter",
            "name": "Sharan K",
            "email": "sharan.k@canarabank.in",
            "role": "Underwriter",
            "password": "CanaraWriter123"
        },
        {
            "username": "demo_underwriter",
            "name": "Demo Underwriter",
            "email": "demo.underwriter@canarabank.in",
            "role": "Underwriter",
            "password": "Demo@123"
        },
        # Administrators
        {
            "username": "admin",
            "name": "System Admin",
            "email": "admin@docushield.com",
            "role": "Admin",
            "password": "Admin123"
        },
        {
            "username": "admin_canara",
            "name": "Canara Admin",
            "email": "admin.security@canarabank.in",
            "role": "Admin",
            "password": "CanaraAdmin123"
        },
        # Auditors
        {
            "username": "auditor_compliance",
            "name": "Auditor Compliance",
            "email": "auditor.compliance@canarabank.in",
            "role": "Auditor",
            "password": "CanaraAudit123"
        },
        {
            "username": "demo_auditor",
            "name": "Demo Compliance Auditor",
            "email": "demo.auditor@canarabank.in",
            "role": "Auditor",
            "password": "DemoAudit123"
        }
    ]

    for u_data in users_to_seed:
        user = db.query(User).filter(User.username == u_data["username"]).first()
        if not user:
            user = User(
                username=u_data["username"],
                name=u_data["name"],
                email=u_data["email"],
                role=u_data["role"],
                is_active=True,
                otp_verified=True,
                otp_secret="MOCK_OTP_SECRET_KEY"
            )
            db.add(user)
        else:
            user.name = u_data["name"]
            user.email = u_data["email"]
            user.role = u_data["role"]
            user.is_active = True
            user.otp_verified = True
        user.password_hash = get_password_hash(u_data["password"])
    
    db.commit()
    db.close()
    print("Demo users setup complete. Seeded 6 demo accounts across Underwriter, Admin, and Auditor roles.")

if __name__ == "__main__":
    setup_users()

