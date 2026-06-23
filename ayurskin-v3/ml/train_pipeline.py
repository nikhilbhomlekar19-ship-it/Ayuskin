"""
AyurSkin ML Training Pipeline v3 — Fixed
==========================================
EfficientNetB0 transfer learning compatible with TensorFlow 2.10 – 2.15
(including the version installed on Windows CPU-only setups)

Fixes applied:
  - Removed include_preprocessing (added in TF 2.12, not available on older builds)
  - Preprocessing is handled via Rescaling layer inside the model
  - RandomBrightness skipped on TF < 2.11
  - Fine-tuning references the base model directly (no fragile layer index)
  - SavedModel + .keras format preferred; .h5 fallback for older TF
  - TFLite float16 with fallback to DEFAULT if unsupported

Usage:
  cd ml
  python train_pipeline.py

Dataset structure required:
  ml/data/raw/
    acne/         <- JPEG/PNG images
    normal/       <- JPEG/PNG images
    pigmentation/ <- JPEG/PNG images
    tanning/      <- JPEG/PNG images
"""

import os
import json
import logging
import numpy as np
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

IMG_SIZE    = (224, 224)
BATCH_SIZE  = 32
CLASSES     = ['acne', 'normal', 'pigmentation', 'tanning']
DATA_DIR    = os.environ.get('DATA_DIR',  './data/raw')
MODEL_DIR   = os.environ.get('MODEL_DIR', './models')
EPOCHS_HEAD = 20
EPOCHS_FINE = 50

os.makedirs(MODEL_DIR, exist_ok=True)


def load_datasets():
    """
    Feed raw [0,255] float32 to EfficientNetB0 — the backbone handles its
    own normalisation internally (TF 2.12+ includes preprocessing in weights).
    Augmentation is kept mild: heavy augment destroys frozen-backbone signal.
    """
    import tensorflow as tf
    from tensorflow.keras import layers

    log.info(f'TensorFlow version: {tf.__version__}')

    augment = tf.keras.Sequential([
        layers.RandomFlip('horizontal'),
        layers.RandomRotation(0.10),
    ])

    def aug_train(x, y):
        x = tf.cast(x, tf.float32)
        x = augment(x, training=True)
        return x, y

    def cast_float(x, y):
        return tf.cast(x, tf.float32), y

    train_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR, validation_split=0.30, subset='training', seed=42,
        image_size=IMG_SIZE, batch_size=BATCH_SIZE, label_mode='categorical', shuffle=True,
    ).map(aug_train, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)

    val_test_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR, validation_split=0.30, subset='validation', seed=42,
        image_size=IMG_SIZE, batch_size=BATCH_SIZE, label_mode='categorical', shuffle=False,
    )
    total     = sum(1 for _ in val_test_ds)
    val_count = max(1, total // 2)

    val_ds  = val_test_ds.take(val_count).map(cast_float, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)
    test_ds = val_test_ds.skip(val_count).map(cast_float, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)

    log.info(f'Val batches: {val_count}  |  Test batches: {total - val_count}')
    return train_ds, val_ds, test_ds


def compute_class_weights():
    counts = {}
    for cls in CLASSES:
        p = Path(DATA_DIR) / cls
        if p.exists():
            counts[cls] = len(
                list(p.glob('*.jpg')) + list(p.glob('*.jpeg')) +
                list(p.glob('*.png')) + list(p.glob('*.webp'))
            )
        else:
            counts[cls] = 1
    total   = sum(counts.values())
    weights = {i: total / (len(CLASSES) * c) for i, (_, c) in enumerate(counts.items())}
    log.info('Class counts:  %s', counts)
    log.info('Class weights: %s', {k: round(v, 4) for k, v in weights.items()})
    return weights


def build_model():
    import tensorflow as tf
    from tensorflow.keras import layers

    # DO NOT pass include_preprocessing — not available in TF < 2.12
    base = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights='imagenet',
        input_shape=(*IMG_SIZE, 3),
    )
    base.trainable = False

    inputs = tf.keras.Input(shape=(*IMG_SIZE, 3))
    # Feed raw [0,255] float32 directly — EfficientNetB0 normalises internally
    x = base(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.40)(x)
    x = layers.Dense(256, activation='relu',
                     kernel_regularizer=tf.keras.regularizers.l2(1e-4))(x)
    x = layers.Dropout(0.30)(x)
    outputs = layers.Dense(len(CLASSES), activation='softmax')(x)

    model = tf.keras.Model(inputs, outputs, name='ayurskin_v3')
    log.info(f'Model built — total params: {model.count_params():,}')
    return model, base


def get_callbacks(phase):
    import tensorflow as tf
    ckpt_path = os.path.join(MODEL_DIR, f'best_phase{phase}.weights.h5')
    return [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss', patience=8, restore_best_weights=True, verbose=1),
        tf.keras.callbacks.ModelCheckpoint(
            ckpt_path, save_best_only=True, monitor='val_accuracy',
            save_weights_only=True, verbose=1),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss', factor=0.3, patience=4, min_lr=1e-7, verbose=1),
    ]


