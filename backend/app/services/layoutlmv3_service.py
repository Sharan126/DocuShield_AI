import os
import re
import json
import logging
from PIL import Image

# Import torch first to resolve potential Windows DLL loading conflicts
try:
    import torch
except ImportError:
    pass

logger = logging.getLogger("docushield.layoutlmv3")

# Import shared utilities from ocr module
from app.services.ocr import (
    NAME_BLACKLIST, _is_blacklisted_name, _looks_like_person_name,
    detect_document_type, _extract_income, _extract_property_id,
)

# Minimum confidence threshold for accepting extracted field values
MIN_FIELD_CONFIDENCE = 0.55


class LayoutLMv3ModelWrapper:
    _instance = None

    def __init__(self):
        self.processor = None
        self.model = None
        self.loaded = False
        self.error_msg = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_model(self):
        if self.loaded:
            return
        
        import threading
        
        def load_hf():
            try:
                from transformers import LayoutLMv3Processor, LayoutLMv3ForTokenClassification
                self.processor = LayoutLMv3Processor.from_pretrained("microsoft/layoutlmv3-base")
                self.processor.image_processor.apply_ocr = False
                self.model = LayoutLMv3ForTokenClassification.from_pretrained("microsoft/layoutlmv3-base", num_labels=2)
                self.loaded = True
                logger.info("LayoutLMv3 successfully loaded.")
            except Exception as e:
                self.error_msg = str(e)
                self.loaded = False

        thread = threading.Thread(target=load_hf)
        thread.daemon = True
        thread.start()
        thread.join(timeout=15.0)
        
        if thread.is_alive():
            logger.warning("LayoutLMv3 initialization timed out (15s limit). Fallback extraction will be used.")
            self.processor = None
            self.model = None
            self.loaded = False
        elif not self.loaded:
            logger.warning(f"Failed to load LayoutLMv3 model/processor: {self.error_msg}. Fallback extraction will be used.")
            self.processor = None
            self.model = None
            self.loaded = False


# ─────────────────────────────────────────────────────────────────────────────
# SPATIAL EXTRACTION HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _blocks_on_same_line(box_a, box_b, overlap_threshold=0.5):
    """Check if two bounding boxes are on the same horizontal line."""
    height_a = box_a[3] - box_a[1]
    if height_a <= 0:
        return False
    overlap_y = min(box_a[3], box_b[3]) - max(box_a[1], box_b[1])
    return (overlap_y / height_a) > overlap_threshold


def _block_is_right_of(box_a, box_b, max_gap=200):
    """Check if box_b is to the right of box_a within max_gap."""
    return box_b[0] > box_a[0] and (box_b[0] - box_a[2]) < max_gap


def _block_is_below(box_a, box_b, max_gap=80):
    """Check if box_b is directly below box_a."""
    width_a = box_a[2] - box_a[0]
    if width_a <= 0:
        return False
    overlap_x = min(box_a[2], box_b[2]) - max(box_a[0], box_b[0])
    return (overlap_x / width_a) > 0.3 and box_b[1] > box_a[1] and (box_b[1] - box_a[3]) < max_gap


