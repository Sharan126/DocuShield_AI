import os
import re
import json
import logging
# Optional/lazy GNN imports
torch_available = False
nn_Module = object
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torch_geometric.data import Data
    from torch_geometric.nn import GCNConv
    torch_available = True
    nn_Module = nn.Module
except ImportError:
    pass

from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger("docushield.gnn")

class FraudGCN(nn_Module):
    """
    Graph Convolutional Network (GCN) for dynamic fraud ring classification.
    Takes 5-dimensional node features:
      - 4-dim one-hot node type encoding (Applicant, Property, Phone, Document)
      - 1-dim base fraud/risk score (normalized [0, 1])
    Outputs a single fraud probability score.
    """
    def __init__(self, in_channels=5, hidden_channels=16, out_channels=1):
        super().__init__()
        self.conv1 = GCNConv(in_channels, hidden_channels)
        self.conv2 = GCNConv(hidden_channels, out_channels)

    def forward(self, x, edge_index):
        # Layer 1
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=0.2, training=self.training)
        # Layer 2
        x = self.conv2(x, edge_index)
        return torch.sigmoid(x)

def build_pyg_data(graph_data: dict):
    if not torch_available:
        return None, {}
    """
    Converts graph nodes and relationships dictionary from Neo4j (or SQLite fallback)
    into a PyTorch Geometric Data object.
    
    Generates dynamic labels (y):
      - 1.0 (fraud) if the Document node is connected to an Applicant sharing
        property collateral or phone number contact with another independent applicant.
      - 0.0 (clean) otherwise.
    """
    nodes = graph_data.get("nodes", [])
    links = graph_data.get("links", [])
    
    if not nodes:
        # Fallback for empty graph
        x = torch.empty((0, 5), dtype=torch.float)
        edge_index = torch.empty((2, 0), dtype=torch.long)
        y = torch.empty((0, 1), dtype=torch.float)
        mask = torch.empty((0,), dtype=torch.bool)
        return Data(x=x, edge_index=edge_index, y=y, train_mask=mask), {}

    # 1. Map Node IDs to contiguous indexes
    node_id_to_idx = {node["id"]: idx for idx, node in enumerate(nodes)}
    
    # Identify applicant IDs
    app_ids = {node["id"] for node in nodes if node["type"] in ["Applicant", "Co-applicant"]}
    
    # 2. Map Property and Phone connections to identify sharing across independent applicants
    shared_counts = {}
    for link in links:
        src = link["source"]
        tgt = link["target"]
        rel = link["relation"]
        
        if rel in ["OWNS", "USES_PHONE"]:
            app = src if src in app_ids else (tgt if tgt in app_ids else None)
            entity = tgt if src in app_ids else (src if tgt in app_ids else None)
            
            if app and entity:
                if entity not in shared_counts:
                    shared_counts[entity] = set()
                shared_counts[entity].add(app)
                
    # Shared properties/phones have > 1 unique applicant linked
    shared_entities = {entity for entity, apps in shared_counts.items() if len(apps) > 1}
    
    # Applicants connected to shared nodes are part of a suspected fraud cluster
    fraud_applicants = set()
    for entity in shared_entities:
        fraud_applicants.update(shared_counts[entity])
        
    x_list = []
    y_list = []
    doc_mask = []
    
    for idx, node in enumerate(nodes):
        node_id = node["id"]
        ntype = node["type"]
        
        # A. One-hot node type (4 dims)
        type_features = [0.0, 0.0, 0.0, 0.0]
        if ntype in ["Applicant", "Co-applicant"]:
            type_features[0] = 1.0
        elif ntype == "Property":
            type_features[1] = 1.0
        elif ntype == "Phone":
            type_features[2] = 1.0
        elif ntype in ["Loan", "Document"]:
            type_features[3] = 1.0
            
        # B. Base risk/fraud score (1 dim)
        risk = 0.0
        if ntype in ["Loan", "Document"]:
            # Parse risk score from the details label
            details = node.get("details", "")
            match = re.search(r"Risk.*?(\d+(?:\.\d+)?)%", details)
            if match:
                risk = float(match.group(1)) / 100.0
                
        node_features = type_features + [risk]
        x_list.append(node_features)
        
        # C. Target Label (1.0 for shared collateral/phone document node, 0.0 for clean)
        is_fraud = 0.0
        is_doc = ntype in ["Loan", "Document"]
        doc_mask.append(is_doc)
        
        if is_doc:
            # Locate applicant linked to this document node
            app_for_doc = None
            for link in links:
                if link["relation"] == "SUBMITTED" and link["target"] == node_id:
                    app_for_doc = link["source"]
                    break
            if app_for_doc in fraud_applicants:
                is_fraud = 1.0
                
        y_list.append(is_fraud)
        
    x = torch.tensor(x_list, dtype=torch.float)
    y = torch.tensor(y_list, dtype=torch.float).unsqueeze(1)
    mask = torch.tensor(doc_mask, dtype=torch.bool)
    
    # 3. Build edge_index tensor (COO format, undirected)
    edge_index_list = []
    for link in links:
        src_idx = node_id_to_idx.get(link["source"])
        tgt_idx = node_id_to_idx.get(link["target"])
        if src_idx is not None and tgt_idx is not None:
            edge_index_list.append([src_idx, tgt_idx])
            edge_index_list.append([tgt_idx, src_idx])
            
    if len(edge_index_list) > 0:
        edge_index = torch.tensor(edge_index_list, dtype=torch.long).t().contiguous()
    else:
        edge_index = torch.empty((2, 0), dtype=torch.long)
        
    data = Data(x=x, edge_index=edge_index, y=y)
    data.train_mask = mask
    return data, node_id_to_idx

