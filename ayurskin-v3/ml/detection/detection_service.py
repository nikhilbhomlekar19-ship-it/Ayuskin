"""
Phase 1: Skin Mark / Feature Detection Service
============================================
Uses OpenCV + lightweight CNN heatmap for detecting:
  - Acne spots (red, raised regions)
  - Dark spots / pigmentation (darker patches)
  - Tanning regions (broad tone shift)
  - Moles / marks (small dark circular regions)

Runs on port 5002 (separate from ML classifier on 5001)
"""

import os, io, base64, json, logging
import numpy as np
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────
# DETECTION PIPELINE
# ─────────────────────────────────────────

class SkinMarkDetector:
    """
    Multi-stage OpenCV detection pipeline.
    No external model weights needed — uses classical CV + colour science.
    For each detection type we return:
      { label, bbox:[x,y,w,h], confidence, region_name }
    """

    # ITA (Individual Typology Angle) thresholds for skin tone normalisation
    SKIN_LOWER_HSV = np.array([0,  20,  70], dtype=np.uint8)
    SKIN_UPPER_HSV = np.array([25, 255, 255], dtype=np.uint8)

    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )

    def _load_image(self, img_bytes: bytes) -> np.ndarray:
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image")
        # Resize to standard working resolution
        h, w = img.shape[:2]
        if max(h, w) > 1024:
            scale = 1024 / max(h, w)
            img = cv2.resize(img, (int(w*scale), int(h*scale)))
        return img

    def _segment_skin(self, img_bgr: np.ndarray) -> np.ndarray:
        """Return binary mask of skin pixels."""
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, self.SKIN_LOWER_HSV, self.SKIN_UPPER_HSV)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        return mask

    def _detect_face_regions(self, img_bgr: np.ndarray):
        """Return dict mapping region_name -> (x,y,w,h) within face."""
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(80,80))
        if len(faces) == 0:
            fh, fw = img_bgr.shape[:2]
            faces = [(0, 0, fw, fh)]  # fallback: whole image
        fx, fy, fw, fh = faces[0]
        # Approximate anatomical zones
        return {
            "forehead":   (fx, fy, fw, int(fh * 0.25)),
            "left_cheek": (fx, int(fy + fh*0.35), int(fw*0.4), int(fh*0.3)),
            "right_cheek":(int(fx + fw*0.6), int(fy + fh*0.35), int(fw*0.4), int(fh*0.3)),
            "nose":       (int(fx + fw*0.3), int(fy + fh*0.3), int(fw*0.4), int(fh*0.3)),
            "chin":       (fx, int(fy + fh*0.75), fw, int(fh*0.25)),
        }

    # ── ACNE DETECTION ──────────────────────────────────────────────────────
    def detect_acne(self, img_bgr: np.ndarray, skin_mask: np.ndarray):
        """
        Acne = reddish, raised-looking blobs on skin surface.
        Strategy: extract red channel dominance → threshold → blob detect.
        """
        detections = []
        b, g, r = cv2.split(img_bgr)
        # Red excess map
        red_excess = cv2.subtract(r.astype(np.int16), g.astype(np.int16))
        red_excess = np.clip(red_excess, 0, 255).astype(np.uint8)
        # Apply skin mask
        red_skin = cv2.bitwise_and(red_excess, red_excess, mask=skin_mask)
        # Threshold
        _, thresh = cv2.threshold(red_skin, 30, 255, cv2.THRESH_BINARY)
        # Morphological cleanup
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, k)
        # Find contours
        cnts, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts:
            area = cv2.contourArea(c)
            if 50 < area < 3000:  # filter by plausible acne size
                x, y, w, h = cv2.boundingRect(c)
                circularity = 4 * np.pi * area / (cv2.arcLength(c, True) ** 2 + 1e-5)
                if circularity > 0.3:  # roughly circular blobs
                    conf = min(0.95, 0.5 + circularity * 0.4 + area / 10000)
                    detections.append({
                        "label": "acne_spot",
                        "bbox": [int(x), int(y), int(w), int(h)],
                        "confidence": round(float(conf), 2),
                        "area_px": int(area)
                    })
        return detections

    # ── DARK SPOT / PIGMENTATION DETECTION ──────────────────────────────────
    def detect_dark_spots(self, img_bgr: np.ndarray, skin_mask: np.ndarray):
        """
        Pigmentation = localised darkening relative to surrounding skin.
        Strategy: convert to LAB, analyse L channel for dark blobs.
        """
        detections = []
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l_chan = lab[:, :, 0]
        # Blur to get local "average" skin tone
        blurred = cv2.GaussianBlur(l_chan, (31, 31), 0)
        # Dark spot = significantly darker than surroundings
        diff = cv2.subtract(blurred, l_chan)
        skin_diff = cv2.bitwise_and(diff, diff, mask=skin_mask)
        _, thresh = cv2.threshold(skin_diff, 20, 255, cv2.THRESH_BINARY)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, k)
        cnts, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts:
            area = cv2.contourArea(c)
            if 100 < area < 8000:
                x, y, w, h = cv2.boundingRect(c)
                # Compute mean darkness
                roi = diff[y:y+h, x:x+w]
                mean_dark = float(np.mean(roi))
                conf = min(0.95, mean_dark / 60.0)
                detections.append({
                    "label": "dark_spot",
                    "bbox": [int(x), int(y), int(w), int(h)],
                    "confidence": round(conf, 2),
                    "area_px": int(area)
                })
        return detections

    # ── MOLE / MARK DETECTION ───────────────────────────────────────────────
    def detect_moles(self, img_bgr: np.ndarray, skin_mask: np.ndarray):
        """
        Moles = small, very dark, highly circular regions.
        """
        detections = []
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        skin_gray = cv2.bitwise_and(gray, gray, mask=skin_mask)
        # CLAHE for contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(skin_gray)
        _, thresh = cv2.threshold(enhanced, 60, 255, cv2.THRESH_BINARY_INV)
        thresh = cv2.bitwise_and(thresh, thresh, mask=skin_mask)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, k)
        # Hough circles for roundish moles
        circles = cv2.HoughCircles(
            enhanced, cv2.HOUGH_GRADIENT, dp=1, minDist=20,
            param1=50, param2=30, minRadius=3, maxRadius=25
        )
        if circles is not None:
            circles = np.round(circles[0, :]).astype(int)
            for (cx, cy, r) in circles:
                if cy < skin_mask.shape[0] and cx < skin_mask.shape[1]:
                    if skin_mask[cy, cx] > 0:  # must be on skin
                        x, y = max(0, cx-r), max(0, cy-r)
                        w = h = r * 2
                        # Check darkness at circle centre
                        roi_grey = gray[max(0,cy-r):cy+r, max(0,cx-r):cx+r]
                        if roi_grey.size > 0 and np.mean(roi_grey) < 100:
                            detections.append({
                                "label": "mole_mark",
                                "bbox": [int(x), int(y), int(w), int(h)],
                                "confidence": round(min(0.90, 1 - np.mean(roi_grey)/120), 2),
                                "radius_px": int(r)
                            })
        return detections

    # ── TANNING REGION DETECTION ─────────────────────────────────────────────
    def detect_tanning(self, img_bgr: np.ndarray, skin_mask: np.ndarray):
        """
        Tanning = broad regions where skin is significantly darker/more saturated.
        Strategy: compare saturation + value across skin regions.
        """
        detections = []
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        s_chan = hsv[:, :, 1]
        v_chan = hsv[:, :, 2]
        skin_v = cv2.bitwise_and(v_chan, v_chan, mask=skin_mask)
        # Global skin brightness average
        skin_pixels = skin_v[skin_mask > 0]
        if len(skin_pixels) == 0:
            return []
        mean_v = float(np.mean(skin_pixels))
        # Tanned = darker by > 30% of mean
        threshold_v = mean_v * 0.7
        tan_mask = np.zeros_like(skin_mask)
        tan_mask[(skin_v < threshold_v) & (skin_mask > 0)] = 255
        # Remove tiny blobs
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        tan_mask = cv2.morphologyEx(tan_mask, cv2.MORPH_OPEN, k)
        cnts, _ = cv2.findContours(tan_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts:
            area = cv2.contourArea(c)
            if area > 2000:  # tanning = broad region
                x, y, w, h = cv2.boundingRect(c)
                detections.append({
                    "label": "tanning_region",
                    "bbox": [int(x), int(y), int(w), int(h)],
                    "confidence": round(min(0.90, area / 20000), 2),
                    "area_px": int(area)
                })
        return detections

    # ── ANNOTATE IMAGE ───────────────────────────────────────────────────────
    def annotate(self, img_bgr: np.ndarray, all_detections: list) -> np.ndarray:
        """Draw colour-coded bounding boxes and labels on image."""
        COLOURS = {
            "acne_spot":      (0,   80, 255),   # red-orange
            "dark_spot":      (130,  0, 130),   # purple
            "mole_mark":      (20,  20,  20),   # near-black
            "tanning_region": (0,  165, 255),   # orange
        }
        annotated = img_bgr.copy()
        for det in all_detections:
            x, y, w, h = det["bbox"]
            label = det["label"]
            colour = COLOURS.get(label, (255,255,255))
            cv2.rectangle(annotated, (x, y), (x+w, y+h), colour, 2)
            text = f"{label} {det['confidence']:.0%}"
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(annotated, (x, y-th-6), (x+tw+4, y), colour, -1)
            cv2.putText(annotated, text, (x+2, y-4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255,255,255), 1)
        return annotated

    # ── REGION NAMING ────────────────────────────────────────────────────────
    def assign_region_names(self, detections: list, face_regions: dict, img_shape) -> list:
        """Map each detection bbox to the closest face region."""
        def centre(bbox):
            x, y, w, h = bbox
            return x + w//2, y + h//2

        for det in detections:
            cx, cy = centre(det["bbox"])
            best_region = "general"
            for region_name, (rx, ry, rw, rh) in face_regions.items():
                if rx <= cx <= rx+rw and ry <= cy <= ry+rh:
                    best_region = region_name
                    break
            det["region"] = best_region
        return detections

    # ── MAIN DETECT ──────────────────────────────────────────────────────────
    def detect(self, img_bytes: bytes) -> dict:
        img_bgr = self._load_image(img_bytes)
        skin_mask = self._segment_skin(img_bgr)
        face_regions = self._detect_face_regions(img_bgr)

        acne    = self.detect_acne(img_bgr, skin_mask)
        dark    = self.detect_dark_spots(img_bgr, skin_mask)
        moles   = self.detect_moles(img_bgr, skin_mask)
        tanning = self.detect_tanning(img_bgr, skin_mask)

        all_dets = acne + dark + moles + tanning
        all_dets = self.assign_region_names(all_dets, face_regions, img_bgr.shape)

        # Sort by confidence desc
        all_dets.sort(key=lambda d: d["confidence"], reverse=True)

        # Build annotated image → base64
        annotated = self.annotate(img_bgr, all_dets)
        _, buf = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
        annotated_b64 = base64.b64encode(buf).decode()

        # Build human-readable summary
        summary = self._build_summary(all_dets)

        return {
            "detections": all_dets,
            "counts": {
                "acne_spots":      len(acne),
                "dark_spots":      len(dark),
                "moles_marks":     len(moles),
                "tanning_regions": len(tanning),
                "total":           len(all_dets)
            },
            "summary": summary,
            "annotated_image_base64": annotated_b64,
            "image_size": {"width": img_bgr.shape[1], "height": img_bgr.shape[0]}
        }

    def _build_summary(self, detections: list) -> list:
        """Generate natural language descriptions per detected feature."""
        msgs = []
        by_label = {}
        for d in detections:
            by_label.setdefault(d["label"], []).append(d)

        if "acne_spot" in by_label:
            spots = by_label["acne_spot"]
            regions = list({s["region"] for s in spots})
            msgs.append(
                f"Detected {len(spots)} acne spot{'s' if len(spots)>1 else ''} "
                f"primarily on {', '.join(regions)}."
            )
        if "dark_spot" in by_label:
            spots = by_label["dark_spot"]
            regions = list({s["region"] for s in spots})
            msgs.append(
                f"Detected {len(spots)} dark spot{'s' if len(spots)>1 else ''} / "
                f"pigmentation on {', '.join(regions)}."
            )
        if "mole_mark" in by_label:
            marks = by_label["mole_mark"]
            msgs.append(f"Detected {len(marks)} mole/mark region{'s' if len(marks)>1 else ''}.")
        if "tanning_region" in by_label:
            t = by_label["tanning_region"]
            regions = list({x["region"] for x in t})
            msgs.append(
                f"Tanning/sun-darkening detected across {', '.join(regions)}."
            )
        if not msgs:
            msgs.append("No significant skin marks detected. Skin appears clear.")
        return msgs


# Singleton detector
detector = SkinMarkDetector()

# ─────────────────────────────────────────
# FLASK ROUTES
# ─────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "skin-detection", "port": 5002})


@app.route('/detect', methods=['POST'])
def detect():
    """
    POST /detect
    Body: multipart/form-data with 'image' field
    Returns: detections, counts, summary, annotated_image_base64
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400

    img_bytes = request.files['image'].read()
    if not img_bytes:
        return jsonify({"error": "Empty image"}), 400

    try:
        result = detector.detect(img_bytes)
        log.info(f"Detection: {result['counts']}")
        return jsonify(result)
    except Exception as e:
        log.error(f"Detection error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/detect/base64', methods=['POST'])
def detect_base64():
    """
    POST /detect/base64
    Body: JSON { "image": "<base64 string>" }
    Used by live capture (webcam) which sends canvas data as base64.
    """
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({"error": "No image in body"}), 400

    try:
        # Strip data URI prefix if present
        img_b64 = data['image']
        if ',' in img_b64:
            img_b64 = img_b64.split(',', 1)[1]
        img_bytes = base64.b64decode(img_b64)
        result = detector.detect(img_bytes)
        return jsonify(result)
    except Exception as e:
        log.error(f"Base64 detect error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('DETECTION_PORT', 5002))
    log.info(f"Skin detection service starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
