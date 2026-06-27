import sys
import os
import json

# Ensure backend directory is in path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Import PyTorch first to prevent DLL loading WinError 127
try:
    import torch
except ImportError:
    pass

from app.services import neo4j_service, risk_score, ocr
from app.database import SessionLocal, Base, engine, run_db_migrations
from app import models

def run_test():
    print("=" * 75)
    print("      DOCUSHIELD AI - NEO4J & FRAUD MAPPING INTEGRATION TEST      ")
    print("=" * 75)

    # 1. Run migrations to ensure layoutlm_intelligence column exists
    print("[Test 1/5] Initializing Database Schema...")
    Base.metadata.create_all(bind=engine)
    run_db_migrations()
    print("-> Schema initialized.")

    # 2. Verify Neo4j connection initialization
    print("\n[Test 2/5] Checking Neo4j connection status...")
    connector = neo4j_service.Neo4jConnector.get_instance()
    print(f"-> Connected to Neo4j database: {connector.connected}")
    if not connector.connected:
        print(f"   (Connection bypassed/failed: {connector.error_msg})")
        print("   -> Bypassing live connection, running under local SQLite dynamic graph fallback.")

    db = SessionLocal()
    try:
        # Clear existing test documents to start fresh
        db.query(models.Document).filter(models.Document.file_hash.like("test_neo4j_%")).delete(synchronize_session=False)
        db.commit()

        # 3. Insert Document 1 (Ramesh Kumar - Salary slip, phone = 9876543210, property = 45 Residency Rd)
        print("\n[Test 3/5] Uploading and processing Document 1 (Ramesh)...")
        fields1 = {
            "applicant_name": "RAMESH KUMAR",
            "address": "45 Residency Road, Bangalore - 560025",
            "property_id": "PROP-RES-45",
            "income": 145000.0,
            "document_type": "SALARY_SLIP"
        }
        text1 = "CANARA BANK SALARY SLIP\nAccount Holder: Ramesh Kumar\nMonthly Income: INR 1,45,000\nPhone: 9876543210\nProperty ID: PROP-RES-45"
        
        phone1 = neo4j_service.extract_phone_numbers(text1)
        
        # Calculate risk score
        risk1 = risk_score.calculate_risk_score(
            meta_report={"status": "Passed"},
            ocr_report={"text_blocks": [{"text": text1}], "font_analysis": {"status": "Passed"}, "signature_analysis": {"status": "Passed"}},
            ml_prediction={"prediction": "genuine", "confidence": 0.99},
            ocr_failed=False
        )
        
        doc1 = models.Document(
            file_name="Ramesh_SalarySlip.png",
            file_type="PNG",
            file_path="media/uploads/Ramesh_SalarySlip.png",
            file_hash="test_neo4j_hash_1",
            fraud_score=float(risk1["risk_score"]),
            confidence_score=95.0,
            risk_level=risk1["risk_level"],
            extracted_text=text1,
            document_id="test_neo4j_uuid_1",
            layoutlm_intelligence=json.dumps({
                "applicant_name": {"value": fields1["applicant_name"], "confidence": 0.95},
                "address": {"value": fields1["address"], "confidence": 0.90},
                "property_id": {"value": fields1["property_id"], "confidence": 0.92},
                "income": {"value": fields1["income"], "confidence": 0.88},
                "document_type": {"value": fields1["document_type"], "confidence": 0.98}
            })
        )
        db.add(doc1)
        db.commit()
        db.refresh(doc1)
        
        # Sync to graph
        neo4j_service.add_document_nodes_and_relationships(doc1, fields1, phone1)
        print("-> Document 1 added and synced to Graph.")

        # 4. Insert Document 2 (Sunita Kumar - Shares PROPERTY with Ramesh)
        print("\n[Test 4/5] Uploading and processing Document 2 (Sunita - Collateral Shared)...")
        text2 = "CANARA BANK SALARY SLIP\nEmployee: Sunita Kumar\nMonthly Income: INR 8,45,000\nProperty Address: 45 Residency Road, Bangalore - 560025\nProperty ID: PROP-RES-45\nPhone: 9112223334"
        phone2 = neo4j_service.extract_phone_numbers(text2)
        
        # Evaluate graph syndicate risk penalty
        graph_penalty, graph_reason = neo4j_service.calculate_graph_risk_for_document(
            "test_neo4j_uuid_2", "SUNITA KUMAR", "45 Residency Road, Bangalore - 560025", phone2, db,
            property_id="PROP-RES-45"
        )
        
        print(f"-> Checked syndicate database overlap. Penalty: +{graph_penalty}")
        print(f"   Reason: {graph_reason}")
        
        assert graph_penalty in [30, 45] # Shared collateral property matches Ramesh (and may trigger multi-app if DB is seeded)
        print("-> Collateral Fraud Syndicate detection verified successfully!")

        risk2 = risk_score.calculate_risk_score(
            meta_report={"status": "Passed"},
            ocr_report={"text_blocks": [{"text": text2}], "font_analysis": {"status": "Passed"}, "signature_analysis": {"status": "Passed"}},
            ml_prediction={"prediction": "genuine", "confidence": 0.99},
            ocr_failed=False,
            graph_risk_penalty=graph_penalty,
            graph_reason=graph_reason
        )
        
        doc2 = models.Document(
            file_name="Sunita_SalarySlip.png",
            file_type="PNG",
            file_path="media/uploads/Sunita_SalarySlip.png",
            file_hash="test_neo4j_hash_2",
            fraud_score=float(risk2["risk_score"]),
            confidence_score=95.0,
            risk_level=risk2["risk_level"],
            extracted_text=text2,
            layoutlm_intelligence=json.dumps({
                "applicant_name": {"value": "SUNITA KUMAR", "confidence": 0.95},
                "address": {"value": "45 Residency Road, Bangalore - 560025", "confidence": 0.90},
                "property_id": {"value": "PROP-RES-45", "confidence": 0.92},
                "income": {"value": 845000.0, "confidence": 0.88},
                "document_type": {"value": "SALARY_SLIP", "confidence": 0.98}
            })
        )
        db.add(doc2)
        db.commit()
        db.refresh(doc2)
        
        # Sync to graph
        neo4j_service.add_document_nodes_and_relationships(doc2, {
            "applicant_name": "SUNITA KUMAR",
            "address": "45 Residency Road, Bangalore - 560025",
            "property_id": "PROP-RES-45",
            "income": 845000.0,
            "document_type": "SALARY_SLIP"
        }, phone2)
        print("-> Document 2 added and synced to Graph.")

        # 5. Retrieve entire graph network and verify elements
        print("\n[Test 5/5] Retrieving dynamic Fraud Ring Graph Network...")
        graph_data = neo4j_service.get_graph_network(db)
        
        print("\n[Test] Dynamic Graph Network Nodes:")
        print(json.dumps(graph_data["nodes"], indent=4))
        
        print("\n[Test] Dynamic Graph Network Edges (Relationships):")
        print(json.dumps(graph_data["links"], indent=4))
        
        print("\n[Test] Generated Syndicate Alerts:")
        print(json.dumps(graph_data["fraud_alerts"], indent=4))
        
        # Verify node types exist
        node_types = [n["type"] for n in graph_data["nodes"]]
        assert "Applicant" in node_types
        assert "Property" in node_types
        assert "Phone" in node_types
        assert "Loan" in node_types # standard SQLite Document nodes are mapped as Loan type for frontend
        print("-> All node classification types successfully validated.")
        
        # Verify alert generated for shared collateral
        shared_prop_alert = any("sharing the exact same property collateral" in a for a in graph_data["fraud_alerts"])
        assert shared_prop_alert
        print("-> Shared collateral fraud alert successfully generated.")

        # Clean up database records
        db.query(models.Document).filter(models.Document.file_hash.like("test_neo4j_%")).delete(synchronize_session=False)
        db.commit()
        print("\n" + "=" * 75)
        print("      ALL NEO4J MAPPING INTEGRATION TESTS PASSED SUCCESSFULLY!      ")
        print("=" * 75)
    except Exception as e:
        db.rollback()
        print(f"\n-> Verification FAILED: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
