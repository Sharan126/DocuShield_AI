"""
DocuShield AI — Document-Type-Aware Forensic Risk Scoring Engine.

Computes fraud risk scores based on document forensics, AI/ML classification,
graph syndicate analysis, GNN predictions, and document-specific field validation.

The scoring engine adapts its field requirements based on the detected document type,
eliminating false penalties when documents legitimately lack certain fields.
"""

# ─────────────────────────────────────────────────────────────────────────────
# PER-DOCUMENT-TYPE REQUIRED FIELDS
# Each document type defines which extracted fields must be present.
# Missing fields trigger a penalty only if they are expected for that type.
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_FIELDS_BY_TYPE = {
    "BANK_STATEMENT": {
        "fields": ["applicant_name", "account_number"],
        "label": "Bank Statement",
    },
    "SALARY_SLIP": {
        "fields": ["applicant_name", "income"],
        "label": "Salary Slip",
    },
    "AADHAAR": {
        "fields": ["applicant_name", "aadhaar_number"],
        "label": "Aadhaar Card",
    },
    "PAN": {
        "fields": ["applicant_name", "pan_number"],
        "label": "PAN Card",
    },
    "PROPERTY_DOCUMENT": {
        "fields": ["applicant_name", "property_id"],
        "label": "Property Document",
    },
    "LOAN_APPLICATION": {
        "fields": ["applicant_name", "income", "property_id"],
        "label": "Loan Application",
    },
    "ITR": {
        "fields": ["applicant_name", "income"],
        "label": "Income Tax Return",
    },
    "UNKNOWN": {
        "fields": ["applicant_name"],
        "label": "Unknown Document",
    },
}


def _check_extracted_field(extracted_fields: dict, field_name: str) -> bool:
    """Check if an extracted field has a meaningful non-empty value."""
    if not extracted_fields:
        return False

    # Field name aliases — OCR uses "monthly_income", pipeline uses "income"
    FIELD_ALIASES = {
        "income": ["income", "monthly_income"],
        "monthly_income": ["monthly_income", "income"],
    }

    field_names_to_check = FIELD_ALIASES.get(field_name, [field_name])

    for fname in field_names_to_check:
        val = extracted_fields.get(fname)
        if val is None:
            continue

        # Handle dict values (LayoutLM format with value/confidence)
        if isinstance(val, dict):
            val = val.get("value")

        # Check for non-empty
        if isinstance(val, str) and val.strip():
            return True
        if isinstance(val, (int, float)) and val > 0:
            return True

    return False


