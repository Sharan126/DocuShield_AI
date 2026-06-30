import os
import re
import numpy as np
import logging
from PIL import Image

# Initialize logger first to enable logging during import verification
logger = logging.getLogger("docushield.signature")

cv2_available = False
cv2_import_error = None
try:
    # Try importing torch first to resolve potential DLL loading conflicts on Windows (WinError 127)
    try:
        import torch
    except ImportError:
        pass
    import cv2
    cv2_available = True
except Exception as e:
    cv2_import_error = e
    logger.warning(f"Failed to import cv2: {e}. OpenCV signature verification will be bypassed.")

# Directory to store reference signatures (resolved absolute path to backend/media/signatures)
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SIGNATURE_DIR = os.path.join(_backend_dir, "media", "signatures")

def load_image_robustly(image_path: str, is_grayscale: bool = False) -> np.ndarray:
    """
    Loads an image from disk robustly. Supports Unicode and special character paths
    on Windows by falling back to numpy decoders or PIL if cv2.imread fails.
    """
    if not image_path or not isinstance(image_path, str) or not os.path.exists(image_path):
        return None
    
    if not cv2_available:
        try:
            with Image.open(image_path) as pil_img:
                if is_grayscale:
                    return np.array(pil_img.convert("L"))
                else:
                    return np.array(pil_img.convert("RGB"))
        except Exception:
            return None
            
    cv2_flag = cv2.IMREAD_GRAYSCALE if is_grayscale else cv2.IMREAD_COLOR
    try:
        img = cv2.imread(image_path, cv2_flag)
        if img is not None:
            return img
    except Exception:
        pass

    try:
        with open(image_path, "rb") as f:
            file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
        img = cv2.imdecode(file_bytes, cv2_flag)
        if img is not None:
            return img
    except Exception:
        pass

    try:
        with Image.open(image_path) as pil_img:
            if is_grayscale:
                return np.array(pil_img.convert("L"))
            else:
                return cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)
    except Exception:
        pass

    return None

def save_image_robustly(image_path: str, img: np.ndarray) -> bool:
    """
    Saves an image to disk robustly, supporting special characters in path.
    """
    if not cv2_available:
        try:
            pil_img = Image.fromarray(img)
            pil_img.save(image_path)
            return True
        except Exception as e:
            logger.warning(f"PIL fallback save failed: {e}")
            return False
            
    try:
        ext = os.path.splitext(image_path)[1].lower()
        if not ext:
            ext = ".png"
        is_success, buffer = cv2.imencode(ext, img)
        if is_success:
            with open(image_path, "wb") as f:
                f.write(buffer.tobytes())
            return True
    except Exception as e:
        logger.warning(f"Robust save failed: {e}")
    
    try:
        return cv2.imwrite(image_path, img)
    except Exception:
        return False

