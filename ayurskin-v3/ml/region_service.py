"""
AyurSkin Region Analysis Service v3
====================================
Port 5003 — Per-region skin condition predictions using MediaPipe FaceMesh

Endpoints:
  GET  /health
  POST /analyze-regions   — multipart 'image' field
  POST /analyze-regions/base64  — JSON { "image": "data:image/jpeg;base64,..." }
"""

import os, io, base64, json, logging
import numpy as np
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

app  = Flask(__name__)
CORS(app)

# ── Load shared TFLite model ──────────────────────────────────────────────────
TFLITE_PATH = os.environ.get('TFLITE_PATH', './models/skin_classifier.tflite')
CLASS_IDX   = {'0': 'acne', '1': 'normal', '2': 'pigmentation', '3': 'tanning'}
IMG_SIZE    = (224, 224)

tflite_interp = None

def load_tflite():
    global tflite_interp
    if not os.path.exists(TFLITE_PATH):
        log.warning(f'TFLite model not found at {TFLITE_PATH} — region predictions will use fallback')
        return
    try:
        import tensorflow as tf
        tflite_interp = tf.lite.Interpreter(model_path=TFLITE_PATH)
        tflite_interp.allocate_tensors()
        log.info(f'✅ Region service loaded TFLite: {TFLITE_PATH}')
    except Exception as e:
        log.error(f'TFLite load error: {e}')

def predict_crop(crop_bgr):
    """Run classifier on one region crop. Returns (condition, confidence, probs)."""
    if tflite_interp is None:
        return _fallback_predict(crop_bgr)

    img = cv2.resize(crop_bgr, IMG_SIZE)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    arr = np.expand_dims(img, 0)

    inp_d = tflite_interp.get_input_details()
    out_d = tflite_interp.get_output_details()
    tflite_interp.set_tensor(inp_d[0]['index'], arr)
    tflite_interp.invoke()
    preds = tflite_interp.get_tensor(out_d[0]['index'])[0]

    idx   = int(np.argmax(preds))
    cond  = CLASS_IDX.get(str(idx), 'normal')
    probs = {CLASS_IDX.get(str(i), f'c{i}'): round(float(p)*100, 1) for i, p in enumerate(preds)}
    return cond, round(float(preds[idx])*100, 1), probs

def _fallback_predict(crop_bgr):
    """Colour-science fallback when no model is available."""
    img  = cv2.resize(crop_bgr, IMG_SIZE).astype(np.float32) / 255.0
    r, g = img[:,:,2], img[:,:,1]
    lum  = 0.299*r + 0.587*g + 0.114*img[:,:,0]
    redness    = float(np.mean(r - g))
    brightness = float(np.mean(lum))
    variance   = float(np.var(lum))
    scores = np.array([0.25, 0.25, 0.25, 0.25], dtype=np.float32)
    if redness > 0.05:    scores[0] += redness * 2
    if brightness > 0.65: scores[1] += 0.3
    if variance > 0.03:   scores[2] += variance * 5
    if brightness < 0.45: scores[3] += (0.45-brightness)*2
    exp = np.exp(scores)
    preds = exp / np.sum(exp)
    idx  = int(np.argmax(preds))
    cond = CLASS_IDX.get(str(idx), 'normal')
    probs = {CLASS_IDX.get(str(i), f'c{i}'): round(float(p)*100, 1) for i, p in enumerate(preds)}
    return cond, round(float(preds[idx])*100, 1), probs

# ── MediaPipe face mesh ───────────────────────────────────────────────────────
try:
    import mediapipe as mp
    _mp_face = mp.solutions.face_mesh
    face_mesh = _mp_face.FaceMesh(
        static_image_mode=True, max_num_faces=1,
        refine_landmarks=True, min_detection_confidence=0.5,
    )
    USE_MEDIAPIPE = True
    log.info('✅ MediaPipe FaceMesh loaded')
except ImportError:
    USE_MEDIAPIPE = False
    log.warning('⚠️  MediaPipe not installed — falling back to OpenCV Haar cascades')

# Landmark indices for 5 face regions (MediaPipe 468-point mesh)
REGION_LANDMARKS = {
    'forehead':    [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 127, 162, 21, 54, 103, 67, 109],
    'nose':        [1, 2, 5, 4, 195, 197, 6, 168, 8, 9, 55, 285, 168, 6, 122, 351],
    'left_cheek':  [50, 101, 118, 117, 116, 123, 147, 213, 192, 214, 210, 169],
    'right_cheek': [280, 330, 347, 346, 345, 352, 376, 433, 416, 434, 430, 394],
    'chin':        [152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 454],
}

CONDITION_COLOR_BGR = {
    'acne':         (66,  66, 231),   # red
    'pigmentation': (180, 68, 141),   # purple
    'tanning':      (47, 156, 243),   # orange
    'normal':       (78, 175,  74),   # green
}

def get_bbox_from_landmarks(landmarks, indices, H, W, pad=12):
    """Return (x, y, bw, bh) bounding box from landmark point list."""
    pts = []
    for idx in indices:
        if idx < len(landmarks):
            lm = landmarks[idx]
            pts.append([int(lm.x * W), int(lm.y * H)])
    if not pts:
        return None
    pts = np.array(pts)
    x, y, bw, bh = cv2.boundingRect(pts)
    # Add padding, clamp to image bounds
    x = max(0, x - pad); y = max(0, y - pad)
    bw = min(W - x, bw + pad*2); bh = min(H - y, bh + pad*2)
    if bw < 8 or bh < 8:
        return None
    return (x, y, bw, bh)

