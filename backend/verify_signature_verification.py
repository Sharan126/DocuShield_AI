import sys
import os
import json
import cv2
import numpy as np

# Ensure backend directory is in path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Import PyTorch first to prevent DLL loading WinError 127
try:
    import torch
except ImportError:
    pass

from app.services import signature_service, risk_score
from app.database import SessionLocal, Base, engine, run_db_migrations
from app import models

def run_test():
    print("=" * 75)
    print("      DOCUSHIELD AI - SIGNATURE VERIFICATION INTEGRATION TEST      ")
    print("=" * 75)

    # Setup directories
    project_root = os.path.dirname(os.path.abspath(__file__))
    genuine_path = os.path.join(project_root, "..", "document_forensics", "test_files", "sample_genuine.jpg")
    tampered_path = os.path.join(project_root, "..", "document_forensics", "test_files", "sample_tampered.jpg")

    applicant_name = "TEST_SIGNER_VERIFICATION"
    ref_sig_file = os.path.join("media", "signatures", f"ref_{applicant_name}.png")
    
    try:
        # 1. Run database migrations to verify signature columns are created
        print("[Test 1/4] Running DB migrations for signature columns...")
        Base.metadata.create_all(bind=engine)
        run_db_migrations()
        print("-> Schema verified successfully.")

        # Clean up previous reference signature
        if os.path.exists(ref_sig_file):
            os.remove(ref_sig_file)

        # 2. Run first verification (caching signature as baseline)
        print(f"\n[Test 2/4] Uploading Document 1 (caching baseline reference)...")
        res1 = signature_service.verify_document_signature(
            genuine_path, applicant_name, [{"text": "Applicant Signature", "x": 25, "y": 206, "width": 145, "height": 15}]
        )
        print("-> Result 1 (Baseline cached):")
        print(json.dumps(res1, indent=4))
        
        assert res1["signature_similarity"] == 1.0
        assert res1["possible_forgery"] is False
        assert os.path.exists(ref_sig_file)
        print("-> Baseline reference caching assertions passed.")

        # 3. Compare with the same document (identical matching)
        print(f"\n[Test 3/4] Uploading identical signature (should match perfectly)...")
        res2 = signature_service.verify_document_signature(
            genuine_path, applicant_name, [{"text": "Applicant Signature", "x": 25, "y": 206, "width": 145, "height": 15}]
        )
        print("-> Result 2 (Identical comparison):")
        print(json.dumps(res2, indent=4))
        
        assert res2["signature_similarity"] > 0.95
        assert res2["possible_forgery"] is False
        print("-> Identical signature matching assertions passed.")

        # 4. Compare with tampered/altered signature document
        print(f"\n[Test 4/4] Uploading altered signature document...")
        res3 = signature_service.verify_document_signature(
            tampered_path, applicant_name, [{"text": "Applicant Signature", "x": 195, "y": 232, "width": 61, "height": 18}]
        )
        print("-> Result 3 (Altered comparison):")
        print(json.dumps(res3, indent=4))
        
        # The signature in tampered is significantly compressed/altered
        print(f"   Signature Similarity: {res3['signature_similarity'] * 100:.2f}%")
        print(f"   Possible Forgery Flagged: {res3['possible_forgery']}")

        # Verify risk_score.py integration
        print("\n[Test] Verifying risk_score.py integration...")
        risk_output = risk_score.calculate_risk_score(
            meta_report={"status": "Passed"},
            ocr_report={"text_blocks": [], "font_analysis": {"status": "Passed"}, "signature_analysis": {"status": "Passed"}},
            ml_prediction={"prediction": "genuine", "confidence": 0.99},
            ocr_failed=False,
            possible_forgery=res3["possible_forgery"],
            signature_similarity=res3["signature_similarity"]
        )
        print("-> Risk Score output issues:")
        print(json.dumps(risk_output["issues"], indent=4))
        print(f"-> Risk Score: {risk_output['risk_score']}")
        
        # If it is flagged as a forgery, the risk score should incorporate the signature penalty (15 or 30)
        if res3["possible_forgery"]:
            assert any("Possible signature forgery detected" in issue for issue in risk_output["issues"])
            expected_min_penalty = 15 if res3["signature_similarity"] >= 0.55 else 30
            assert risk_output["risk_score"] >= expected_min_penalty
            print("-> Risk penalty correctly assigned to forgery detection!")

        # Verify DB serialization
        print("\n[Test] Verifying database serialization & retrieve...")
        db = SessionLocal()
        try:
            test_doc = models.Document(
                file_name="test_sig.png",
                file_type="PNG",
                file_path="media/uploads/test_sig.png",
                file_hash="test_sig_hash_9876",
                fraud_score=20.0,
                confidence_score=80.0,
                risk_level="Low",
                signature_similarity=res3["signature_similarity"],
                possible_forgery=res3["possible_forgery"]
            )
            
            # Clean up existing test doc
            existing = db.query(models.Document).filter(models.Document.file_hash == "test_sig_hash_9876").first()
            if existing:
                db.delete(existing)
                db.commit()
                
            db.add(test_doc)
            db.commit()
            db.refresh(test_doc)
            
            retrieved = db.query(models.Document).filter(models.Document.id == test_doc.id).first()
            assert retrieved.signature_similarity == res3["signature_similarity"]
            assert retrieved.possible_forgery == res3["possible_forgery"]
            
            db.delete(retrieved)
            db.commit()
            print("-> DB storage & retrieval checked successfully.")
        finally:
            db.close()

    finally:
        # Clean up reference signature to keep workspace clean
        if os.path.exists(ref_sig_file):
            try:
                os.remove(ref_sig_file)
            except Exception:
                pass

    print("\n" + "=" * 75)
    print("      ALL SIGNATURE VERIFICATION TESTS PASSED SUCCESSFULLY!      ")
    print("=" * 75)

if __name__ == "__main__":
    run_test()
