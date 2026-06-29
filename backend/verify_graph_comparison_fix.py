import os
import sys
import json
import sqlite3
from sqlalchemy.orm import Session

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

# Import PyTorch first to prevent DLL loading WinError 127
try:
    import torch
except ImportError:
    pass

from app.database import SessionLocal, Base, engine, run_db_migrations
from app import models
from app.services import neo4j_service

def run_verification():
    print("=" * 70)
    print("   DOCUSHIELD AI - GRAPH PROPERTY BUG FIX VERIFICATION")
    print("=" * 70)

    # Run database migrations to verify columns are created
    print("[Test 0] Running DB migrations for required columns...")
    Base.metadata.create_all(bind=engine)
    run_db_migrations()
    print("-> Schema verified successfully.")

    db = SessionLocal()
    try:
        # Clear any existing test records from previous test runs
        db.query(models.Document).filter(models.Document.document_id.like("test_fix_%")).delete(synchronize_session=False)
        db.commit()

        # Seed Ramesh Kumar test document with PROP-RES-45 to match against
        ramesh_doc = models.Document(
            file_name="Ramesh_SalarySlip.png",
            file_type="PNG",
            file_path="media/uploads/Ramesh_SalarySlip.png",
            file_hash="test_fix_hash_ramesh",
            document_id="test_fix_ramesh_uuid",
            extracted_text="CANARA BANK SALARY SLIP\nEmployee: Ramesh Kumar\nMonthly Net Income: INR 1,45,000",
            layoutlm_intelligence=json.dumps({
                "applicant_name": {"value": "RAMESH KUMAR", "confidence": 0.95},
                "property_id": {"value": "PROP-RES-45", "confidence": 0.92}
            })
        )
        db.add(ramesh_doc)
        db.commit()

        # Step 1. Test 1: Upload a document with a different property ID (e.g., PROP-DIFFERENT-99)
        # It should NOT match PROP-RES-45 or create any property alerts.
        print("\n[Test 1/2] Processing document with a DIFFERENT property ID (PROP-DIFFERENT-99)...")
        
        doc_different_id = "test_fix_diff_uuid"
        app_name_diff = "DIFFERENT APPLICANT"
        addr_diff = "99 Broadway Street, Bangalore"
        prop_id_diff = "PROP-DIFFERENT-99"
        
        penalty_diff, reasons_diff = neo4j_service.calculate_graph_risk_for_document(
            doc_id=doc_different_id,
            applicant_name=app_name_diff,
            address=addr_diff,
            phone_numbers=[],
            db=db,
            property_id=prop_id_diff
        )

        print(f"  - Risk Penalty: {penalty_diff}")
        print(f"  - Reasons: '{reasons_diff}'")
        
        # Assertions for Test 1
        assert penalty_diff == 0, f"Expected 0 penalty, got {penalty_diff}"
        assert "Shares Property ID" not in reasons_diff, "Error: Shared property alert was generated!"
        print("  => Test 1 Passed: No false positive shared property alerts generated.")

        # Step 2. Test 2: Upload a document with the SAME property ID (e.g., PROP-RES-45)
        # It SHOULD detect the shared property match with Ramesh Kumar (which has PROP-RES-45).
        print("\n[Test 2/2] Processing document with a SHARED property ID (PROP-RES-45)...")
        
        doc_shared_id = "test_fix_shared_uuid"
        app_name_shared = "SHARED COLLATERAL USER"
        addr_shared = "45 Residency Road, Bangalore - 560025"
        prop_id_shared = "PROP-RES-45"
        
        penalty_shared, reasons_shared = neo4j_service.calculate_graph_risk_for_document(
            doc_id=doc_shared_id,
            applicant_name=app_name_shared,
            address=addr_shared,
            phone_numbers=[],
            db=db,
            property_id=prop_id_shared
        )

        print(f"  - Risk Penalty: {penalty_shared}")
        print(f"  - Reasons: '{reasons_shared}'")
        
        # Assertions for Test 2
        assert penalty_shared >= 30, f"Expected penalty >= 30, got {penalty_shared}"
        assert "Shares Property ID 'PROP-RES-45'" in reasons_shared, "Error: Failed to detect shared property ID!"
        print("  => Test 2 Passed: Successfully detected genuine shared-property mismatch.")

    except Exception as e:
        print(f"\n[Verification Failure] {e}")
        raise e
    finally:
        # Cleanup test records
        db.query(models.Document).filter(models.Document.document_id.like("test_fix_%")).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("\n" + "=" * 70)
        print("   VERIFICATION SCRIPTS RUN COMPLETED SUCCESSFULLY!")
        print("=" * 70)

if __name__ == '__main__':
    run_verification()