def haar_fallback_regions(img_bgr):
    """Use OpenCV Haar cascade + geometric rules when MediaPipe is unavailable."""
    gray  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    faces = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')\
               .detectMultiScale(gray, 1.1, 5, minSize=(80, 80))
    H, W = img_bgr.shape[:2]
    if len(faces) == 0:
        fx, fy, fw, fh = 0, 0, W, H
    else:
        fx, fy, fw, fh = faces[0]

    return {
        'forehead':    (fx,           fy,            fw,          int(fh*0.28)),
        'nose':        (fx+int(fw*.3), fy+int(fh*.30), int(fw*.4), int(fh*.30)),
        'left_cheek':  (fx,           int(fy+fh*.38), int(fw*.40), int(fh*.32)),
        'right_cheek': (fx+int(fw*.60), int(fy+fh*.38), int(fw*.40), int(fh*.32)),
        'chin':        (fx,           int(fy+fh*.72), fw,          int(fh*.28)),
    }

def process_image(img_bytes):
    """Main pipeline — returns regions list + annotated image base64."""
    nparr   = np.frombuffer(img_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError('Could not decode image')

    # Resize to working resolution
    H, W = img_bgr.shape[:2]
    if max(H, W) > 1024:
        scale   = 1024 / max(H, W)
        img_bgr = cv2.resize(img_bgr, (int(W*scale), int(H*scale)))
        H, W    = img_bgr.shape[:2]

    overlay = img_bgr.copy()
    results = []

    if USE_MEDIAPIPE:
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        mp_res  = face_mesh.process(img_rgb)
        if mp_res.multi_face_landmarks:
            landmarks = mp_res.multi_face_landmarks[0].landmark
            for region_name, indices in REGION_LANDMARKS.items():
                bbox = get_bbox_from_landmarks(landmarks, indices, H, W)
                if not bbox:
                    continue
                x, y, bw, bh = bbox
                crop          = img_bgr[y:y+bh, x:x+bw]
                if crop.size == 0:
                    continue
                cond, conf, probs = predict_crop(crop)
                _draw_region(overlay, region_name, cond, conf, x, y, bw, bh)
                results.append({'region': region_name, 'condition': cond, 'confidence': conf,
                                'probabilities': probs, 'bbox': [x, y, bw, bh]})
        else:
            # MediaPipe found no face — fall through to Haar
            USE_HAAR = True
    
    if not USE_MEDIAPIPE or (USE_MEDIAPIPE and not results):
        # Haar cascade fallback
        bboxes = haar_fallback_regions(img_bgr)
        for region_name, bbox in bboxes.items():
            x, y, bw, bh = bbox
            x = max(0, x); y = max(0, y)
            bw = min(W-x, bw); bh = min(H-y, bh)
            if bw < 8 or bh < 8:
                continue
            crop = img_bgr[y:y+bh, x:x+bw]
            if crop.size == 0:
                continue
            cond, conf, probs = predict_crop(crop)
            _draw_region(overlay, region_name, cond, conf, x, y, bw, bh)
            results.append({'region': region_name, 'condition': cond, 'confidence': conf,
                            'probabilities': probs, 'bbox': [x, y, bw, bh]})

    # Encode annotated image
    _, buf = cv2.imencode('.jpg', overlay, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64    = 'data:image/jpeg;base64,' + base64.b64encode(buf).decode()

    return results, b64

def _draw_region(img, name, cond, conf, x, y, bw, bh):
    """Draw translucent filled rectangle + border + label."""
    colour = CONDITION_COLOR_BGR.get(cond, (200, 200, 200))
    roi    = img[y:y+bh, x:x+bw]
    fill   = np.full_like(roi, colour)
    cv2.addWeighted(fill, 0.32, roi, 0.68, 0, roi)
    cv2.rectangle(img, (x, y), (x+bw, y+bh), colour, 2)
    label = f"{name.replace('_',' ')} | {cond} {conf:.0f}%"
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
    cv2.rectangle(img, (x, y-th-6), (x+tw+4, y), colour, -1)
    cv2.putText(img, label, (x+2, y-4), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255,255,255), 1)

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok', 'port': 5003,
        'mediapipe': USE_MEDIAPIPE,
        'tflite_loaded': tflite_interp is not None,
    })

@app.route('/analyze-regions', methods=['POST'])
def analyze_regions():
    if 'image' not in request.files:
        return jsonify({'error': 'No image field', 'regions': []}), 400
    try:
        img_bytes     = request.files['image'].read()
        regions, b64  = process_image(img_bytes)
        log.info(f'Region analysis: {len(regions)} zones detected')
        return jsonify({'regions': regions, 'heatmapBase64': b64})
    except Exception as e:
        log.error(f'Region error: {e}', exc_info=True)
        return jsonify({'error': str(e), 'regions': []}), 500

@app.route('/analyze-regions/base64', methods=['POST'])
def analyze_regions_b64():
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({'error': 'No image', 'regions': []}), 400
    try:
        raw = data['image']
        if ',' in raw:
            raw = raw.split(',', 1)[1]
        img_bytes    = base64.b64decode(raw)
        regions, b64 = process_image(img_bytes)
        return jsonify({'regions': regions, 'heatmapBase64': b64})
    except Exception as e:
        log.error(f'Base64 region error: {e}', exc_info=True)
        return jsonify({'error': str(e), 'regions': []}), 500

if __name__ == '__main__':
    load_tflite()
    port = int(os.environ.get('REGION_PORT', 5003))
    log.info(f'🚀 Region Analysis Service starting on port {port}')
    app.run(host='0.0.0.0', port=port, debug=False)