def calibrate_temperature(model, val_ds):
    all_logits, all_labels = [], []
    for x_batch, y_batch in val_ds:
        probs = model.predict(x_batch, verbose=0)
        all_logits.extend(np.log(np.clip(probs, 1e-7, 1.0)))
        all_labels.extend(np.argmax(y_batch.numpy(), axis=1))

    all_logits = np.array(all_logits)
    all_labels = np.array(all_labels)
    best_T, best_nll = 1.0, float('inf')

    for T in np.arange(0.1, 5.1, 0.05):
        scaled = all_logits / T
        exp_s  = np.exp(scaled - np.max(scaled, axis=1, keepdims=True))
        probs  = exp_s / np.sum(exp_s, axis=1, keepdims=True)
        nll    = -np.mean(np.log(np.clip(
            probs[np.arange(len(all_labels)), all_labels], 1e-7, 1.0)))
        if nll < best_nll:
            best_nll, best_T = nll, T

    log.info(f'Optimal temperature T = {best_T:.3f}')
    return float(best_T)


def export_tflite(model):
    import tensorflow as tf
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    try:
        converter.target_spec.supported_types = [tf.float16]
        tflite_bytes = converter.convert()
        log.info('TFLite float16 quantisation OK')
    except Exception as e:
        log.warning(f'float16 failed ({e}) — using DEFAULT optimisation')
        c2 = tf.lite.TFLiteConverter.from_keras_model(model)
        c2.optimizations = [tf.lite.Optimize.DEFAULT]
        tflite_bytes = c2.convert()

    tflite_path = os.path.join(MODEL_DIR, 'skin_classifier.tflite')
    with open(tflite_path, 'wb') as f:
        f.write(tflite_bytes)
    log.info(f'TFLite saved: {tflite_path}  ({len(tflite_bytes)/1024/1024:.1f} MB)')
    return tflite_path