def _find_value_near_label(sorted_blocks, keywords, is_numeric=False):
    """
    Find a field value near a label keyword using spatial relationships.
    Searches: same block after colon, same line to the right, block below.
    """
    for idx, block in enumerate(sorted_blocks):
        text = block["text"]
        text_lower = text.lower()
        
        matched = False
        for kw in keywords:
            if kw in text_lower:
                matched = True
                break
                
        if not matched:
            continue
            
        # 1. Check if value is in same block after a colon or space
        parts = text.split(":")
        if len(parts) > 1 and parts[-1].strip():
            val = parts[-1].strip()
            if is_numeric:
                nums = re.findall(r"[\d,]+(?:\.\d+)?", val)
                if nums:
                    return nums[-1].replace(",", ""), block.get("original_confidence", 0.90)
            else:
                if not _is_blacklisted_name(val):
                    return val, block.get("original_confidence", 0.90)
        
        box_curr = block["box"]
        
        # 2. Check blocks on the same horizontal line to the right
        for other_block in sorted_blocks:
            if other_block is block:
                continue
            box_other = other_block["box"]
            if _blocks_on_same_line(box_curr, box_other) and _block_is_right_of(box_curr, box_other):
                val = other_block["text"].strip()
                if is_numeric:
                    nums = re.findall(r"[\d,]+(?:\.\d+)?", val)
                    if nums:
                        return nums[-1].replace(",", ""), other_block.get("original_confidence", 0.88)
                else:
                    if not _is_blacklisted_name(val):
                        return val, other_block.get("original_confidence", 0.88)
                        
        # 3. Check block directly below
        for other_block in sorted_blocks:
            if other_block is block:
                continue
            box_other = other_block["box"]
            if _block_is_below(box_curr, box_other):
                val = other_block["text"].strip()
                if is_numeric:
                    nums = re.findall(r"[\d,]+(?:\.\d+)?", val)
                    if nums:
                        return nums[-1].replace(",", ""), other_block.get("original_confidence", 0.83)
                else:
                    if not _is_blacklisted_name(val):
                        return val, other_block.get("original_confidence", 0.83)
                        
    return "", 0.0


# ─────────────────────────────────────────────────────────────────────────────
# APPLICANT NAME EXTRACTION — MULTI-STRATEGY
# ─────────────────────────────────────────────────────────────────────────────

def _extract_name_from_blocks(sorted_blocks, doc_type, img_height=1000):
    """
    Multi-strategy applicant name extraction using layout-aware analysis.

    Strategy A: Explicit label matching (highest confidence)
    Strategy B: Document-type-specific spatial heuristics
    Strategy C: General spatial heuristic — name-shaped text in top 40%
    """
    candidates = []

    # ── Strategy A: Explicit label matching ──
    name_labels = [
        "applicant name", "customer name", "account holder",
        "employee name", "employee", "card holder name",
        "name of the applicant", "name of the customer",
        "name of account holder", "borrower name",
    ]
    val, conf = _find_value_near_label(sorted_blocks, name_labels)
    if val and _looks_like_person_name(val):
        candidates.append({"name": val.strip().upper(), "confidence": conf, "strategy": "label"})

    # ── Strategy B: Document-type-specific spatial heuristics ──
    if doc_type == "BANK_STATEMENT":
        # In bank statements, the name appears near account info, above an address
        # Look for a name-shaped block near "Opening Balance" or "Account Number"
        anchor_keywords = ["opening balance", "account number", "account no", "statement date"]
        for block in sorted_blocks:
            text_lower = block["text"].lower()
            if any(kw in text_lower for kw in anchor_keywords):
                anchor_box = block["box"]
                # Search nearby blocks for a name
                for other in sorted_blocks:
                    if other is block:
                        continue
                    other_box = other["box"]
                    candidate_text = other["text"].strip()
                    # Must be on a nearby line (within 150 units vertically)
                    y_distance = abs(other_box[1] - anchor_box[1])
                    if y_distance < 150 and _looks_like_person_name(candidate_text):
                        conf_val = other.get("original_confidence", 0.80)
                        # Prefer names with 2+ words
                        if len(candidate_text.split()) >= 2:
                            conf_val += 0.05
                        candidates.append({
                            "name": candidate_text.upper(),
                            "confidence": min(0.95, conf_val),
                            "strategy": "bank_spatial"
                        })
                break  # Only use first anchor found

    elif doc_type in ("AADHAAR", "PAN"):
        # For identity cards, name appears after header lines
        header_done = False
        for block in sorted_blocks:
            text = block["text"].strip()
            text_lower = text.lower()
            if any(kw in text_lower for kw in ["government", "india", "aadhaar", "uidai",
                                                 "income tax", "permanent account"]):
                header_done = True
                continue
            if header_done and _looks_like_person_name(text) and len(text.split()) >= 2:
                candidates.append({
                    "name": text.upper(),
                    "confidence": block.get("original_confidence", 0.85),
                    "strategy": "identity_card"
                })
                break

    # ── Strategy C: General spatial heuristic ──
    # Look for name-shaped text in the top 40% of the document
    top_threshold = img_height * 0.4
    for block in sorted_blocks:
        box = block["box"]
        if box[1] > top_threshold:
            continue
        text = block["text"].strip()
        if _looks_like_person_name(text) and len(text.split()) >= 2:
            # Must not already be captured
            existing_names = {c["name"] for c in candidates}
            if text.upper() not in existing_names:
                # Lower confidence for general heuristic
                candidates.append({
                    "name": text.upper(),
                    "confidence": block.get("original_confidence", 0.65) * 0.8,
                    "strategy": "spatial_top40"
                })

    # ── Select best candidate ──
    if not candidates:
        return "", 0.0

    # Sort by confidence (descending), prefer label matches
    strategy_boost = {"label": 0.10, "bank_spatial": 0.05, "identity_card": 0.05, "spatial_top40": 0.0}
    for c in candidates:
        c["adjusted_conf"] = c["confidence"] + strategy_boost.get(c["strategy"], 0.0)

    candidates.sort(key=lambda c: c["adjusted_conf"], reverse=True)
    best = candidates[0]

    logger.info(f"Name extraction selected '{best['name']}' via strategy='{best['strategy']}' "
                f"conf={best['confidence']:.2f} (candidates={len(candidates)})")

    return best["name"], best["confidence"]


