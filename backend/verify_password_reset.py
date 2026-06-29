import os
import sys
import json
import logging

# Ensure DLL path preload for PyTorch on Windows
if sys.platform == 'win32':
    try:
        import ctypes
        ctypes.CDLL("vcruntime140.dll")
        ctypes.CDLL("vcruntime140_1.dll")
        ctypes.CDLL("msvcp140.dll")
    except Exception:
        pass

# Add backend dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app import models, security

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_password_reset")

def run_test():
    client = TestClient(app)
    db = SessionLocal()
    
    test_username = "reset_tester"
    test_email = "tester@reset.com"
    old_password = "old_pass_123"
    new_password = "new_pass_456"

    logger.info("Initializing Test: Cleaning up old test users if they exist...")
    existing = db.query(models.User).filter(models.User.username == test_username).first()
    if existing:
        db.delete(existing)
        db.commit()

    logger.info("Step 1: Creating test user...")
    hashed = security.get_password_hash(old_password)
    test_user = models.User(
        username=test_username,
        email=test_email,
        hashed_password=hashed,
        role="Underwriter"
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)
    
    try:
        # Step 2: Test /forgot-password
        logger.info("Step 2: Testing /forgot-password API...")
        forgot_res = client.post(f"/api/auth/forgot-password?username={test_username}")
        assert forgot_res.status_code == 200, f"Expected 200, got {forgot_res.status_code}"
        forgot_data = forgot_res.json()
        assert "Verification link sent" in forgot_data["message"]
        logger.info("-> /forgot-password verified successfully!")

        # Step 2b: Verify email file creation and contents
        logger.info("Step 2b: Verifying email file creation...")
        from app.config import settings
        email_files = [f for f in os.listdir(settings.EMAIL_DIR) if f.startswith(f"reset_{test_username}_")]
        assert len(email_files) >= 1, "No reset email file found in email directory"
        
        # Read the latest email file
        email_files.sort()
        latest_email_path = os.path.join(settings.EMAIL_DIR, email_files[-1])
        with open(latest_email_path, "r", encoding="utf-8") as f:
            email_content = f.read()
            
        assert f"To: {test_email}" in email_content
        assert f"username={test_username}" in email_content
        assert "mode=reset" in email_content
        logger.info(f"-> Email file created at {latest_email_path} and contains correct reset link!")

        # Step 3: Test /forgot-password with invalid username
        logger.info("Step 3: Testing /forgot-password with non-existent user...")
        forgot_bad = client.post("/api/auth/forgot-password?username=nonexistent_user")
        assert forgot_bad.status_code == 404, f"Expected 404, got {forgot_bad.status_code}"
        logger.info("-> Non-existent user handled correctly (404)!")

        # Step 4: Test /reset-password
        logger.info("Step 4: Testing /reset-password API...")
        reset_res = client.post("/api/auth/reset-password", json={
            "username": test_username,
            "new_password": new_password
        })
        assert reset_res.status_code == 200, f"Expected 200, got {reset_res.status_code}"
        reset_data = reset_res.json()
        assert "completed successfully" in reset_data["message"]
        logger.info("-> /reset-password verified successfully!")

        # Step 5: Test login using new credentials
        logger.info("Step 5: Testing /login API with NEW password...")
        login_res = client.post("/api/auth/login", json={
            "username": test_username,
            "password": new_password
        })
        assert login_res.status_code == 200, f"Expected 200, got {login_res.status_code}"
        login_data = login_res.json()
        assert login_data["access_token"] is not None
        assert login_data["username"] == test_username
        logger.info("-> Login using new password verified successfully!")

        # Step 6: Test login using OLD password (should fail)
        logger.info("Step 6: Testing /login API with OLD password (should fail)...")
        login_fail = client.post("/api/auth/login", json={
            "username": test_username,
            "password": old_password
        })
        assert login_fail.status_code == 401, f"Expected 401, got {login_fail.status_code}"
        logger.info("-> Authentication with old password rejected successfully!")

        # Step 7: Verify Audit Log entries
        logger.info("Step 7: Verifying database audit log entries...")
        forgot_log = db.query(models.AuditLog).filter(
            models.AuditLog.username == test_username,
            models.AuditLog.event.like("%reset requested%")
        ).first()
        reset_log = db.query(models.AuditLog).filter(
            models.AuditLog.username == test_username,
            models.AuditLog.event.like("%reset successfully completed%")
        ).first()
        
        assert forgot_log is not None, "Forgot password audit log missing"
        assert reset_log is not None, "Reset password audit log missing"
        logger.info("-> Audit logs verified successfully!")

        print("\n" + "=" * 70)
        print("    ALL PASSWORD RESET END-TO-END TESTS PASSED SUCCESSFULLY!    ")
        print("=" * 70 + "\n")

    finally:
        logger.info("Cleaning up test user...")
        user_to_del = db.query(models.User).filter(models.User.username == test_username).first()
        if user_to_del:
            db.delete(user_to_del)
        
        # Clean up test audit logs
        db.query(models.AuditLog).filter(models.AuditLog.username == test_username).delete()
        db.commit()

        # Clean up test email files
        try:
            from app.config import settings
            if os.path.exists(settings.EMAIL_DIR):
                for f in os.listdir(settings.EMAIL_DIR):
                    if f.startswith(f"reset_{test_username}_"):
                        os.remove(os.path.join(settings.EMAIL_DIR, f))
        except Exception:
            pass
            
        db.close()

if __name__ == "__main__":
    run_test()
