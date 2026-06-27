"""
DocuShield AI — End-to-End Extraction Pipeline Verification Script.

Tests the complete document intelligence pipeline across multiple document types
using real uploaded documents and synthetic test cases.

Does NOT modify any production code or database records.
"""
import os
import sys
import json

backend_dir = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, backend_dir)

# Import torch first to avoid DLL issues
import torch

from app.database import SessionLocal
from app import models
from app.services import ocr, risk_score, neo4j_service
from app.services import layoutlmv3_service
from app.services.ocr import detect_document_type, _is_blacklisted_name

SEPARATOR = "=" * 78
SUBSEP = "-" * 60


def print_section(title):
    print(f"\n{SEPARATOR}")
    print(f"  {title}")
    print(SEPARATOR)


def print_field(label, value, expected=None):
    status = ""
    if expected is not None:
        if isinstance(expected, str):
            status = " [OK]" if value == expected else f" [FAIL] (expected: {expected})"
        elif isinstance(expected, (list, tuple)):
            status = " [OK]" if value in expected else f" [FAIL] (expected one of: {expected})"
        elif callable(expected):
            status = " [OK]" if expected(value) else " [FAIL] (failed check)"
    print(f"  {label:<30}: {repr(value)}{status}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 1: REAL UPLOADED DOCUMENTS
# ─────────────────────────────────────────────────────────────────────────────

def test_real_documents(db):
    """Test extraction on real uploaded documents in the database."""
    print_section("TEST 1: REAL UPLOADED DOCUMENTS")

    results = []

    for doc_id in [6, 7]:
        doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
        if not doc:
            print(f"\n  [SKIP] Document id={doc_id} not found in database.")
            continue

        print(f"\n  --- Document id={doc.id} | file={doc.file_name} ---")
        text = doc.extracted_text or ""

        # 1. Document type detection
        doc_type, doc_type_conf = detect_document_type(text)
        print_field("Detected document type", doc_type)
        print_field("Document type confidence", doc_type_conf)

        # 2. OCR field extraction
        ocr_fields = ocr.extract_fields_from_text(text, doc_type=doc_type)
        print_field("OCR applicant_name", ocr_fields["applicant_name"])
        print_field("OCR address", ocr_fields["address"])
        print_field("OCR income", ocr_fields["monthly_income"])
        print_field("OCR property_id", ocr_fields["property_id"])
        print_field("OCR account_number", ocr_fields.get("account_number", ""))

        # 3. LayoutLM extraction (if text_blocks available)
        layoutlm_result = None
        if doc.file_path and os.path.exists(doc.file_path):
            # Re-run OCR to get text_blocks
            try:
                ocr_report = ocr.analyze_ocr_layout(doc.file_path)
                text_blocks = ocr_report.get("text_blocks", [])
                if text_blocks:
                    layoutlm_result = layoutlmv3_service.extract_document_intelligence(
                        doc.file_path, text_blocks
                    )
            except Exception as e:
                print(f"  [LayoutLM] Skipped: {e}")

        if layoutlm_result:
            print(f"\n  LayoutLM Results:")
            for key, val in layoutlm_result.items():
                print_field(f"  LM {key}", f"{val['value']} (conf={val['confidence']:.2f})")

        # 4. Blacklist validation
        name = ocr_fields["applicant_name"]
        is_blocked = _is_blacklisted_name(name)
        print_field("Name is blacklisted", is_blocked,
                    expected=False)  # Should not be blacklisted

        # 5. Risk score (document-type-aware)
        risk_result = risk_score.calculate_risk_score(
            meta_report={"status": "Passed"},
            ocr_report={"text_blocks": [{"text": text}],
                        "font_analysis": {"status": "Passed"},
                        "signature_analysis": {"status": "Passed"}},
            ml_prediction={"prediction": "genuine", "confidence": 0.5},
            ocr_failed=False,
            document_type=doc_type,
            extracted_fields=ocr_fields
        )
        print_field("Risk score", risk_result["risk_score"])
        print_field("Risk level", risk_result["risk_level"])
        print(f"  Issues:")
        for issue in risk_result["issues"]:
            print(f"    - {issue}")

        # 6. Graph risk check
        penalty, reason = neo4j_service.calculate_graph_risk_for_document(
            doc_id=doc.document_id or "",
            applicant_name=name,
            address=ocr_fields["address"],
            phone_numbers=[],
            db=db,
            property_id=ocr_fields["property_id"]
        )
        print_field("Graph penalty", penalty)
        print_field("Graph reason", reason)

        results.append({
            "doc_id": doc.id,
            "file_name": doc.file_name,
            "doc_type": doc_type,
            "doc_type_conf": doc_type_conf,
            "applicant_name": name,
            "address": ocr_fields["address"],
            "income": ocr_fields["monthly_income"],
            "property_id": ocr_fields["property_id"],
            "name_blacklisted": is_blocked,
            "risk_score": risk_result["risk_score"],
            "risk_level": risk_result["risk_level"],
            "issues": risk_result["issues"],
            "graph_penalty": penalty,
        })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# TEST 2: SYNTHETIC DOCUMENT TYPES
# ─────────────────────────────────────────────────────────────────────────────

SYNTHETIC_DOCS = {
    "SALARY_SLIP": {
        "text": """CANARA BANK
SALARY SLIP - JUNE 2026
Employee Name: Priya Sharma
Employee ID: EMP-4521
Designation: Senior Analyst
Department: Risk Management
Basic Pay: INR 45,000
House Rent Allowance: INR 18,000
Conveyance Allowance: INR 5,000
Gross Salary: INR 68,000
Provident Fund: INR 5,400
Professional Tax: INR 200
Total Deductions: INR 5,600
Net Salary: INR 62,400""",
        "expected_name": "PRIYA SHARMA",
        "expected_income_min": 45000,
        "expected_property_id": "",
    },

    "BANK_STATEMENT": {
        "text": """231 Valley Farms Street
STATEMENT OF ACCOUNT
FIRST
Santa Monica, CA 90403
CITIZENS
firstcitizensbank@domain.com
BANK
Account Number:
111-234-567-890
Statement Date:
06/15/2026
Page 1 of 1
06/01/2026 to
Period Covered:
06/15/2026
John Smith
Opening Balance:
175,800.00
2450 Courage St, STE 108
Total Credit Amount:
510,000.00
Brownsville, TX 78521
Total Debit Amount:
94,000.00
Closing Balance:
591,800.00
Account Type:
Current Account
Number of Transactions:
8
Transactions
Date
Description
Credit
Debit
Balance""",
        "expected_name": "JOHN SMITH",
        "expected_income_min": 175000,
        "expected_property_id": "",
    },

    "AADHAAR": {
        "text": """Government of India
Unique Identification Authority of India
AADHAAR
Rajesh Kumar Verma
Date of Birth: 15/08/1985
Male
Address: 45 Nehru Nagar, Sector 12
Bangalore - 560025, Karnataka
1234 5678 9012""",
        "expected_name": "RAJESH KUMAR VERMA",
        "expected_income_min": 0,
        "expected_property_id": "",
    },

    "PAN": {
        "text": """INCOME TAX DEPARTMENT
GOVERNMENT OF INDIA
Permanent Account Number Card
Name: Anita Desai
Father's Name: Ramesh Desai
Date of Birth: 22/03/1990
ABCDE1234F
Signature""",
        "expected_name": "ANITA DESAI",
        "expected_income_min": 0,
        "expected_property_id": "",
    },

    "PROPERTY_DOCUMENT": {
        "text": """OFFICE OF THE SUB REGISTRAR
SALE DEED
Registration Number: SRO-2026-45678
This Sale Deed is executed on 10th June 2026
Seller: Mohan Lal Properties Pvt Ltd
Buyer: Applicant Name: Vikram Singh
Property Address: Plot No. 45, Green Valley Layout, Whitefield, Bangalore - 560066
Survey Number: SY-123/4A
Property ID: PROP-GVL-045
Stamp Duty Paid: INR 3,50,000
Total Sale Consideration: INR 75,00,000
Schedule of Property:
East: Road 40 feet wide
West: Plot No. 44
North: Park
South: Plot No. 46""",
        "expected_name": "VIKRAM SINGH",
        "expected_income_min": 0,
        "expected_property_id": "PROP-GVL-045",
    },

    "LOAN_APPLICATION": {
        "text": """CANARA BANK
LOAN APPLICATION FORM
Applicant Name: Deepak Mehta
Co-Applicant: Sunita Mehta
Property Address: 78, Indiranagar, Bangalore - 560038
Property ID: PROP-IND-078
Monthly Income: INR 2,50,000
Loan Amount Requested: INR 1,00,00,000
Tenure: 20 Years
Rate of Interest: 8.5% p.a.
Processing Fee: INR 25,000
EMI: INR 86,782""",
        "expected_name": "DEEPAK MEHTA",
        "expected_income_min": 200000,
        "expected_property_id": "PROP-IND-078",
    },
}


def test_synthetic_documents():
    """Test extraction on synthetic documents for each supported type."""
    print_section("TEST 2: SYNTHETIC DOCUMENT TYPE EXTRACTION")

    results = []
    passed = 0
    failed = 0

    for doc_type_name, config in SYNTHETIC_DOCS.items():
        text = config["text"]
        expected_name = config["expected_name"]
        expected_income_min = config["expected_income_min"]
        expected_prop = config["expected_property_id"]

        print(f"\n  --- {doc_type_name} ---")

        # 1. Document type detection
        detected_type, conf = detect_document_type(text)
        type_ok = detected_type == doc_type_name
        print_field("Detected type", detected_type, expected=doc_type_name)
        print_field("Confidence", conf)

        # 2. Field extraction
        fields = ocr.extract_fields_from_text(text, doc_type=detected_type)
        name = fields["applicant_name"]
        income = fields["monthly_income"]
        prop_id = fields["property_id"]
        address = fields["address"]

        name_ok = name == expected_name
        income_ok = income >= expected_income_min
        prop_ok = prop_id == expected_prop

        print_field("Applicant name", name, expected=expected_name)
        print_field("Income", income, expected=lambda v: v >= expected_income_min)
        print_field("Property ID", prop_id, expected=expected_prop)
        print_field("Address", address)

        # 3. Blacklist check
        is_blocked = _is_blacklisted_name(name) if name else True
        blacklist_ok = not is_blocked if expected_name else True
        print_field("Name blacklisted", is_blocked, expected=False if expected_name else None)

        # 4. Risk score (document-type-aware)
        risk_result = risk_score.calculate_risk_score(
            meta_report={"status": "Passed"},
            ocr_report={"text_blocks": [{"text": text}],
                        "font_analysis": {"status": "Passed"},
                        "signature_analysis": {"status": "Passed"}},
            ml_prediction={"prediction": "genuine", "confidence": 0.5},
            ocr_failed=False,
            document_type=detected_type,
            extracted_fields=fields
        )
        # Check that "Missing required fields" is NOT in issues
        has_false_missing = any("Missing required fields" in i for i in risk_result["issues"])
        print_field("Risk score", risk_result["risk_score"])
        print_field("False missing-field penalty", has_false_missing, expected=False)

        all_ok = type_ok and name_ok and income_ok and prop_ok and blacklist_ok and not has_false_missing
        status = "PASS" if all_ok else "FAIL"
        if all_ok:
            passed += 1
        else:
            failed += 1

        print(f"  >>> {status}")

        results.append({
            "doc_type": doc_type_name,
            "detected_type": detected_type,
            "type_ok": type_ok,
            "name": name,
            "name_ok": name_ok,
            "income": income,
            "income_ok": income_ok,
            "property_id": prop_id,
            "prop_ok": prop_ok,
            "blacklist_ok": blacklist_ok,
            "has_false_missing": has_false_missing,
            "risk_score": risk_result["risk_score"],
            "status": status,
        })

    print(f"\n  Summary: {passed} passed, {failed} failed out of {len(SYNTHETIC_DOCS)} tests")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# TEST 3: BLACKLIST VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

def test_blacklist():
    """Verify that table headers and non-name tokens are correctly blocked."""
    print_section("TEST 3: NAME BLACKLIST VALIDATION")

    should_block = [
        "TRANSACTIONS", "DESCRIPTION", "CREDIT", "DEBIT", "BALANCE",
        "DATE", "STATEMENT OF ACCOUNT", "TOTAL", "SERIAL", "REMARKS",
        "REFERENCE", "ACCOUNT NUMBER", "CANARA BANK", "HDFC BANK",
    ]

    should_pass = [
        "JOHN SMITH", "PRIYA SHARMA", "RAJESH KUMAR VERMA",
        "ANITA DESAI", "VIKRAM SINGH", "DEEPAK MEHTA",
        "RAMESH KUMAR", "SUNITA KUMAR",
    ]

    blocked_ok = 0
    passed_ok = 0
    errors = []

    for name in should_block:
        result = _is_blacklisted_name(name)
        if result:
            blocked_ok += 1
        else:
            errors.append(f"  FAIL: '{name}' should be blocked but was allowed")

    for name in should_pass:
        result = _is_blacklisted_name(name)
        if not result:
            passed_ok += 1
        else:
            errors.append(f"  FAIL: '{name}' should be allowed but was blocked")

    print(f"  Blocked correctly: {blocked_ok}/{len(should_block)}")
    print(f"  Allowed correctly: {passed_ok}/{len(should_pass)}")
    for err in errors:
        print(err)

    total = len(should_block) + len(should_pass)
    total_ok = blocked_ok + passed_ok
    print(f"\n  Summary: {total_ok}/{total} tests passed")
    return total_ok == total


# ─────────────────────────────────────────────────────────────────────────────
# TEST 4: RISK SCORE DOCUMENT-TYPE AWARENESS
# ─────────────────────────────────────────────────────────────────────────────

def test_risk_score_awareness():
    """Verify that risk scores adapt to document type."""
    print_section("TEST 4: DOCUMENT-TYPE-AWARE RISK SCORING")

    tests = [
        {
            "type": "BANK_STATEMENT",
            "fields": {"applicant_name": "JOHN SMITH", "account_number": "111-234-567-890"},
            "expect_missing_penalty": False,
        },
        {
            "type": "SALARY_SLIP",
            "fields": {"applicant_name": "PRIYA SHARMA", "income": 62400},
            "expect_missing_penalty": False,
        },
        {
            "type": "AADHAAR",
            "fields": {"applicant_name": "RAJESH KUMAR", "aadhaar_number": "123456789012"},
            "expect_missing_penalty": False,
        },
        {
            "type": "PAN",
            "fields": {"applicant_name": "ANITA DESAI", "pan_number": "ABCDE1234F"},
            "expect_missing_penalty": False,
        },
        {
            "type": "BANK_STATEMENT",
            "fields": {"applicant_name": "JOHN SMITH"},  # missing account_number
            "expect_missing_penalty": True,
        },
        {
            "type": "UNKNOWN",
            "fields": {"applicant_name": "SOME PERSON"},
            "expect_missing_penalty": False,
        },
    ]

    passed = 0
    for t in tests:
        result = risk_score.calculate_risk_score(
            meta_report={"status": "Passed"},
            ocr_report={"text_blocks": [{"text": "dummy"}],
                        "font_analysis": {"status": "Passed"},
                        "signature_analysis": {"status": "Passed"}},
            ml_prediction={"prediction": "genuine", "confidence": 0.5},
            ocr_failed=False,
            document_type=t["type"],
            extracted_fields=t["fields"]
        )
        has_missing = any("Missing required fields" in i for i in result["issues"])
        ok = has_missing == t["expect_missing_penalty"]
        status = "[OK]" if ok else "[FAIL]"
        if ok:
            passed += 1
        fields_str = ", ".join(f"{k}={v}" for k, v in t["fields"].items())
        print(f"  {status} type={t['type']:<20} fields=[{fields_str}] "
              f"missing_penalty={has_missing} (expected={t['expect_missing_penalty']})")

    print(f"\n  Summary: {passed}/{len(tests)} tests passed")
    return passed == len(tests)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 5: HARDCODED FALLBACK REMOVAL
# ─────────────────────────────────────────────────────────────────────────────

def test_no_hardcoded_fallback():
    """Verify that OCR failure does NOT return hardcoded sample text."""
    print_section("TEST 5: HARDCODED FALLBACK REMOVAL")

    # Simulate OCR on a non-existent file
    result = ocr.analyze_ocr_layout("nonexistent_file_that_does_not_exist.xyz")

    text = result.get("extracted_text", "")
    has_ramesh = "ramesh" in text.lower()
    has_canara = "canara bank loan application" in text.lower()
    ocr_status = result.get("ocr_status", "")

    print_field("Extracted text length", len(text))
    print_field("Contains 'Ramesh Kumar'", has_ramesh, expected=False)
    print_field("Contains hardcoded template", has_canara, expected=False)
    print_field("OCR status", ocr_status)
    print_field("Text blocks count", len(result.get("text_blocks", [])))

    ok = not has_ramesh and not has_canara
    print(f"\n  >>> {'PASS' if ok else 'FAIL'}: Hardcoded fallback {'removed' if ok else 'STILL PRESENT'}")
    return ok


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print(SEPARATOR)
    print("  DOCUSHIELD AI — END-TO-END EXTRACTION PIPELINE VERIFICATION")
    print(SEPARATOR)

    db = SessionLocal()
    all_passed = True

    try:
        # Test 1: Real documents
        real_results = test_real_documents(db)

        # Test 2: Synthetic documents
        synthetic_results = test_synthetic_documents()

        # Test 3: Blacklist
        blacklist_ok = test_blacklist()
        if not blacklist_ok:
            all_passed = False

        # Test 4: Risk score awareness
        risk_ok = test_risk_score_awareness()
        if not risk_ok:
            all_passed = False

        # Test 5: Hardcoded fallback removal
        fallback_ok = test_no_hardcoded_fallback()
        if not fallback_ok:
            all_passed = False

        # Check synthetic results
        synthetic_failures = [r for r in synthetic_results if r["status"] == "FAIL"]
        if synthetic_failures:
            all_passed = False

    finally:
        db.close()

    # Final summary
    print_section("FINAL VERIFICATION SUMMARY")
    print(f"  Test 1 (Real Documents)      : {len(real_results)} documents analyzed")
    print(f"  Test 2 (Synthetic Documents)  : {sum(1 for r in synthetic_results if r['status'] == 'PASS')}/{len(synthetic_results)} passed")
    print(f"  Test 3 (Blacklist Validation) : {'PASS' if blacklist_ok else 'FAIL'}")
    print(f"  Test 4 (Risk Score Awareness) : {'PASS' if risk_ok else 'FAIL'}")
    print(f"  Test 5 (Fallback Removal)     : {'PASS' if fallback_ok else 'FAIL'}")
    print(f"\n  Overall: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    print(SEPARATOR)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