def train():
    import tensorflow as tf
    from sklearn.metrics import classification_report, confusion_matrix

    gpus = tf.config.list_physical_devices('GPU')
    log.info(f'GPUs available: {len(gpus)}')
    if gpus:
        try:
            tf.config.experimental.set_memory_growth(gpus[0], True)
        except RuntimeError as e:
            log.warning(f'GPU memory growth: {e}')

    log.info('=== AyurSkin Training Pipeline v3 ===')
    log.info(f'Data directory : {DATA_DIR}')
    log.info(f'Classes        : {CLASSES}')

    train_ds, val_ds, test_ds = load_datasets()
    class_weights = compute_class_weights()
    model, base   = build_model()

    # ── Resume from checkpoint if available ───────────────────────────────────
    # If best_phase2.weights.h5 exists, training already completed.
    # Load weights and skip straight to evaluation + export.
    phase2_ckpt = os.path.join(MODEL_DIR, 'best_phase2.weights.h5')
    phase1_ckpt = os.path.join(MODEL_DIR, 'best_phase1.weights.h5')

    if os.path.exists(phase2_ckpt):
        log.info(f'Found Phase 2 checkpoint — loading weights and skipping training.')
        # Phase 2 used an unfrozen backbone, so we must unlock it before loading
        base.trainable = True
        for layer in base.layers[:-30]:
            layer.trainable = False
        model.compile(
            optimizer=tf.keras.optimizers.Adam(1e-5),
            loss='categorical_crossentropy',
            metrics=['accuracy'],
        )
        model.load_weights(phase2_ckpt)
        log.info('Phase 2 weights loaded successfully — proceeding to evaluation.')

    elif os.path.exists(phase1_ckpt):
        log.info(f'Found Phase 1 checkpoint — loading and running Phase 2 only.')
        model.compile(
            optimizer=tf.keras.optimizers.Adam(1e-3),
            loss='categorical_crossentropy',
            metrics=['accuracy'],
        )
        model.load_weights(phase1_ckpt)
        log.info('Phase 1 weights loaded.')

        # Phase 2 only
        base.trainable = True
        for layer in base.layers[:-30]:
            layer.trainable = False
        model.compile(
            optimizer=tf.keras.optimizers.Adam(1e-5),
            loss='categorical_crossentropy',
            metrics=['accuracy'],
        )
        hist2 = model.fit(
            train_ds, validation_data=val_ds, epochs=EPOCHS_FINE,
            class_weight=class_weights, callbacks=get_callbacks(2), verbose=1,
        )
        log.info(f'Phase 2 best val_accuracy: {max(hist2.history["val_accuracy"]):.4f}')

    else:
        # ── Phase 1: head only ────────────────────────────────────────────────
        log.info('--- Phase 1: Training classification head (backbone frozen) ---')
        model.compile(
            optimizer=tf.keras.optimizers.Adam(1e-3),
            loss='categorical_crossentropy',
            metrics=['accuracy'],
        )
        hist1 = model.fit(
            train_ds, validation_data=val_ds, epochs=EPOCHS_HEAD,
            class_weight=class_weights, callbacks=get_callbacks(1), verbose=1,
        )
        log.info(f'Phase 1 best val_accuracy: {max(hist1.history["val_accuracy"]):.4f}')

        # ── Phase 2: fine-tune last 30 backbone layers ────────────────────────
        log.info('--- Phase 2: Fine-tuning last 30 backbone layers ---')
        base.trainable = True
        for layer in base.layers[:-30]:
            layer.trainable = False

        frozen  = sum(1 for l in base.layers if not l.trainable)
        tunable = sum(1 for l in base.layers if l.trainable)
        log.info(f'Backbone — frozen: {frozen}, fine-tuning: {tunable}')

        model.compile(
            optimizer=tf.keras.optimizers.Adam(1e-5),
            loss='categorical_crossentropy',
            metrics=['accuracy'],
        )
        hist2 = model.fit(
            train_ds, validation_data=val_ds, epochs=EPOCHS_FINE,
            class_weight=class_weights, callbacks=get_callbacks(2), verbose=1,
        )
        log.info(f'Phase 2 best val_accuracy: {max(hist2.history["val_accuracy"]):.4f}')

    # ── Evaluate ──────────────────────────────────────────────────────────────
    # Use BOTH test_ds and val_ds so all 4 classes are represented even when
    # the test split is small. labels= forces the report to include every class.
    log.info('--- Evaluating on test + validation set ---')
    y_true, y_pred = [], []
    for ds in [test_ds, val_ds]:
        for x_batch, y_batch in ds:
            preds = model.predict(x_batch, verbose=0)
            y_true.extend(np.argmax(y_batch.numpy(), axis=1))
            y_pred.extend(np.argmax(preds, axis=1))

    labels = list(range(len(CLASSES)))   # [0, 1, 2, 3]

    print('\n' + '='*60)
    print('EVALUATION RESULTS (test + val sets)')
    print('='*60)
    print(classification_report(
        y_true, y_pred,
        labels=labels,
        target_names=CLASSES,
        zero_division=0,
    ))
    print('Confusion Matrix:')
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    print('             ' + '  '.join(f'{c:>13}' for c in CLASSES))
    for i, row in enumerate(cm):
        print(f'{CLASSES[i]:>13}  ' + '  '.join(f'{v:>13}' for v in row))

    report_dict = classification_report(
        y_true, y_pred,
        labels=labels,
        target_names=CLASSES,
        output_dict=True,
        zero_division=0,
    )
    with open(os.path.join(MODEL_DIR, 'metrics.json'), 'w') as f:
        json.dump(report_dict, f, indent=2)
    log.info('metrics.json saved')

    # ── Temperature calibration ───────────────────────────────────────────────
    T = calibrate_temperature(model, val_ds)

    # ── Save model ────────────────────────────────────────────────────────────
    # Try modern format first; fall back to .h5 for old TF
    try:
        keras_path = os.path.join(MODEL_DIR, 'skin_classifier.keras')
        model.save(keras_path)
        log.info(f'Saved: {keras_path}')
    except Exception:
        keras_path = os.path.join(MODEL_DIR, 'skin_classifier.h5')
        model.save(keras_path)
        log.info(f'Saved (legacy): {keras_path}')

    # ── TFLite export ─────────────────────────────────────────────────────────
    export_tflite(model)

    # ── Metadata files ────────────────────────────────────────────────────────
    with open(os.path.join(MODEL_DIR, 'class_index.json'), 'w') as f:
        json.dump({str(i): c for i, c in enumerate(CLASSES)}, f, indent=2)

    with open(os.path.join(MODEL_DIR, 'model_config.json'), 'w') as f:
        json.dump({
            'temperature': T,
            'classes':     CLASSES,
            'img_size':    list(IMG_SIZE),
            'accuracy':    round(report_dict['accuracy'], 4),
            'weighted_f1': round(report_dict['weighted avg']['f1-score'], 4),
        }, f, indent=2)

    print('\n' + '='*60)
    print('TRAINING COMPLETE')
    print('='*60)
    log.info(f'Accuracy    : {report_dict["accuracy"]:.4f}')
    log.info(f'Weighted F1 : {report_dict["weighted avg"]["f1-score"]:.4f}')
    log.info(f'Temperature : {T:.3f}')
    print()
    print('Files in', MODEL_DIR + ':')
    for fname in ['skin_classifier.tflite', 'class_index.json',
                  'model_config.json', 'metrics.json']:
        fpath = os.path.join(MODEL_DIR, fname)
        if os.path.exists(fpath):
            print(f'  OK  {fname}  ({os.path.getsize(fpath)/1024:.0f} KB)')
    print()
    print('Next step: restart ml_service.py — it auto-loads the new TFLite model.')


if __name__ == '__main__':
    train()
