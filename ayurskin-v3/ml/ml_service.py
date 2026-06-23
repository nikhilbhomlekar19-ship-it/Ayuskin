"""
AyurSkin ML Service v3
======================
Port 5001 — Main skin condition classification + skin type detection

Endpoints:
  GET  /health
  POST /predict          — skin condition (acne/normal/pigmentation/tanning)
  POST /predict/compare  — compare two images
  POST /skin-type        — oily/dry/combination/normal classification
"""

import os, io, json, logging, base64
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

MODEL_PATH      = os.environ.get('MODEL_PATH',       './models/skin_classifier.h5')
TFLITE_PATH     = os.environ.get('TFLITE_PATH',      './models/skin_classifier.tflite')
CLASS_IDX_PATH  = os.environ.get('CLASS_INDEX_PATH', './models/class_index.json')
CONFIG_PATH     = os.environ.get('MODEL_CONFIG',     './models/model_config.json')
IMG_SIZE        = (224, 224)

model       = None
class_index = {}
temperature = 1.0   # calibration

# ── Load model ────────────────────────────────────────────────────────────────
def load_model():
    global model, class_index, temperature
    try:
        if os.path.exists(TFLITE_PATH):
            import tensorflow as tf
            interp = tf.lite.Interpreter(model_path=TFLITE_PATH)
            interp.allocate_tensors()
            model = {'type': 'tflite', 'interpreter': interp}
            logger.info(f'✅ Loaded TFLite model: {TFLITE_PATH}')
        elif os.path.exists(MODEL_PATH):
            import tensorflow as tf
            keras_model = tf.keras.models.load_model(MODEL_PATH)
            model = {'type': 'keras', 'model': keras_model}
            logger.info(f'✅ Loaded Keras model: {MODEL_PATH}')
        else:
            logger.warning('⚠️  No model found — using heuristic fallback. Train model for accuracy.')
            model = {'type': 'fallback'}

        if os.path.exists(CLASS_IDX_PATH):
            with open(CLASS_IDX_PATH) as f:
                class_index = json.load(f)
        else:
            class_index = {'0': 'acne', '1': 'normal', '2': 'pigmentation', '3': 'tanning'}

        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH) as f:
                cfg = json.load(f)
                temperature = cfg.get('temperature', 1.0)

        logger.info(f'Classes: {list(class_index.values())} | Temperature: {temperature}')
    except Exception as e:
        logger.error(f'Model load error: {e}')
        model = {'type': 'fallback'}