def train_gnn_model(db: Session, epochs: int = 150) -> dict:
    if not torch_available:
        logger.warning("GNN model training bypassed: PyTorch/PyG libraries not installed.")
        return {
            "final_loss": 0.0,
            "epochs_trained": 0,
            "num_nodes": 0,
            "num_edges": 0,
            "predictions": [],
            "targets": [],
            "error": "PyTorch/PyG libraries not installed"
        }
    """
    Builds the graph from Neo4j/SQLite, trains the GCN model on synthetic fraud labels,
    saves the weights to models/gnn_model.pth, and returns training metrics.
    """
    # Fix random seeds for determinism
    torch.manual_seed(0)
    import numpy as np
    np.random.seed(0)

    from app.services import neo4j_service
    graph_data = neo4j_service.get_graph_network(db)
    
    data, _ = build_pyg_data(graph_data)
    
    model = FraudGCN(in_channels=5, hidden_channels=16, out_channels=1)
    
    # Defensive check: if no graph is loaded or no document nodes exist to train
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.abspath(os.path.join(current_dir, "..", "..", "models", "gnn_model.pth"))
    
    if data.num_nodes == 0 or data.train_mask.sum().item() == 0:
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        torch.save(model.state_dict(), model_path)
        logger.info("Empty database graph. Saved default initialized GNN weights.")
        return {
            "final_loss": 0.0,
            "epochs_trained": 0,
            "num_nodes": data.num_nodes,
            "num_edges": data.num_edges,
            "predictions": [],
            "targets": []
        }

    optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)
    criterion = nn.BCELoss()
    
    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        out = model(data.x, data.edge_index)
        loss = criterion(out[data.train_mask], data.y[data.train_mask])
        loss.backward()
        optimizer.step()
        
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    torch.save(model.state_dict(), model_path)
    logger.info(f"GNN model trained and saved to {model_path}.")
    
    model.eval()
    with torch.no_grad():
        out = model(data.x, data.edge_index)
        final_loss = criterion(out[data.train_mask], data.y[data.train_mask]).item()
        predictions = out[data.train_mask].squeeze(-1).tolist()
        targets = data.y[data.train_mask].squeeze(-1).tolist()
        
    return {
        "final_loss": round(final_loss, 6),
        "epochs_trained": epochs,
        "num_nodes": data.num_nodes,
        "num_edges": data.num_edges,
        "predictions": [round(p, 4) for p in predictions],
        "targets": targets
    }