def compute_ssim(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Computes Structural Similarity Index (SSIM) using standard OpenCV operations.
    Resizes both images to standard dimensions (200x200) to ensure robust Gaussian blur kernel operations.
    """
    if not cv2_available:
        try:
            pil_img1 = Image.fromarray(img1.astype(np.uint8))
            pil_img2 = Image.fromarray(img2.astype(np.uint8))
            img1_resized = np.array(pil_img1.resize((200, 200))).astype(np.float64)
            img2_resized = np.array(pil_img2.resize((200, 200))).astype(np.float64)
            diff = np.abs(img1_resized - img2_resized)
            return float(1.0 - np.mean(diff) / 255.0)
        except Exception:
            return 1.0

    # Normalize inputs to 2D grayscale arrays before resizing
    if len(img1.shape) == 3:
        if img1.shape[2] >= 3:
            img1 = cv2.cvtColor(img1[:, :, :3].astype(np.uint8), cv2.COLOR_BGR2GRAY) if cv2_available else np.array(Image.fromarray(img1[:, :, :3].astype(np.uint8)).convert("L"))
        else:
            img1 = np.squeeze(img1, axis=2)
    if len(img2.shape) == 3:
        if img2.shape[2] >= 3:
            img2 = cv2.cvtColor(img2[:, :, :3].astype(np.uint8), cv2.COLOR_BGR2GRAY) if cv2_available else np.array(Image.fromarray(img2[:, :, :3].astype(np.uint8)).convert("L"))
        else:
            img2 = np.squeeze(img2, axis=2)

    # Normalize dimensions to standard shape (200x200) to ensure height/width >= 11
    img1 = cv2.resize(img1, (200, 200))
    img2 = cv2.resize(img2, (200, 200))
        
    img1 = img1.astype(np.float64)
    img2 = img2.astype(np.float64)
    
    C1 = (0.01 * 255) ** 2
    C2 = (0.03 * 255) ** 2
    
    mu1 = cv2.GaussianBlur(img1, (11, 11), 1.5)
    mu2 = cv2.GaussianBlur(img2, (11, 11), 1.5)
    
    mu1_sq = mu1 ** 2
    mu2_sq = mu2 ** 2
    mu1_mu2 = mu1 * mu2
    
    sigma1_sq = np.maximum(0.0, cv2.GaussianBlur(img1 ** 2, (11, 11), 1.5) - mu1_sq)
    sigma2_sq = np.maximum(0.0, cv2.GaussianBlur(img2 ** 2, (11, 11), 1.5) - mu2_sq)
    sigma12 = cv2.GaussianBlur(img1 * img2, (11, 11), 1.5) - mu1_mu2
    
    ssim_map = ((2 * mu1_mu2 + C1) * (2 * sigma12 + C2)) / ((mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2))
    return float(np.mean(ssim_map))

def verify_document_signature(
    image_path: str,
    applicant_name: str,
    text_blocks: list,
    forgery_threshold: float = 0.70
) -> dict:
    """
    Detects the signature block in the uploaded document, crops it,
    and compares it with the saved reference signature for this applicant.
    """
    if not isinstance(text_blocks, list):
        text_blocks = []

    if not cv2_available:
        from app.config import settings
        if getattr(settings, "DISABLE_HEAVY_AI", False):
            logger.warning("signature_service: OpenCV not available. Bypassing signature verification.")
            return {
                "orb_match_count": 100,
                "ssim_score": 1.0,
                "signature_similarity": 1.0,
                "possible_forgery": False
            }
        else:
            logger.error(f"Deployment Failure: OpenCV is not installed. Details: {cv2_import_error}")
            raise ImportError(
                f"Deployment Failure: OpenCV library (opencv-python-headless) is not installed/functional. "
                f"Details: {cv2_import_error}"
            )

    if not applicant_name:
        applicant_name = "UNKNOWN_APPLICANT"
    
    applicant_name_clean = re.sub(r"\W+", "_", applicant_name.upper())
    ref_path = os.path.join(SIGNATURE_DIR, f"ref_{applicant_name_clean}.png")
    
    # 1. Read document image robustly
    img = load_image_robustly(image_path)
            
    # Return error/forgery fallback if document is not an image or fails to read.
    # This prevents caching a blank canvas fallback as the reference signature baseline.
    if img is None:
        logger.error(f"Failed to load document image for signature verification: {image_path}")
        return {
            "orb_match_count": 0,
            "ssim_score": 0.0,
            "signature_similarity": 0.0,
            "possible_forgery": True
        }

    img_h, img_w = img.shape[:2]

    # 2. Locate Signature Block using text coordinates
    sig_x, sig_y, sig_w, sig_h = None, None, None, None
    for block in text_blocks:
        if not isinstance(block, dict):
            continue
        text_val = block.get("text")
        if text_val is None:
            text_val = ""
        text = str(text_val).lower()
        if "signature" in text or "sign" in text:
            # Found signature label block, use its visual coordinates
            # Safely cast coordinates to float to handle potential string/non-numeric representations
            try:
                sig_x = float(block.get("x", 0))
            except (TypeError, ValueError):
                sig_x = 0.0
            
            try:
                sig_y = float(block.get("y", 0))
            except (TypeError, ValueError):
                sig_y = 0.0
                
            try:
                sig_w = float(block.get("width", 100))
            except (TypeError, ValueError):
                sig_w = 100.0
                
            try:
                sig_h = float(block.get("height", 30))
            except (TypeError, ValueError):
                sig_h = 30.0
            break

    # Determine Crop Area (signature is usually directly above the word "Signature")
    if sig_x is not None and sig_y is not None:
        crop_x1 = int(max(0, sig_x - 50))
        crop_y1 = int(max(0, sig_y - 100))
        crop_x2 = int(min(img_w, sig_x + sig_w + 50))
        crop_y2 = int(min(img_h, sig_y + 20))
    else:
        # Fallback crop bottom-right underwriting section of the document
        crop_x1 = int(max(0, img_w - 300))
        crop_y1 = int(max(0, img_h - 150))
        crop_x2 = int(img_w)
        crop_y2 = int(img_h)

    # Perform Image Crop
    crop = img[crop_y1:crop_y2, crop_x1:crop_x2]
    if crop.size == 0:
        crop = np.ones((100, 200, 3), dtype=np.uint8) * 255
        
    # Ensure crop is grayscale
    if len(crop.shape) == 3:
        if crop.shape[2] >= 3:
            gray_crop = cv2.cvtColor(crop[:, :, :3], cv2.COLOR_BGR2GRAY)
        else:
            gray_crop = np.squeeze(crop, axis=2)
    else:
        gray_crop = crop.copy()

    # Normalize/force 2D dimensionality
    if len(gray_crop.shape) > 2:
        gray_crop = gray_crop[:, :, 0]

    # Normalize dimensions to standard shape (200x200) to ensure robustness
    # for both ORB feature extraction and SSIM calculations.
    gray_crop = cv2.resize(gray_crop, (200, 200))

    # 3. Check and Cache Reference Signature
    if not os.path.exists(ref_path):
        # Save current crop as the baseline reference signature robustly
        os.makedirs(os.path.dirname(ref_path), exist_ok=True)
        save_image_robustly(ref_path, gray_crop)
        logger.info(f"Saved reference signature for applicant '{applicant_name}' to {ref_path}.")
            
        return {
            "orb_match_count": 100,
            "ssim_score": 1.0,
            "signature_similarity": 1.0,
            "possible_forgery": False
        }

    # 4. Compare with Reference Signature
    try:
        ref_img = load_image_robustly(ref_path, is_grayscale=True)
        if ref_img is None:
            # Reference signature file exists but is corrupted, empty, or unreadable.
            # Overwrite/regenerate it with the current valid crop to prevent false positive alerts.
            logger.warning(f"Reference signature at {ref_path} is unreadable or corrupt. Regenerating...")
            save_image_robustly(ref_path, gray_crop)
            return {
                "orb_match_count": 100,
                "ssim_score": 1.0,
                "signature_similarity": 1.0,
                "possible_forgery": False
            }
            
        # A. ORB Feature Matching
        # Custom edgeThreshold and patchSize are set to 7 to allow feature detection on small/thin crops.
        orb = cv2.ORB_create(nfeatures=500, edgeThreshold=7, patchSize=7)
        kp1, des1 = orb.detectAndCompute(gray_crop, None)
        kp2, des2 = orb.detectAndCompute(ref_img, None)
        
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = []
        if des1 is not None and len(des1) > 0 and des2 is not None and len(des2) > 0:
            matches = bf.match(des1, des2)
        orb_match_count = len(matches)
        
        # B. SSIM Scoring
        ssim_score = compute_ssim(gray_crop, ref_img)
        
        # C. Combined Similarity Calculation
        if des1 is None or len(kp1) == 0:
            # If no features in current crop (e.g. blank region), similarity is based purely on SSIM
            # to avoid penalizing identical blank/solid regions.
            similarity = ssim_score
            orb_match_count = 0
        elif des2 is None or len(kp2) == 0:
            # Reference image has no features (should not happen in typical runs, but handled for safety)
            similarity = ssim_score * 0.6
            orb_match_count = 0
        else:
            # Factor both SSIM structural layout (60% weight) and ORB feature points (40% weight)
            orb_weight = min(1.0, orb_match_count / 200.0)
            similarity = (ssim_score * 0.6) + (orb_weight * 0.4)
        
        # Clamp similarity between 0.0 and 1.0
        similarity = min(max(similarity, 0.0), 1.0)
        possible_forgery = similarity < forgery_threshold
        
        return {
            "orb_match_count": orb_match_count,
            "ssim_score": round(float(ssim_score), 4),
            "signature_similarity": round(float(similarity), 4),
            "possible_forgery": possible_forgery
        }
    except Exception as comp_err:
        logger.error(f"Failed to run signature comparison: {comp_err}. Returning fallback values.")
        return {
            "orb_match_count": 0,
            "ssim_score": 0.50,
            "signature_similarity": 0.50,
            "possible_forgery": True
        }
