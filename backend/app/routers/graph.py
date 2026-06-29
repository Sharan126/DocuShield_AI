from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, security
router = APIRouter(prefix="/graph", tags=["graph"])

@router.get("/network")
def get_fraud_graph_network(
    current_user: models.User = Depends(security.RoleChecker(["Admin", "Underwriter"])),
    db: Session = Depends(get_db)
):
    from app.services import neo4j_service
    """
    Returns nodes, edges, and fraud syndicate alerts from Neo4j (or SQLite fallback).
    Includes dynamic GNN-based risk classification summary.
    """
    graph_data = neo4j_service.get_graph_network(db)
    
    try:
        from app.services import gnn_service
        gnn_report = gnn_service.predict_graph_risk(db=db)
        prob = gnn_report.get("gnn_fraud_probability", 0.0)
        risk_lvl = gnn_report.get("risk_level", "Low")
        
        graph_data["gnn_summary"] = {
            "gnn_fraud_probability": prob,
            "risk_level": risk_lvl
        }
        
        if prob >= 0.5:
            # Clear standard compliance message if adding GNN alert
            if "No active fraud rings or shared collateral syndicates detected" in "".join(graph_data.get("fraud_alerts", [])):
                graph_data["fraud_alerts"] = []
            graph_data["fraud_alerts"].append(
                f"GNN Alert: Graph Neural Network flagged a high risk of syndicate fraud ring ({prob * 100:.1f}% probability, {risk_lvl} Risk)."
            )
    except Exception as gnn_err:
        graph_data["gnn_summary"] = {"gnn_fraud_probability": 0.0, "risk_level": "Low", "error": str(gnn_err)}
        
    return graph_data