def predict_graph_risk(
    doc_id: str = None,
    applicant_name: str = None,
    address: str = None,
    phone_numbers: list = None,
    db: Session = None
) -> dict:
    """
    Predicts graph-based fraud probability using the trained GCN model.
    Runs dynamically on upload checks (pre-upload) by enriching the graph with transient nodes,
    or queries existing document nodes by doc_id.
    """
    if db is None:
        from app.database import SessionLocal
        db = SessionLocal()
        close_db = True
    else:
        close_db = False
        
    try:
        if not torch_available:
            logger.warning("GNN graph risk prediction bypassed: PyTorch/PyG libraries not installed.")
            return {
                "gnn_fraud_probability": 0.0,
                "risk_level": "Low"
            }
        
        from app.services import neo4j_service
        graph_data = neo4j_service.get_graph_network(db)
        
        target_node_id = None
        if doc_id:
            for node in graph_data["nodes"]:
                if node["id"] == doc_id or node.get("label") == doc_id:
                    target_node_id = node["id"]
                    break
                    
        # If running pre-upload check or doc node not found, dynamically enrich graph representation
        if target_node_id is None and applicant_name:
            target_node_id = "new_doc"
            
            # Locate or create applicant node
            app_node_id = None
            for node in graph_data["nodes"]:
                if node["type"] in ["Applicant", "Co-applicant"] and node["label"] == applicant_name.upper():
                    app_node_id = node["id"]
                    break
            if app_node_id is None:
                app_node_id = "A_new"
                graph_data["nodes"].append({
                    "id": app_node_id,
                    "label": applicant_name.upper(),
                    "type": "Applicant",
                    "status": "Clean",
                    "details": "Transient underwriting applicant"
                })
                
            # Add document node
            graph_data["nodes"].append({
                "id": target_node_id,
                "label": "Transient Document",
                "type": "Loan",
                "status": "Clean",
                "details": "Transient Document for pre-commit verification"
            })
            
            # SUBMITTED edge
            graph_data["links"].append({
                "source": app_node_id,
                "target": target_node_id,
                "relation": "SUBMITTED"
            })
            
            # Link Property
            if address:
                prop_node_id = None
                for node in graph_data["nodes"]:
                    if node["type"] == "Property" and address.lower() in node.get("details", "").lower():
                        prop_node_id = node["id"]
                        break
                if prop_node_id is None:
                    prop_node_id = "P_new"
                    graph_data["nodes"].append({
                        "id": prop_node_id,
                        "label": address[:22],
                        "type": "Property",
                        "status": "Clean",
                        "details": f"Collateral Address: {address}"
                    })
                graph_data["links"].append({
                    "source": app_node_id,
                    "target": prop_node_id,
                    "relation": "OWNS"
                })
                
            # Link Phones
            if phone_numbers:
                for ph in phone_numbers:
                    if len(ph) >= 10:
                        phone_node_id = None
                        for node in graph_data["nodes"]:
                            if node["type"] == "Phone" and ph in node["label"]:
                                phone_node_id = node["id"]
                                break
                        if phone_node_id is None:
                            phone_node_id = f"PH_new_{ph}"
                            graph_data["nodes"].append({
                                "id": phone_node_id,
                                "label": ph,
                                "type": "Phone",
                                "status": "Clean",
                                "details": "Transient phone number"
                            })
                        graph_data["links"].append({
                            "source": app_node_id,
                            "target": phone_node_id,
                            "relation": "USES_PHONE"
                        })

        if not graph_data["nodes"]:
            return {"gnn_fraud_probability": 0.0, "risk_level": "Low"}
            
        data, node_id_to_idx = build_pyg_data(graph_data)
        
        # Load GNN Model
        model = FraudGCN(in_channels=5, hidden_channels=16, out_channels=1)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.abspath(os.path.join(current_dir, "..", "..", "models", "gnn_model.pth"))
        if os.path.exists(model_path):
            try:
                model.load_state_dict(torch.load(model_path, weights_only=True))
            except Exception as load_err:
                logger.warning(f"Failed to load GNN weights: {load_err}.")
        else:
            logger.warning(f"GNN weights not found at {model_path}.")
            
        model.eval()
        with torch.no_grad():
            out = model(data.x, data.edge_index)
            
        prob = 0.0
        if target_node_id in node_id_to_idx:
            idx = node_id_to_idx[target_node_id]
            prob = float(out[idx].item())
        else:
            # Fallback average document predictions
            doc_indices = [idx for node_id, idx in node_id_to_idx.items() if node_id.startswith("D")]
            if doc_indices:
                prob = float(out[doc_indices].mean().item())
            else:
                prob = 0.0
                
        if prob <= 0.35:
            risk_level = "Low"
        elif prob <= 0.65:
            risk_level = "Medium"
        else:
            risk_level = "High"
            
        return {
            "gnn_fraud_probability": round(prob, 4),
            "risk_level": risk_level
        }
        
    except Exception as e:
        logger.error(f"Error in GNN prediction: {e}")
        return {"gnn_fraud_probability": 0.0, "risk_level": "Low", "error": str(e)}
    finally:
        if close_db:
            db.close()
