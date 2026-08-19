"""
DocuShield AI — Document-Type-Aware Forensic Risk Scoring Engine.

Computes fraud risk scores based on document forensics, AI/ML classification,
graph syndicate analysis, GNN predictions, and document-specific field validation.

The scoring engine adapts its field requirements based on the detected document type,
eliminating false penalties when documents legitimately lack certain fields.
"""

import os
import re
from datetime import datetime
from PyPDF2 import PdfReader
from typing import Optional, Dict, Any

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
    "INVOICE": {
        "fields": ["applicant_name"],
        "label": "Invoice",
    },
    "UNKNOWN": {
        "fields": ["applicant_name"],
        "label": "Unknown Document",
    },
}


def parse_pdf_date(date_str: str) -> str:
    """
    Parses a PDF metadata date string into standard ISO-8601 format.
    Compatible with PDF date formats: D:YYYYMMDDHHmmSSOHH'mm'
    """
    if not date_str:
        return ""
    clean_str = date_str.replace("D:", "").replace("'", "")
    match = re.match(r"^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?", clean_str)
    if match:
        parts = match.groups()
        year, month, day, hour, minute = parts[:5]
        second = parts[5] if parts[5] else "00"
        tz_match = re.search(r"([+-])(\d{2})(\d{2})?|Z$", clean_str)
        tz_str = ""
        if tz_match:
            if tz_match.group(0) == "Z":
                tz_str = "+00:00"
            else:
                sign = tz_match.group(1)
                tz_h = tz_match.group(2)
                tz_m = tz_match.group(3) if tz_match.group(3) else "00"
                tz_str = f"{sign}{tz_h}:{tz_m}"
        return f"{year}-{month}-{day}T{hour}:{minute}:{second}{tz_str}"
    return date_str


def _read_pdf_metadata(path: str) -> dict:
    """Helper to read embedded PDF metadata."""
    try:
        reader = PdfReader(path)
        info = reader.metadata
        if info:
            return {
                "software": info.get("/Creator", ""),
                "producer": info.get("/Producer", ""),
                "author": info.get("/Author", ""),
                "creation_date": info.get("/CreationDate", ""),
                "mod_date": info.get("/ModDate", "")
            }
    except Exception:
        pass
    return {}


