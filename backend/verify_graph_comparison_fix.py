import os
import sys
import json
import sqlite3
from sqlalchemy.orm import Session

# Add backend directory to path
backend_dir = r'c:\Users\FQ1089AU\DocuShield_AI-1\backend'
sys.path.append(backend_dir)

from app.database import SessionLocal
from app import models
from app.services import neo4j_service

def run_verification():
    db = SessionLocal()
    print("=" * 70)
    print("   DOCUSHIELD AI - GRAPH PROPERTY BUG FIX VERIFICATION")
    print("=" * 70)

    try:
        # Clear any existing test records from previous test runs
        db.query(models.Document).filter(models.Document.document_id.like("test_fix_%")).delete(synchronize_session=False)
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
