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

from app.services import gnn_service, risk_score, neo4j_service
from app.database import SessionLocal, Base, engine, run_db_migrations
from app import models
from app.services.sample_data import seed_database

def run_test():
    print("=" * 75)
    print("         DOCUSHIELD AI - GNN FRAUD DETECTION INTEGRATION TEST       ")
    print("=" * 75)

    # 1. Run database migrations to verify GNN columns are created
    print("[Test 1/5] Running DB migrations for GNN columns...")
    Base.metadata.create_all(bind=engine)
    run_db_migrations()
    print("-> Schema verified successfully.")

    # 2. Seed database
    print("\n[Test 2/5] Seeding database with shared collateral fraud records...")
    db = SessionLocal()
    try:
        # Clear existing tables to have a clean slate
        db.query(models.Document).delete()
        db.query(models.AuditLog).delete()
        db.query(models.User).delete()
        db.commit()
        
        # Seed standard database users
        seed_database(db)
        
        # Insert Ramesh and Sunita documents with shared property collateral
        text1 = "CANARA BANK SALARY SLIP\nAccount Holder: Ramesh Kumar\nMonthly Income: INR 1,45,000\nPhone: 9876543210\nProperty ID: PROP-RES-45"
        fields1 = {
            "applicant_name": "RAMESH KUMAR",
            "address": "45 Residency Road, Bangalore - 560025",
            "property_id": "PROP-RES-45",
            "income": 145000.0,
            "document_type": "SALARY_SLIP"
        }
        phone1 = ["9876543210"]
        doc1 = models.Document(
            file_name="Ramesh_SalarySlip.png",
            file_type="PNG",
            file_path="media/uploads/Ramesh_SalarySlip.png",
            file_hash="test_gnn_hash_1",
            fraud_score=25.0,
            confidence_score=95.0,
            risk_level="Low",
            extracted_text=text1,
            document_id="test_gnn_uuid_1",
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
        
        # Sync relationships
        neo4j_service.add_document_nodes_and_relationships(doc1, fields1, phone1)

        text2 = "CANARA BANK SALARY SLIP\nEmployee: Sunita Kumar\nMonthly Income: INR 8,45,000\nProperty Address: 45 Residency Road, Bangalore - 560025\nProperty ID: PROP-RES-45\nPhone: 9112223334"
        fields2 = {
            "applicant_name": "SUNITA KUMAR",
            "address": "45 Residency Road, Bangalore - 560025",
            "property_id": "PROP-RES-45",
            "income": 845000.0,
            "document_type": "SALARY_SLIP"
        }
        phone2 = ["9112223334"]
        
        # Calculate risk score with graph penalty
        graph_penalty, graph_reason = neo4j_service.calculate_graph_risk_for_document(
            "test_gnn_uuid_2", "SUNITA KUMAR", "45 Residency Road, Bangalore - 560025", phone2, db,
            property_id="PROP-RES-45"
        )
        
        doc2 = models.Document(
            file_name="Sunita_SalarySlip.png",
            file_type="PNG",
            file_path="media/uploads/Sunita_SalarySlip.png",
            file_hash="test_gnn_hash_2",
            fraud_score=float(25.0 + graph_penalty),
            confidence_score=95.0,
            risk_level="Critical",
            extracted_text=text2,
            document_id="test_gnn_uuid_2",
            layoutlm_intelligence=json.dumps({
                "applicant_name": {"value": fields2["applicant_name"], "confidence": 0.95},
                "address": {"value": fields2["address"], "confidence": 0.90},
                "property_id": {"value": fields2["property_id"], "confidence": 0.92},
                "income": {"value": fields2["income"], "confidence": 0.88},
                "document_type": {"value": fields2["document_type"], "confidence": 0.98}
            })
        )
        db.add(doc2)
        db.commit()
        
        # Sync relationships
        neo4j_service.add_document_nodes_and_relationships(doc2, fields2, phone2)

        # Document 3 (Anil Verma - Clean negative control node)
        text3 = "CANARA BANK SALARY SLIP\nEmployee: Anil Verma\nMonthly Income: INR 95,000\nProperty Address: 102 Indiranagar, Bangalore - 560038\nProperty ID: PROP-VERMA-102\nPhone: 9999888877"
        fields3 = {
            "applicant_name": "ANIL VERMA",
            "address": "102 Indiranagar, Bangalore - 560038",
            "property_id": "PROP-VERMA-102",
            "income": 95000.0,
            "document_type": "SALARY_SLIP"
        }
        phone3 = ["9999888877"]
        doc3 = models.Document(
            file_name="Anil_SalarySlip.png",
            file_type="PNG",
            file_path="media/uploads/Anil_SalarySlip.png",
            file_hash="test_gnn_hash_3",
            fraud_score=5.0,
            confidence_score=95.0,
            risk_level="Low",
            extracted_text=text3,
            document_id="test_gnn_uuid_3",
            layoutlm_intelligence=json.dumps({
                "applicant_name": {"value": fields3["applicant_name"], "confidence": 0.95},
                "address": {"value": fields3["address"], "confidence": 0.90},
                "property_id": {"value": fields3["property_id"], "confidence": 0.92},
                "income": {"value": fields3["income"], "confidence": 0.88},
                "document_type": {"value": fields3["document_type"], "confidence": 0.98}
            })
        )
        db.add(doc3)
        db.commit()
        
        # Sync relationships
        neo4j_service.add_document_nodes_and_relationships(doc3, fields3, phone3)
        print("-> Seeding completed.")
        
        # 3. Train GNN Model
        print("\n[Test 3/5] Training Graph Neural Network (GCN) node classifier...")
        metrics = gnn_service.train_gnn_model(db, epochs=300)
        print("-> GNN training metrics:")
        print(json.dumps(metrics, indent=4))
        
        # Assert model file is created
        model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "gnn_model.pth"))
        assert os.path.exists(model_path), "GNN model file was not saved!"
        print(f"-> GNN model saved to {model_path} successfully.")

        # 4. Verify inference function predict_graph_risk
        print("\n[Test 4/5] Running GNN predictions on entities...")
        
        # A. Predict risk for Sunita Kumar (shared collateral applicant)
        res_sunita = gnn_service.predict_graph_risk(
            doc_id="test_gnn_uuid_2",
            applicant_name="SUNITA KUMAR",
            address="45 Residency Road, Bangalore - 560025",
            db=db
        )
        print(f"-> GNN risk for SUNITA KUMAR (shared collateral):")
        print(json.dumps(res_sunita, indent=4))
        
        # B. Predict risk for Ramesh Kumar (shared collateral applicant)
        res_ramesh = gnn_service.predict_graph_risk(
            doc_id="test_gnn_uuid_1",
            applicant_name="RAMESH KUMAR",
            address="45 Residency Road, Bangalore - 560025",
            db=db
        )
        print(f"-> GNN risk for RAMESH KUMAR (shared collateral):")
        print(json.dumps(res_ramesh, indent=4))
        
        # C. Predict risk for a clean transient applicant (no shared entities)
        res_clean = gnn_service.predict_graph_risk(
            doc_id="test_gnn_uuid_3",
            applicant_name="ANIL VERMA",
            address="102, Indiranagar, Bangalore - 560038",
            phone_numbers=["9999888877"],
            db=db
        )
        print(f"-> GNN risk for clean transient applicant (ANIL VERMA):")
        print(json.dumps(res_clean, indent=4))
        
        # Assertions
        assert res_sunita["gnn_fraud_probability"] > 0.5, "Sunita GNN risk should be > 0.5"
        assert res_ramesh["gnn_fraud_probability"] > 0.5, "Ramesh GNN risk should be > 0.5"
        assert res_clean["gnn_fraud_probability"] < 0.35, "Clean applicant GNN risk should be < 0.35"
        print("-> Inference predictions successfully validated!")

        # 5. Verify risk_score.py integration
        print("\n[Test 5/5] Checking risk_score.py integration...")
        risk_output = risk_score.calculate_risk_score(
            meta_report={"status": "Passed"},
            ocr_report={"text_blocks": []},
            ml_prediction={"prediction": "genuine", "confidence": 0.9},
            ocr_failed=False,
            gnn_fraud_probability=res_sunita["gnn_fraud_probability"],
            gnn_risk_level=res_sunita["risk_level"]
        )
        print("-> Risk Score Output Issues:")
        print(json.dumps(risk_output["issues"], indent=4))
        print(f"-> Risk Score: {risk_output['risk_score']}")
        
        assert any("GNN Graph Convolutional Network" in issue for issue in risk_output["issues"])
        assert risk_output["risk_score"] > 0
        print("-> GNN risk score integration verified successfully!")

    finally:
        db.close()

    print("\n" + "=" * 75)
    print("          ALL GNN INTEGRATION TESTS PASSED SUCCESSFULLY!            ")
    print("=" * 75)

if __name__ == "__main__":
    run_test()