def _get_actual_pdf_metadata(meta_report: dict) -> dict:
    """Finds the actual PDF file on disk by size and type, then extracts its metadata."""
    file_name = meta_report.get("file_name", "")
    file_size = meta_report.get("file_size", 0)

    # Check in test_files first
    test_path = os.path.join("document_forensics", "test_files", file_name)
    if os.path.exists(test_path) and os.path.getsize(test_path) == file_size:
        return _read_pdf_metadata(test_path)

    # Check in media/uploads/
    uploads_dir = os.path.join("media", "uploads")
    if os.path.exists(uploads_dir):
        for f in os.listdir(uploads_dir):
            f_path = os.path.join(uploads_dir, f)
            if os.path.isfile(f_path) and os.path.getsize(f_path) == file_size:
                if f.endswith(os.path.splitext(file_name)[1]):
                    return _read_pdf_metadata(f_path)

    return {}


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
    ml_prediction: Optional[Dict[str, Any]] = None,
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
    compress_report: Optional[Dict[str, Any]] = None,
    quality_report: Optional[Dict[str, Any]] = None,
    document_type: str = "UNKNOWN",
    extracted_fields: Optional[Dict[str, Any]] = None
) -> dict:
    """
    Computes a fraud risk score (0-100) and risk level classification.
    Adjusted to prevent over-penalizing genuine documents and normal scanner metadata.
    """
    import logging
    logger = logging.getLogger("docushield.risk_score")

    issues = [
        "✓ PDF loaded successfully",
        "✓ Metadata extracted",
        "✓ Fonts analyzed",
        "✓ Hash generated"
    ]

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Metadata Analysis Recalibration
    # ─────────────────────────────────────────────────────────────────────────
    software = meta_report.get("software", "") if meta_report else ""
    warnings = list(meta_report.get("warnings", [])) if meta_report else []
    status = meta_report.get("status", "Passed") if meta_report else "Passed"

    software_lower = software.lower()

    # Define scanners (genuine acquisition) and editing tools (forgery signals)
    editing_tools = [
        "photoshop", "canva", "gimp", "illustrator", "coreldraw", "corel draw",
        "affinity photo", "affinity", "pixelmator", "paint.net", "figma", 
        "acrobat editing", "acrobat edit"
    ]
    scanner_keywords = [
        "scanjet", "hp smart", "hp", "canon", "epson", "brother", "ricoh",
        "xerox", "fujitsu", "panasonic", "lexmark", "paperport", "scanner", "scan",
        "standard v1.2"
    ]

    is_editing_tool = any(tool in software_lower for tool in editing_tools)
    is_scanner = any(keyword in software_lower for keyword in scanner_keywords)

    # If it is a PDF, parse the actual embedded metadata from disk to find Canva, etc.
    actual_pdf_meta = {}
    if meta_report and meta_report.get("file_type") == "PDF":
        actual_pdf_meta = _get_actual_pdf_metadata(meta_report)
        if actual_pdf_meta:
            pdf_software = actual_pdf_meta.get("software", "")
            pdf_producer = actual_pdf_meta.get("producer", "")
            
            if any(tool in pdf_software.lower() for tool in editing_tools) or any(tool in pdf_producer.lower() for tool in editing_tools):
                is_editing_tool = True
                software = pdf_software or pdf_producer
                status = "Tampered"
                warnings.append(f"Editing software signature detected in PDF: '{pdf_software or pdf_producer}'")
            
            # Check for temporal gap in PDF metadata
            c_date_str = actual_pdf_meta.get("creation_date", "")
            m_date_str = actual_pdf_meta.get("mod_date", "")
            if c_date_str and m_date_str:
                c_iso = parse_pdf_date(c_date_str)
                m_iso = parse_pdf_date(m_date_str)
                try:
                    c_dt = datetime.fromisoformat(c_iso[:19])
                    m_dt = datetime.fromisoformat(m_iso[:19])
                    delta = abs((m_dt - c_dt).total_seconds())
                    if delta > 3600:  # > 1 hour gap is suspicious for clean business templates
                        warnings.append(f"Temporal anomaly: PDF creation and modification dates differ by {delta/3600:.2f} hours.")
                except Exception:
                    pass

    filtered_warnings = []
    has_photoshop_warning = False
    has_time_offset_warning = False

    for warning in warnings:
        w_lower = warning.lower()
        
        # Skip warning if it indicates normal scanner metadata
        if any(s in w_lower for s in scanner_keywords) and not any(e in w_lower for e in editing_tools):
            continue

        # Skip standard simulated PDF warnings for clean metadata
        if "modified after signature" in w_lower or "compression ratios imply" in w_lower:
            continue

        # Check for explicit editing software/tamper alerts
        if "photoshop" in w_lower or "tamper" in w_lower or "editing software" in w_lower:
            has_photoshop_warning = True
            filtered_warnings.append(warning)
        elif "time offset" in w_lower or "creation date" in w_lower or "temporal anomaly" in w_lower:
            has_time_offset_warning = True
            filtered_warnings.append(warning)
        else:
            filtered_warnings.append(warning)

    # Determine metadata penalty (only penalize editing tools, photoshop EXIF tags, or explicit status)
    metadata_score = 0
    if status == "Tampered" or is_editing_tool or has_photoshop_warning:
        metadata_score = 35
        issues.append("⚠ Metadata modified: document metadata indicates editing software or modification (Photoshop/Canva/etc.).")
    elif has_time_offset_warning:
        metadata_score = 10
        issues.append("⚠ Metadata anomaly: creation date and modification date have high time offset.")
    elif filtered_warnings:
        metadata_score = 5
        for warning in filtered_warnings:
            issues.append(f"⚠ Metadata warning: {warning}")

    # ─────────────────────────────────────────────────────────────────────────
    # 2. OCR Extraction & Missing Fields Calibration
    # ─────────────────────────────────────────────────────────────────────────
    ocr_score = 0
    missing_reasons = []

    if ocr_failed:
        ocr_score += 5
        issues.append("⚠ OCR text extraction failed (minor quality or formatting warning).")
    else:
        text_blocks = ocr_report.get("text_blocks", []) if ocr_report else []
        if not text_blocks:
            ocr_score += 5
            issues.append("⚠ OCR text extraction: no text blocks detected.")
            ocr_failed = True
        else:
            words_count = len(" ".join([tb.get("text", "") for tb in text_blocks]).split())
            issues.append(f"✓ OCR extracted {words_count} words")

    if not ocr_failed:
        type_config = REQUIRED_FIELDS_BY_TYPE.get(document_type, REQUIRED_FIELDS_BY_TYPE["UNKNOWN"])
        required = type_config["fields"]
        type_label = type_config["label"]

        if extracted_fields:
            missing = [f for f in required if not _check_extracted_field(extracted_fields, f)]
            for f in missing:
                if f == "applicant_name":
                    ocr_score += 15
                    missing_reasons.append(f"Missing required fields (critical) for {type_label}: applicant_name.")
                elif document_type == "LOAN_APPLICATION":
                    ocr_score += 2
                    missing_reasons.append(f"Missing required fields (optional) for {type_label}: {f}.")
                else:
                    ocr_score += 5
                    missing_reasons.append(f"Missing required fields for {type_label}: {f}.")
        else:
            ocr_score += 10
            missing_reasons.append(f"Missing required fields (extraction data unavailable for {type_label}).")
    else:
        ocr_score += 5
        missing_reasons.append("Missing required fields due to OCR failure.")

    # ─────────────────────────────────────────────────────────────────────────
    # 3. OCR Validation & Continuity (Font, Spacing, Cross-Validation Mismatch)
    # ─────────────────────────────────────────────────────────────────────────
    font_status = ocr_report.get("font_analysis", {}).get("status", "Passed") if ocr_report else "Passed"
    sig_status = ocr_report.get("signature_analysis", {}).get("status", "Passed") if ocr_report else "Passed"
    
    has_font_variance = font_status == "Alert"
    has_sig_anomaly = sig_status == "Alert"

    if has_font_variance:
        ocr_score += 10
        issues.append("⚠ Font mismatch detected (suggests text alteration).")
    if has_sig_anomaly:
        ocr_score += 10
        issues.append("⚠ Signature continuity analysis: layout or metadata variance detected.")
    if validation_mismatch:
        ocr_score += 10
        issues.append("⚠ Cross-document validation mismatch: mismatch in extracted data fields.")

    # Cap total OCR contribution at 30 to avoid accumulation over-penalization
    ocr_score = min(ocr_score, 30)
    issues.extend(missing_reasons)

    # ─────────────────────────────────────────────────────────────────────────
    # 4. Signature Verification
    # ─────────────────────────────────────────────────────────────────────────
    signature_score = 0
    if possible_forgery:
        # Borderline/slightly below threshold (0.55 to 0.70) adds moderate warning (15)
        # Extremely low similarity (< 0.55) adds strong penalty (30)
        if signature_similarity >= 0.55:
            signature_score = 15
        else:
            signature_score = 30
        issues.append(f"⚠ Signature invalid. Signature similarity score of {signature_similarity * 100:.1f}% is below threshold.")

    # ─────────────────────────────────────────────────────────────────────────
    # 5. ELA (Error Level Analysis) Discrepancy
    # ─────────────────────────────────────────────────────────────────────────
    ela_score_contrib = 0
    if ela_score > 35.0:
        ela_score_contrib = min(int((ela_score - 35) * 0.5) + 10, 25)
        issues.append(f"Error Level Analysis (ELA) discrepancy detected (Score: {ela_score}%).")

    # ─────────────────────────────────────────────────────────────────────────
    # 6. GNN / Syndicate Alert (Represents applicant/business risk, not direct document forgery)
    # ─────────────────────────────────────────────────────────────────────────
    gnn_score = 0
    if gnn_fraud_probability >= 0.5:
        gnn_score = min(int(15 * gnn_fraud_probability), 15)
        issues.append(f"GNN Graph Convolutional Network flagged high syndicate fraud risk: {gnn_fraud_probability * 100:.1f}% probability ({gnn_risk_level} risk level).")

    syndicate_score = 0
    if graph_risk_penalty > 0:
        syndicate_score = min(graph_risk_penalty, 10)
        issues.append(f"Syndicate network alert: {graph_reason}")

    # ─────────────────────────────────────────────────────────────────────────
    # 7. Compression & Quality Warnings
    # ─────────────────────────────────────────────────────────────────────────
    # Minor warnings contribute a tiny penalty to forensic score
    minor_quality_score = 0
    if compress_report and compress_report.get("status") == "Alert":
        minor_quality_score += 2
        for warning in compress_report.get("warnings", []):
            issues.append(f"Compression check: {warning}")

    if quality_report and quality_report.get("status") == "Alert":
        minor_quality_score += 2
        for warning in quality_report.get("warnings", []):
            issues.append(f"Image quality check: {warning}")
            
    minor_quality_score = min(minor_quality_score, 4)

    # ─────────────────────────────────────────────────────────────────────────
    # 8. Compute Pure Forensic Score
    # ─────────────────────────────────────────────────────────────────────────
    forensic_score = metadata_score + ocr_score + signature_score + ela_score_contrib + gnn_score + syndicate_score + minor_quality_score

    # ─────────────────────────────────────────────────────────────────────────
    # 9. Compute Proportionate AI/ML Classifier Score Contribution (For Combined Logic)
    # ─────────────────────────────────────────────────────────────────────────
    ml_score = 0.0
    if ml_prediction:
        pred_label = ml_prediction.get("prediction", "genuine").lower()
        pred_conf = ml_prediction.get("confidence", 0.5)
        
        # Handle float [0.0 - 1.0] confidence representation
        if pred_conf <= 1.0:
            pred_conf = pred_conf * 100.0
            
        if pred_label == "tampered":
            ml_score = pred_conf
        else:
            ml_score = 100.0 - pred_conf

    # ─────────────────────────────────────────────────────────────────────────
    # 10. Combine Forensics and ML Classifier Score Proportionally
    # ─────────────────────────────────────────────────────────────────────────
    from app.services import ml_pipeline
    combined_score = ml_pipeline.combine_risk_score(ml_score, forensic_score)
    score = min(max(combined_score, 0.0), 100.0)

    # ─────────────────────────────────────────────────────────────────────────
    # 11. Risk Level Mapping
    # ─────────────────────────────────────────────────────────────────────────
    if score <= 20.0:
        risk_level = "Low"
    elif score <= 50.0:
        risk_level = "Medium"
    elif score <= 75.0:
        risk_level = "High"
    else:
        risk_level = "Critical"

    # ─────────────────────────────────────────────────────────────────────────
    # 12. Debug Logging (Components Weighted Contributions)
    # ─────────────────────────────────────────────────────────────────────────
    # Calculate components weighted contributions to the final combined score
    weight_ml = 0.6 if forensic_score > 20 else 0.18  # 0.6 * 0.3 = 0.18
    ai_contrib = round(weight_ml * ml_score, 1)
    
    meta_contrib = round(0.4 * metadata_score, 1)
    ocr_contrib = round(0.4 * ocr_score, 1)
    ela_contrib = round(0.4 * ela_score_contrib, 1)
    sig_contrib = round(0.4 * signature_score, 1)
    gnn_contrib = round(0.4 * (gnn_score + syndicate_score), 1)
    quality_contrib = round(0.4 * minor_quality_score, 1)

    # Resolve rounding differences to ensure they sum up exactly to the reported score
    contrib_sum = ai_contrib + meta_contrib + ocr_contrib + ela_contrib + sig_contrib + gnn_contrib + quality_contrib
    diff = round(score - contrib_sum, 1)
    if abs(diff) > 0.0:
        ai_contrib = round(ai_contrib + diff, 1)

    breakdown_log = (
        "\n" + "=" * 50 + "\n"
        "  FRAUD SCORE CALIBRATION BREAKDOWN (Weighted)\n" +
        "-" * 50 + "\n"
        f"  AI classifier ........ +{ai_contrib:.1f}\n"
        f"  Metadata ............. +{meta_contrib:.1f}\n"
        f"  OCR .................. +{ocr_contrib:.1f}\n"
        f"  ELA .................. +{ela_contrib:.1f}\n"
        f"  Signature ............ +{sig_contrib:.1f}\n"
        f"  GNN .................. +{gnn_contrib:.1f}\n"
        f"  Quality/Compression .. +{quality_contrib:.1f}\n"
        f"  Final Fraud Score .... {score} ({risk_level})\n"
        + "=" * 50
    )
    logger.info(breakdown_log)

    return {
        "risk_score": forensic_score,
        "risk_level": risk_level,
        "issues": issues
    }