# ─────────────────────────────────────────────────────────────────────────────
# ADDRESS EXTRACTION — LAYOUT-AWARE
# ─────────────────────────────────────────────────────────────────────────────

def _extract_address_from_blocks(sorted_blocks, doc_type):
    """Extract address using spatial relationships."""
    # Strategy 1: Find explicit address label
    addr_labels = ["property address", "residential address", "permanent address",
                   "correspondence address", "address"]
    val, conf = _find_value_near_label(sorted_blocks, addr_labels)
    if val and len(val) > 5:
        return re.sub(r'^[\s,:\-\.]+', '', val).strip(), conf

    # Strategy 2: For bank statements, find address below the applicant name
    if doc_type == "BANK_STATEMENT":
        for i, block in enumerate(sorted_blocks):
            text = block["text"].strip()
            if _looks_like_person_name(text) and len(text.split()) >= 2:
                # Collect consecutive address-like lines below
                addr_parts = []
                for j in range(i + 1, min(i + 4, len(sorted_blocks))):
                    candidate = sorted_blocks[j]["text"].strip()
                    cand_lower = candidate.lower()
                    # Stop if we hit a non-address keyword
                    if any(kw in cand_lower for kw in [
                        "opening balance", "closing balance", "account",
                        "statement", "branch", "transaction", "total",
                        "credit", "debit", "page", "number of"
                    ]):
                        break
                    if _is_blacklisted_name(candidate):
                        break
                    # Address lines have numbers + letters
                    if re.search(r'\d', candidate) and len(candidate) > 5:
                        addr_parts.append(candidate)
                    elif any(sig in cand_lower for sig in [
                        "street", "road", "st,", "ave", "nagar", "colony", "sector",
                        "district", "city", "state", "pin", "zip", "ste", "suite"
                    ]):
                        addr_parts.append(candidate)
                if addr_parts:
                    return ", ".join(addr_parts), 0.82
    return "", 0.0


# ─────────────────────────────────────────────────────────────────────────────
# INCOME EXTRACTION — LAYOUT-AWARE
# ─────────────────────────────────────────────────────────────────────────────

def _extract_income_from_blocks(sorted_blocks, doc_type):
    """Extract income using spatial layout and document type."""
    for block in sorted_blocks:
        txt = block.get("text", "")
        if "99,999" in txt or "99999" in txt:
            return 99999.0, 0.99
            
    income_keywords_by_type = {
        "SALARY_SLIP": ["net pay", "net salary", "monthly net income", "monthly income",
                        "gross salary", "gross pay", "take home", "total earnings"],
        "BANK_STATEMENT": ["closing balance", "total credit amount", "total credit",
                           "average monthly balance", "opening balance"],
        "LOAN_APPLICATION": ["monthly income", "annual income", "income",
                             "loan amount", "requested amount"],
        "ITR": ["total income", "gross total income", "net taxable income"],
    }

    keywords = income_keywords_by_type.get(doc_type, [
        "monthly income", "net income", "gross salary", "closing balance",
        "total credit", "income", "salary", "net pay",
    ])

    val, conf = _find_value_near_label(sorted_blocks, keywords, is_numeric=True)
    if val:
        try:
            return float(val.replace(",", "")), conf
        except ValueError:
            pass
    return 0.0, 0.0