# ── Image helpers ─────────────────────────────────────────────────────────────
def preprocess(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize(IMG_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)   # (1,224,224,3)

def apply_temperature(logits, T):
    """Temperature scaling for calibrated confidence."""
    scaled = logits / T
    exp = np.exp(scaled - np.max(scaled))
    return exp / np.sum(exp)

def run_inference(img_array):
    mt = model.get('type', 'fallback') if model else 'fallback'
    if mt == 'keras':
        raw = model['model'].predict(img_array, verbose=0)[0]
    elif mt == 'tflite':
        interp = model['interpreter']
        inp_d  = interp.get_input_details()
        out_d  = interp.get_output_details()
        interp.set_tensor(inp_d[0]['index'], img_array)
        interp.invoke()
        raw = interp.get_tensor(out_d[0]['index'])[0]
    else:
        return fallback_predict(img_array), 'fallback'

    preds = apply_temperature(raw, temperature)
    return preds, mt

def fallback_predict(img_array):
    """Heuristic colour-science fallback (not for production)."""
    img = img_array[0]
    r, g, b = img[:,:,0], img[:,:,1], img[:,:,2]
    lum = 0.299*r + 0.587*g + 0.114*b
    redness    = float(np.mean(r - g))
    brightness = float(np.mean(lum))
    variance   = float(np.var(lum))
    scores = np.array([0.25, 0.25, 0.25, 0.25], dtype=np.float32)
    if redness > 0.05:  scores[0] += redness * 2      # acne
    if brightness > 0.65: scores[1] += 0.3             # normal
    if variance > 0.03:   scores[2] += variance * 5    # pigmentation
    if brightness < 0.45: scores[3] += (0.45-brightness)*2  # tanning
    exp = np.exp(scores)
    return exp / np.sum(exp)

# ── Skin Type classifier ──────────────────────────────────────────────────────
def classify_skin_type(img_array):
    """
    Heuristic zone-based skin type detection.
    Analyses T-zone (forehead + nose) vs cheek brightness and texture.
    """
    img = img_array[0]   # (224,224,3) float32 [0,1]
    H, W = img.shape[:2]

    # Zone masks
    t_zone  = img[0:int(H*0.45), int(W*0.25):int(W*0.75)]
    l_cheek = img[int(H*0.35):int(H*0.65), :int(W*0.32)]
    r_cheek = img[int(H*0.35):int(H*0.65), int(W*0.68):]

    def zone_stats(z):
        lum = 0.299*z[:,:,0] + 0.587*z[:,:,1] + 0.114*z[:,:,2]
        return float(np.mean(lum)), float(np.var(lum))

    t_bright,  t_var  = zone_stats(t_zone)
    lc_bright, lc_var = zone_stats(l_cheek)
    rc_bright, rc_var = zone_stats(r_cheek)
    cheek_bright = (lc_bright + rc_bright) / 2
    cheek_var    = (lc_var    + rc_var)    / 2

    # Oiliness = high T-zone brightness (specular reflection)
    t_oiliness  = t_bright * 100
    # Dryness = low cheek brightness + high texture variance
    dryness     = ((1 - cheek_bright) + cheek_var) * 50
    # Combination = T-zone oily but cheeks not as bright
    combo_score = max(0, t_oiliness - cheek_bright * 85)

    if   t_oiliness > 68 and cheek_bright > 0.50: skin_type = 'oily'
    elif dryness > 38    and t_oiliness < 55:      skin_type = 'dry'
    elif combo_score > 12:                          skin_type = 'combination'
    else:                                           skin_type = 'normal'

    return {
        'skinType': skin_type,
        'metrics': {
            'tZoneOiliness':    round(t_oiliness, 1),
            'cheekBrightness':  round(cheek_bright * 100, 1),
            'dryness':          round(dryness, 1),
            'comboScore':       round(combo_score, 1),
            'tZoneVariance':    round(t_var * 1000, 2),
            'cheekVariance':    round(cheek_var * 1000, 2),
        },
        'confidence': 'heuristic'
    }

def image_metrics(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB').resize(IMG_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    lum = 0.299*r + 0.587*g + 0.114*b
    return {
        'brightness':   round(float(np.mean(lum)) * 100, 2),
        'redness':      round(float(np.mean(r - g)) * 100, 2),
        'uniformity':   round((1 - float(np.std(lum))) * 100, 2),
    }

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    mt = model.get('type', 'none') if model else 'none'
    return jsonify({'status': 'ok', 'model_type': mt, 'classes': list(class_index.values()), 'port': 5001})

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    raw = request.files['image'].read()
    if not raw:
        return jsonify({'error': 'Empty image'}), 400
    try:
        arr   = preprocess(raw)
        preds, mt = run_inference(arr)
        idx   = int(np.argmax(preds))
        cond  = class_index.get(str(idx), 'normal')
        probs = {class_index.get(str(i), f'class_{i}'): round(float(p) * 100, 2) for i, p in enumerate(preds)}
        logger.info(f'Prediction: {cond} ({preds[idx]*100:.1f}%) [{mt}]')
        return jsonify({
            'condition':    cond,
            'confidence':   round(float(preds[idx]) * 100, 2),
            'probabilities': probs,
            'model_type':   mt,
            'is_fallback':  mt == 'fallback',
        })
    except Exception as e:
        logger.error(f'Predict error: {e}', exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/skin-type', methods=['POST'])
def skin_type_route():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    raw = request.files['image'].read()
    try:
        arr = preprocess(raw)
        result = classify_skin_type(arr)
        logger.info(f'Skin type: {result["skinType"]}')
        return jsonify(result)
    except Exception as e:
        logger.error(f'Skin-type error: {e}', exc_info=True)
        return jsonify({'error': str(e), 'skinType': 'unknown'}), 500

@app.route('/predict/compare', methods=['POST'])
def predict_compare():
    if 'image1' not in request.files or 'image2' not in request.files:
        return jsonify({'error': 'Both image1 and image2 required'}), 400
    try:
        b1, b2 = request.files['image1'].read(), request.files['image2'].read()
        p1, _  = run_inference(preprocess(b1))
        p2, _  = run_inference(preprocess(b2))
        m1, m2 = image_metrics(b1), image_metrics(b2)
        i1, i2 = int(np.argmax(p1)), int(np.argmax(p2))
        c1, c2 = class_index.get(str(i1), 'normal'), class_index.get(str(i2), 'normal')

        changes = {}
        for key in m1:
            diff = m2[key] - m1[key]
            changes[key] = {'before': m1[key], 'after': m2[key], 'change': round(diff, 2),
                            'improved': diff > 0 if key in ['brightness', 'uniformity'] else diff < 0}

        try:    acne_idx = list(class_index.values()).index('acne')
        except: acne_idx = 0
        acne_reduction = round((float(p1[acne_idx]) - float(p2[acne_idx])) * 100, 2)

        return jsonify({
            'before': {'condition': c1, 'confidence': round(float(p1[i1])*100, 2), 'metrics': m1},
            'after':  {'condition': c2, 'confidence': round(float(p2[i2])*100, 2), 'metrics': m2},
            'changes': changes,
            'insights': {
                'acne_reduction':              acne_reduction,
                'brightness_improvement':      changes.get('brightness', {}).get('change', 0),
                'skin_uniformity_improvement': changes.get('uniformity', {}).get('change', 0),
                'overall_improvement':         c1 != c2 and c2 == 'normal',
            }
        })
    except Exception as e:
        logger.error(f'Compare error: {e}', exc_info=True)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    load_model()
    port = int(os.environ.get('ML_PORT', 5001))
    logger.info(f'🚀 ML Service starting on port {port}')
    app.run(host='0.0.0.0', port=port, debug=False)
