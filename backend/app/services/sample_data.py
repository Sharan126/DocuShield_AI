import json
import datetime
from sqlalchemy.orm import Session
from app import models, security

def seed_database(db: Session):
    # 1. Check if database is already seeded
    if db.query(models.User).first() is not None:
        return
        
    print("Seeding database with production-grade sample loan underwriting records...")

    # 2. Create Users (Admin, Underwriter, Auditor)
    admin_user = models.User(
        username="admin_canara",
        name="Canara Admin",
        email="admin.security@canarabank.in",
        password_hash=security.get_password_hash("CanaraAdmin123"),
        role="Admin",
        is_active=True,
        otp_secret="MOCK_SECRET_ADMIN",
        otp_verified=True,
        created_by=None
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    
    underwriter_user = models.User(
        username="sharan_underwriter",
        name="Sharan K",
        email="sharan.k@canarabank.in",
        password_hash=security.get_password_hash("CanaraWriter123"),
        role="Underwriter",
        is_active=True,
        otp_secret="MOCK_SECRET_WRITER",
        otp_verified=True,
        created_by=admin_user.id
    )

    auditor_user = models.User(
        username="auditor_compliance",
        name="Auditor Compliance",
        email="auditor.compliance@canarabank.in",
        password_hash=security.get_password_hash("CanaraAudit123"),
        role="Auditor",
        is_active=True,
        otp_secret="MOCK_SECRET_AUDIT",
        otp_verified=True,
        created_by=admin_user.id
    )

    db.add_all([underwriter_user, auditor_user])
    db.commit()
    db.refresh(underwriter_user)

    # 3. Create Audit Logs
    initial_logs = [
        models.AuditLog(username="System", event="DocuShield DB Migrations Completed", status="Success"),
        models.AuditLog(username="System", event="Loaded RBI Loan Compliance Scanners v2.4", status="Success"),
        models.AuditLog(username="admin_canara", event="Assigned role Auditor to auditor_compliance", status="Success"),
        models.AuditLog(username="sharan_underwriter", event="Logged in and requested underwriting session token", status="Success"),
    ]
    db.add_all(initial_logs)
    db.commit()

    # 4. Create sample clean/tampered documents
    # Setup bounding boxes for Heatmap Viewer overlays:
    # Coords: relative x, y, width, height representing tampered boxes
    tampered_regions_mock = [
        {"id": 1, "x": 75, "y": 295, "w": 250, "h": 30, "risk": "High", "label": "Income Figure Patched (Font mismatch)"},
        {"id": 2, "x": 380, "y": 680, "w": 120, "h": 50, "risk": "Suspicious", "label": "Signature Block Compression Alteration"}
    ]

    explainable_ai_reasons_mock = [
        "EXIF metadata reports document was edited in Adobe Photoshop on 2026-05-28.",
        "Significant font variance found inside 'Monthly Income' block (Times New Roman overlaid on Arial layout).",
        "Error Level Analysis (ELA) compression discrepancy detected in the signature block (suggests copy-paste).",
        "Name spelling deviations identified during Aadhaar ID cross-validation."
    ]

    clean_doc = models.Document(
        file_name="Ramesh_Kumar_SalarySlip.png",
        file_type="PNG",
        file_path="media/uploads/Ramesh_Kumar_SalarySlip.png",
        file_hash="e2e01df391d84ad9a1496a798991bca7",
        fraud_score=4.2,
        confidence_score=98.5,
        risk_level="Low",
        metadata_status="Passed",
        font_status="Passed",
        signature_status="Passed",
        compression_status="Passed",
        uploaded_by_id=underwriter_user.id,
        tamper_regions=json.dumps([]),
        extracted_text="CANARA BANK SALARY SLIP\nEmployee: Ramesh Kumar\nMonthly Net Income: INR 1,45,000",
        metadata_json=json.dumps({"Software": "Scanner standard v1.2", "Created": "2026-05-28"}),
        explainable_ai_reasons=json.dumps(["All digital layout criteria match bank verification parameters."])
    )

    tampered_doc = models.Document(
        file_name="Sunita_Kumar_SalarySlip_Tampered.png",
        file_type="PNG",
        file_path="media/uploads/Sunita_Kumar_SalarySlip_Tampered.png",
        file_hash="a1bc8f99e4a3b8d64197e7984f1837ff",
        fraud_score=92.6,
        confidence_score=87.2,
        risk_level="Critical",
        metadata_status="Tampered",
        font_status="Alert",
        signature_status="Alert",
        compression_status="Alert",
        uploaded_by_id=underwriter_user.id,
        tamper_regions=json.dumps(tampered_regions_mock),
        extracted_text="CANARA BANK SALARY SLIP\nEmployee: Sunita Kumar\nMonthly Net Income: INR 8,45,000",
        metadata_json=json.dumps({"Software": "Adobe Photoshop 2025 (Windows)", "Created": "2025-11-10", "Modified": "2026-05-28"}),
        explainable_ai_reasons=json.dumps(explainable_ai_reasons_mock)
    )

    db.add_all([clean_doc, tampered_doc])
    db.commit()
    db.refresh(clean_doc)
    db.refresh(tampered_doc)

    # 5. Create cross validation record
    discrepancies_mock = [
        {
            "category": "Financial Mismatch",
            "details": "Monthly Income listed in Salary Slip (INR 8,45,000) deviates by 482% from Bank Statement average deposit logs (INR 1,45,000)."
        },
        {
            "category": "Address Mismatch",
            "details": "Applicant residential address on Salary Slip (Residency Rd) does not match Home Utility Statement (M.G. Road)."
        }
    ]
    
    cross_val = models.CrossValidation(
        primary_document_id=clean_doc.id,
        secondary_document_id=tampered_doc.id,
        name_match=True,
        address_match=False,
        property_match=True,
        financial_match=False,
        discrepancy_report=json.dumps(discrepancies_mock)
    )

    # 6. Add upload activity logs
    db.add(cross_val)
    db.add(models.AuditLog(username="sharan_underwriter", event=f"Uploaded {clean_doc.file_name}", status="Success"))
    db.add(models.AuditLog(username="sharan_underwriter", event=f"Uploaded {tampered_doc.file_name}", status="Success"))
    db.add(models.AuditLog(username="sharan_underwriter", event="Triggered Multi-document cross check matching IDs", status="Warn"))
    db.commit()

    print("Database seeding completed.")