def calculate_risk_score(
    meta_report: dict,
    ocr_report: dict,
    ml_prediction: dict = None,
    ocr_failed: bool = False,
    missing_fields: bool = False,
    validation_mismatch: bool = False,
    graph_risk_penalty: int = 0,
    graph_reason: str = "",
    possible_forgery: bool = False,
    signature_similarity: float = 1.0,
    gnn_fraud_probability: float = 0.0,
    gnn_risk_level: str = "Low",
    ela_score: float = 0.0,
    compress_report: dict = None,
    quality_report: dict = None,
    document_type: str = "UNKNOWN",
    extracted_fields: dict = None
) -> dict:
    """
    Computes a fraud risk score (0-100) and risk level classification.

    Penalties:
    - AI/ML classifier tampered prediction: up to +35
    - Metadata anomaly: +30
    - OCR extraction failure: +20
    - Missing required fields (document-type-aware): +25
    - Validation mismatch: +25
    - Graph syndicate penalty: up to +30
    - Signature forgery: +30
    - GNN syndicate risk: up to +30
    - ELA discrepancy: up to +25
    - Compression artifacts: +15
    - Image quality warning: +10
    """
    score = 0
    issues = []

    # 0. AI/ML classifier prediction penalty
    if ml_prediction and ml_prediction.get("prediction") == "tampered":
        confidence = ml_prediction.get("confidence", 0.5)
        penalty = int(35 * confidence)
        score += penalty
        issues.append(f"AI/ML classifier flagged the document as tampered (confidence: {confidence * 100:.1f}%).")

    # 1. Metadata anomaly = +30
    is_meta_anomaly = (
        meta_report.get("status") in ["Alert", "Tampered"] or 
        len(meta_report.get("warnings", [])) > 0
    )
    if is_meta_anomaly:
        score += 30
        for warning in meta_report.get("warnings", []):
            issues.append(f"Metadata check: {warning}")
        if not meta_report.get("warnings"):
            issues.append("Metadata anomaly detected (editing software or timestamp alteration flags).")

    # 2. OCR extraction failure = +20
    if ocr_failed:
        score += 20
        issues.append("OCR text extraction failure.")
    else:
        text_blocks = ocr_report.get("text_blocks", [])
        if not text_blocks:
            score += 20
            issues.append("OCR text extraction failure (no text blocks detected).")
            ocr_failed = True

    # 3. Missing required fields = +25 (DOCUMENT-TYPE-AWARE)
    if not ocr_failed:
        type_config = REQUIRED_FIELDS_BY_TYPE.get(document_type, REQUIRED_FIELDS_BY_TYPE["UNKNOWN"])
        required = type_config["fields"]
        type_label = type_config["label"]

        if extracted_fields:
            # Check extracted field values directly
            missing = [f for f in required if not _check_extracted_field(extracted_fields, f)]
            if missing:
                score += 25
                missing_str = ", ".join(missing)
                issues.append(f"Missing required fields for {type_label}: {missing_str}.")
        else:
            # Legacy fallback: no extracted_fields provided
            score += 25
            issues.append(f"Missing required fields (extraction data unavailable for {type_label}).")
    else:
        score += 25
        issues.append("Missing required fields due to OCR failure.")

    # 4. Validation mismatch = +25
    has_font_variance = ocr_report.get("font_analysis", {}).get("status") == "Alert"
    has_sig_anomaly = ocr_report.get("signature_analysis", {}).get("status") == "Alert"
    if has_font_variance or has_sig_anomaly or validation_mismatch:
        score += 25
        issues.append("Validation mismatch or font/signature authenticity layout variance.")

    # 5. Graph syndicate penalty
    if graph_risk_penalty > 0:
        score += graph_risk_penalty
        issues.append(f"Syndicate network alert: {graph_reason}")

    # 6. Signature forgery penalty
    if possible_forgery:
        score += 30
        issues.append(f"Possible signature forgery detected. Signature similarity score of {signature_similarity * 100:.1f}% is below threshold.")

    # 7. GNN syndicate fraud detection penalty
    if gnn_fraud_probability >= 0.5:
        gnn_penalty = int(30 * gnn_fraud_probability)
        score += gnn_penalty
        issues.append(f"GNN Graph Convolutional Network flagged high syndicate fraud risk: {gnn_fraud_probability * 100:.1f}% probability ({gnn_risk_level} risk level).")

    # 8. ELA score = up to +25
    if ela_score > 35.0:
        added = min(int((ela_score - 35) * 0.5) + 10, 25)
        score += added
        issues.append(f"Error Level Analysis (ELA) discrepancy detected (Score: {ela_score}%).")

    # 9. Compression warnings = +15
    if compress_report and compress_report.get("status") == "Alert":
        score += 15
        for warning in compress_report.get("warnings", []):
            issues.append(f"Compression check: {warning}")

    # 10. Image quality warnings = +10
    if quality_report and quality_report.get("status") == "Alert":
        score += 10
        for warning in quality_report.get("warnings", []):
            issues.append(f"Image quality check: {warning}")

    # Bound risk score between 0 and 100
    score = min(max(score, 0), 100)

    # Risk level classification
    if score <= 35:
        risk_level = "Low"
    elif score <= 65:
        risk_level = "Medium"
    else:
        risk_level = "High"

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "issues": issues
    }