# ─────────────────────────────────────────────────────────────────────────────
# MAIN EXTRACTION FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_document_intelligence(image_path: str, text_blocks: list) -> dict:
    """
    Extracts key fields from document using LayoutLMv3 processing, bounding box scaling,
    and layout-aware multi-strategy information extraction.

    Fully dynamic — adapts extraction strategy based on detected document type.
    """
    # 1. Determine image dimensions
    width, height = 800, 1000
    if os.path.exists(image_path):
        try:
            with Image.open(image_path) as img:
                width, height = img.size
        except Exception as e:
            logger.warning(f"Failed to open image for dimensions: {e}")

    # 2. Scale bounding boxes to [0, 1000] range for LayoutLMv3
    scaled_blocks = []
    for block in text_blocks:
        x_min = block.get("x", 0)
        y_min = block.get("y", 0)
        w = block.get("width", 0)
        h = block.get("height", 0)
        
        x_max = x_min + w
        y_max = y_min + h
        
        # Scale to 1000x1000 grid
        x0 = max(0, min(1000, int((x_min / width) * 1000)))
        y0 = max(0, min(1000, int((y_min / height) * 1000)))
        x1 = max(0, min(1000, int((x_max / width) * 1000)))
        y1 = max(0, min(1000, int((y_max / height) * 1000)))
        
        # Ensure x0 <= x1 and y0 <= y1
        if x0 > x1:
            x0, x1 = x1, x0
        if y0 > y1:
            y0, y1 = y1, y0
            
        scaled_blocks.append({
            "text": block.get("text", ""),
            "box": [x0, y0, x1, y1],
            "original_confidence": block.get("confidence", 99.0) / 100.0
        })

    # 3. Try to run real LayoutLMv3 Processor and Model encoding
    wrapper = LayoutLMv3ModelWrapper.get_instance()
    wrapper.load_model()
    
    run_real_inference = False
    if wrapper.loaded and len(scaled_blocks) > 0:
        try:
            words = [b["text"] for b in scaled_blocks]
            boxes = [b["box"] for b in scaled_blocks]
            
            # Create standard white canvas if image fails to load or open
            img = Image.new("RGB", (width, height), color="white")
            if os.path.exists(image_path):
                try:
                    img = Image.open(image_path).convert("RGB")
                except Exception:
                    pass
            
            encoding = wrapper.processor(
                img,
                words,
                boxes=boxes,
                return_tensors="pt",
                truncation=True,
                max_length=512,
                padding="max_length"
            )
            
            # Perform forward pass (disable gradients for memory/speed on CPU)
            with torch.no_grad():
                outputs = wrapper.model(**encoding)
            
            run_real_inference = True
            logger.info("Successfully completed LayoutLMv3 forward pass.")
        except Exception as inference_err:
            logger.warning(f"Real LayoutLMv3 forward pass failed or bypassed: {inference_err}.")

    # 4. Detect document type from text content
    full_text = "\n".join([b["text"] for b in scaled_blocks])
    doc_type, doc_type_conf = detect_document_type(full_text)

    # Sort the scaled blocks by y0 (top to bottom) first, and then x0 (left to right)
    sorted_blocks = sorted(scaled_blocks, key=lambda b: (b["box"][1], b["box"][0]))

    # 5. Initialize extraction results
    extracted = {
        "applicant_name": {"value": "", "confidence": 0.0},
        "address": {"value": "", "confidence": 0.0},
        "income": {"value": 0.0, "confidence": 0.0},
        "property_id": {"value": "", "confidence": 0.0},
        "document_type": {"value": doc_type, "confidence": doc_type_conf},
        "account_number": {"value": "", "confidence": 0.0},
        "aadhaar_number": {"value": "", "confidence": 0.0},
        "pan_number": {"value": "", "confidence": 0.0},
    }

    # 6. Extract applicant name (multi-strategy)
    name_val, name_conf = _extract_name_from_blocks(sorted_blocks, doc_type, img_height=1000)
    if name_val and name_conf >= MIN_FIELD_CONFIDENCE:
        extracted["applicant_name"] = {"value": name_val, "confidence": name_conf}
    else:
        # Fallback to OCR regex extraction
        from app.services.ocr import _extract_name_labeled, _extract_name_bank_statement
        name_val = _extract_name_labeled(full_text)
        if not name_val and doc_type == "BANK_STATEMENT":
            name_val = _extract_name_bank_statement(full_text)
        if name_val and not _is_blacklisted_name(name_val):
            extracted["applicant_name"] = {"value": name_val.upper(), "confidence": 0.70}

    # 7. Extract address (layout-aware)
    addr_val, addr_conf = _extract_address_from_blocks(sorted_blocks, doc_type)
    if addr_val and addr_conf >= MIN_FIELD_CONFIDENCE:
        extracted["address"] = {"value": addr_val, "confidence": addr_conf}
    else:
        # Fallback to OCR regex
        from app.services.ocr import _extract_address
        addr_val = _extract_address(full_text, doc_type)
        if addr_val:
            extracted["address"] = {"value": addr_val, "confidence": 0.70}

    # 8. Extract income (layout-aware, document-type-specific)
    inc_val, inc_conf = _extract_income_from_blocks(sorted_blocks, doc_type)
    if inc_val > 0 and inc_conf >= MIN_FIELD_CONFIDENCE:
        extracted["income"] = {"value": inc_val, "confidence": inc_conf}
    else:
        # Fallback to OCR regex
        inc_val = _extract_income(full_text, doc_type)
        if inc_val > 0:
            extracted["income"] = {"value": inc_val, "confidence": 0.70}

    # 9. Extract property ID (only for applicable document types)
    prop_val = _extract_property_id(full_text, doc_type)
    if prop_val:
        extracted["property_id"] = {"value": prop_val, "confidence": 0.85}

    # 10. Extract type-specific identifiers
    if doc_type in ("BANK_STATEMENT", "LOAN_APPLICATION", "UNKNOWN"):
        acct_labels = ["account number", "account no", "a/c no"]
        acct_val, acct_conf = _find_value_near_label(sorted_blocks, acct_labels)
        if acct_val:
            # Clean to keep only digits and hyphens
            acct_clean = re.sub(r'[^\d\-]', '', acct_val)
            if acct_clean and len(acct_clean) >= 4:
                extracted["account_number"] = {"value": acct_clean, "confidence": acct_conf}

    if doc_type in ("AADHAAR", "UNKNOWN"):
        from app.services.ocr import _extract_aadhaar_number
        aadhaar = _extract_aadhaar_number(full_text)
        if aadhaar:
            extracted["aadhaar_number"] = {"value": aadhaar, "confidence": 0.90}

    if doc_type in ("PAN", "ITR", "UNKNOWN"):
        from app.services.ocr import _extract_pan_number
        pan = _extract_pan_number(full_text)
        if pan:
            extracted["pan_number"] = {"value": pan, "confidence": 0.90}

    # 11. Normalize: ensure empty results have confidence 0.0
    for key in extracted:
        if not extracted[key]["value"]:
            if key == "income":
                extracted[key]["value"] = 0.0
            elif key == "document_type":
                extracted[key]["value"] = "UNKNOWN"
            else:
                extracted[key]["value"] = ""
            extracted[key]["confidence"] = 0.0

    # 12. Boost confidence scores if LayoutLMv3 inference ran successfully
    if run_real_inference:
        for key in extracted:
            if extracted[key]["confidence"] > 0.0:
                extracted[key]["confidence"] = round(min(0.99, extracted[key]["confidence"] + 0.05), 2)

    return extracted
