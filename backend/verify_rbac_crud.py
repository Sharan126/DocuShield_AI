import os
import sys
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
logger = logging.getLogger("verify_rbac_crud")

def run_rbac_test():
    client = TestClient(app)
    db = SessionLocal()
    
    # User names/passwords from seeds
    admin_creds = {"username": "admin_canara", "password": "CanaraAdmin123"}
    underwriter_creds = {"username": "sharan_underwriter", "password": "CanaraWriter123"}
    auditor_creds = {"username": "auditor_compliance", "password": "CanaraAudit123"}
    
    logger.info("Step 1: Authenticating roles and acquiring tokens...")
    # Admin login
    res = client.post("/api/auth/login", json=admin_creds)
    assert res.status_code == 200, "Admin login failed"
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Underwriter login
    res = client.post("/api/auth/login", json=underwriter_creds)
    assert res.status_code == 200, "Underwriter login failed"
    underwriter_token = res.json()["access_token"]
    underwriter_headers = {"Authorization": f"Bearer {underwriter_token}"}
    
    # Auditor login
    res = client.post("/api/auth/login", json=auditor_creds)
    assert res.status_code == 200, "Auditor login failed"
    auditor_token = res.json()["access_token"]
    auditor_headers = {"Authorization": f"Bearer {auditor_token}"}
    
    logger.info("Step 2: Testing public registration blockage...")
    # Trying public register (register is now admin-only)
    res = client.post("/api/auth/register", json={
        "username": "public_user",
        "email": "public@test.com",
        "password": "Password123",
        "name": "Public User",
        "role": "Underwriter"
    })
    # Since we added security.RoleChecker(["Admin"]) to register, it should return 401 without auth header
    assert res.status_code in [401, 403], f"Expected 401/403 for public register, got {res.status_code}"
    logger.info("-> Public registration successfully blocked!")
    
    logger.info("Step 3: Testing User Creation authorization...")
    test_user_payload = {
        "username": "rbac_new_officer",
        "name": "Rbac New Officer",
        "email": "new.officer@canarabank.in",
        "password": "CanaraOfficer123",
        "role": "Underwriter"
    }
    
    # Cleanup if already exists
    existing = db.query(models.User).filter(models.User.username == test_user_payload["username"]).first()
    if existing:
        db.delete(existing)
        db.commit()
        
    # Underwriter trying to create user
    res = client.post("/api/auth/users", json=test_user_payload, headers=underwriter_headers)
    assert res.status_code == 403, f"Expected 403 for Underwriter creating user, got {res.status_code}"
    
    # Auditor trying to create user
    res = client.post("/api/auth/users", json=test_user_payload, headers=auditor_headers)
    assert res.status_code == 403, f"Expected 403 for Auditor creating user, got {res.status_code}"
    
    # Admin creating user
    res = client.post("/api/auth/users", json=test_user_payload, headers=admin_headers)
    assert res.status_code == 200, f"Expected 200 for Admin creating user, got {res.status_code}"
    created_user_id = res.json()["id"]
    logger.info(f"-> User creation authorization verified! Created user ID: {created_user_id}")
    
    logger.info("Step 4: Testing User Reading / Listing authorization...")
    # Underwriter trying to list users
    res = client.get("/api/auth/users", headers=underwriter_headers)
    assert res.status_code == 403, "Underwriter list users should be blocked"
    
    # Auditor trying to list users
    res = client.get("/api/auth/users", headers=auditor_headers)
    assert res.status_code == 403, "Auditor list users should be blocked"
    
    # Admin listing users
    res = client.get("/api/auth/users", headers=admin_headers)
    assert res.status_code == 200, "Admin listing users failed"
    users = res.json()
    assert len(users) >= 3, "Expected at least 3 users in listing"
    logger.info("-> User reading/listing authorization verified!")
    
    logger.info("Step 5: Testing User Updating authorization...")
    update_payload = {
        "name": "Rbac Upgraded Name",
        "email": "rbac.upgraded@canarabank.in",
        "role": "Auditor",
        "is_active": False
    }
    
    # Underwriter trying to update user
    res = client.put(f"/api/auth/users/{created_user_id}", json=update_payload, headers=underwriter_headers)
    assert res.status_code == 403, "Underwriter update user should be blocked"
    
    # Admin updating user
    res = client.put(f"/api/auth/users/{created_user_id}", json=update_payload, headers=admin_headers)
    assert res.status_code == 200, "Admin update user failed"
    updated_user = res.json()
    assert updated_user["name"] == "Rbac Upgraded Name"
    assert updated_user["email"] == "rbac.upgraded@canarabank.in"
    assert updated_user["role"] == "Auditor"
    assert updated_user["is_active"] == False
    logger.info("-> User update details and active status toggle verified!")
    
    logger.info("Step 5b: Checking that deactivated user login fails...")
    inactive_login_res = client.post("/api/auth/login", json={
        "username": test_user_payload["username"],
        "password": test_user_payload["password"]
    })
    assert inactive_login_res.status_code == 403, f"Expected 403 for deactivated user login, got {inactive_login_res.status_code}"
    assert "deactivated" in inactive_login_res.json()["detail"].lower()
    logger.info("-> Deactivated login prevention verified!")
    
    logger.info("Step 6: Testing User Password Reset authorization...")
    reset_payload = {"password": "NewClearancePassword456"}
    
    # Underwriter resetting password
    res = client.post(f"/api/auth/users/{created_user_id}/reset-password", json=reset_payload, headers=underwriter_headers)
    assert res.status_code == 403, "Underwriter password reset should be blocked"
    
    # Admin resetting password
    res = client.post(f"/api/auth/users/{created_user_id}/reset-password", json=reset_payload, headers=admin_headers)
    assert res.status_code == 200, "Admin password reset failed"
    
    # Reactivate the user to test login with new password
    client.put(f"/api/auth/users/{created_user_id}", json={"is_active": True}, headers=admin_headers)
    
    # Login with new password
    new_login_res = client.post("/api/auth/login", json={
        "username": test_user_payload["username"],
        "password": reset_payload["password"]
    })
    assert new_login_res.status_code == 200, "Login with reset password failed"
    logger.info("-> Admin password reset verification successful!")
    
    logger.info("Step 7: Testing User Deletion authorization...")
    # Underwriter deleting user
    res = client.delete(f"/api/auth/users/{created_user_id}", headers=underwriter_headers)
    assert res.status_code == 403, "Underwriter delete user should be blocked"
    
    # Admin deleting user
    res = client.delete(f"/api/auth/users/{created_user_id}", headers=admin_headers)
    assert res.status_code == 200, "Admin delete user failed"
    
    # Verify deletion in DB
    deleted_check = db.query(models.User).filter(models.User.id == created_user_id).first()
    assert deleted_check is None, "User should be deleted from DB"
    logger.info("-> User deletion verification successful!")
    
    logger.info("Step 8: Testing Auditor read-only document access...")
    # List documents as Auditor (should succeed)
    res = client.get("/api/documents/", headers=auditor_headers)
    assert res.status_code == 200, "Auditor should be allowed to list documents"
    
    # Auditor trying to upload document (should fail)
    res = client.post("/api/documents/upload", files=[("files", ("test.png", b"dummy content", "image/png"))], headers=auditor_headers)
    assert res.status_code == 403, "Auditor should be blocked from uploading documents"
    
    # Auditor trying to cross-validate (should fail)
    res = client.post("/api/documents/cross-validate", data={"doc_id_1": "1", "doc_id_2": "2"}, headers=auditor_headers)
    assert res.status_code == 403, "Auditor should be blocked from cross-validating documents"
    logger.info("-> Auditor read-only document restrictions verified!")
    
    logger.info("Step 9: Testing ML endpoints protection...")
    # Auditor trying /ml/predict
    res = client.post("/api/ml/predict", files=[("file", ("test.png", b"dummy content", "image/png"))], headers=auditor_headers)
    assert res.status_code == 403, "Auditor should be blocked from ML predict"
    
    # Underwriter trying /ml/predict (should pass auth, but might fail on content since dummy - expected 400 or similar, but NOT 403)
    res = client.post("/api/ml/predict", files=[("file", ("test.png", b"dummy content", "image/png"))], headers=underwriter_headers)
    assert res.status_code != 403, "Underwriter should not get 403 on ML predict"
    logger.info("-> ML endpoints role protection verified!")

    logger.info("Step 10: Testing Auditor analytics access...")
    res = client.get("/api/analytics/summary", headers=auditor_headers)
    assert res.status_code == 200, "Auditor should be allowed to view analytics summary"
    logger.info("-> Auditor analytics summary access verified!")
    
    db.close()
    print("\n" + "=" * 70)
    print("      ALL AUTH & RBAC CRUD ENTERPRISE TESTS PASSED SUCCESSFULLY!    ")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    run_rbac_test()