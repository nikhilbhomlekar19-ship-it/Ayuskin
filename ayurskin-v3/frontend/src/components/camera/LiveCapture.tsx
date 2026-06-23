import React, { useRef, useState, useCallback, useEffect } from 'react';
import { chatApi, getImageUrl } from '../../services/api';

interface AnalysisResult {
  classification: { condition: string; confidence: number; probabilities: Record<string, number>; isFallback?: boolean };
  detection:      { summary: string[]; annotated_image_base64?: string; counts: Record<string, number> };
}
interface Props {
  sessionId?:          string;
  onAnalysisComplete?: (r: AnalysisResult) => void;
  onClose?:            () => void;
}

const CONDITION_COLOR: Record<string, string> = {
  acne: '#dc2626', pigmentation: '#9333ea', tanning: '#d97706', normal: '#16a34a',
};

export default function LiveCapture({ sessionId, onAnalysisComplete, onClose }: Props) {
  const vidRef = useRef<HTMLVideoElement>(null);
  const cvRef  = useRef<HTMLCanvasElement>(null);
  const stRef  = useRef<MediaStream | null>(null);

  const [mode,     setMode]    = useState<'cam' | 'preview'>('cam');
  const [captured, setCaptured]= useState<string | null>(null);
  const [ready,    setReady]   = useState(false);
  const [countdown,setCountdown] = useState<number | null>(null);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const [result,   setResult]  = useState<AnalysisResult | null>(null);
  const [showAnn,  setShowAnn] = useState(false);

  const startCamera = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      stRef.current = stream;
      if (vidRef.current) {
        vidRef.current.srcObject = stream;
        await vidRef.current.play();
        setReady(true);
      }
    } catch (e: any) {
      setError(
        e.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : `Camera error: ${e.message}`
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    stRef.current?.getTracks().forEach(t => t.stop());
    stRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  const captureFrame = useCallback(() => {
    if (!vidRef.current || !cvRef.current) return;
    const v = vidRef.current;
    const c = cvRef.current;
    c.width  = v.videoWidth  || 640;
    c.height = v.videoHeight || 480;
    const ctx = c.getContext('2d')!;
    // Mirror the image
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.92);
    setCaptured(dataUrl);
    setMode('preview');
    stopCamera();
  }, [stopCamera]);

  const startCountdown = () => {
    setCountdown(3);
    let n = 3;
    const iv = setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) { clearInterval(iv); setCountdown(null); captureFrame(); }
    }, 1000);
  };

  const retake = () => {
    setCaptured(null); setResult(null); setError('');
    setMode('cam'); startCamera();
  };

  const analyseCapture = async () => {
    if (!captured) return;
    setLoading(true); setError('');
    try {
      const res = await chatApi.analyzeCapture(captured, sessionId);
      setResult(res as AnalysisResult);
      onAnalysisComplete?.(res as AnalysisResult);
    } catch (e: any) {
      setError(e.message || 'Analysis failed. Please try again.');
    } finally { setLoading(false); }
  };

  const condition = result?.classification?.condition;
  const condColor = condition ? (CONDITION_COLOR[condition] || '#374151') : '#374151';

  return (
    <div className="live-capture card">
      <div className="capture-header">
        <h3>📸 Live Camera Analysis</h3>
        {onClose && (
          <button className="capture-close" onClick={() => { stopCamera(); onClose?.(); }}>✕</button>
        )}
      </div>

      {/* Tips */}
      {mode === 'cam' && !error && (
        <div className="capture-tips">
          💡 Face a window · Remove glasses · Hold still · Neutral expression
        </div>
      )}

      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button className="retry-btn" onClick={() => { setError(''); startCamera(); }}>
            Retry Camera
          </button>
        </div>
      )}

      {/* Camera view */}
      {mode === 'cam' && (
        <div className="camera-viewport">
          <video ref={vidRef} className="camera-video" autoPlay playsInline muted />
          {/* Face guide oval */}
          <div className="face-guide" />
          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="countdown-overlay">
              <span className="countdown-number">{countdown}</span>
            </div>
          )}
          {ready && countdown === null && (
            <div className="camera-controls">
              <button className="shutter-btn" onClick={startCountdown}>
                <span className="shutter-icon" />
              </button>
              <span className="shutter-hint">Tap to capture (3-sec timer)</span>
            </div>
          )}
        </div>
      )}

      {/* Preview + analyse */}
      {mode === 'preview' && captured && (
        <div className="preview-section">
          <div className="preview-images">
            <div className="preview-col">
              <div className="preview-label">Captured</div>
              <img src={captured} alt="Captured" className="capture-preview-img" />
            </div>
            {result && showAnn && result.detection?.annotated_image_base64 && (
              <div className="preview-col">
                <div className="preview-label">Annotated</div>
                <img
                  src={`data:image/jpeg;base64,${result.detection.annotated_image_base64}`}
                  alt="Annotated"
                  className="capture-preview-img"
                />
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="capture-result" style={{ borderLeft: `4px solid ${condColor}` }}>
              <div className="result-condition" style={{ color: condColor }}>
                {condition?.charAt(0).toUpperCase()}{condition?.slice(1)}
              </div>
              <div className="result-conf">{result.classification.confidence.toFixed(1)}% confidence</div>

              {/* Probability pills */}
              <div className="result-probs">
                {Object.entries(result.classification.probabilities || {}).map(([cls, pct]) => (
                  <div key={cls} className="result-prob-row">
                    <span className="rp-label">{cls}</span>
                    <div className="rp-track">
                      <div className="rp-fill"
                        style={{ width: `${pct}%`, background: cls === condition ? condColor : '#d1d5db' }} />
                    </div>
                    <span className="rp-pct">{Number(pct).toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              {/* Detection summary */}
              {result.detection?.summary?.length > 0 && (
                <div className="result-detection">
                  {result.detection.summary.map((s, i) => <div key={i} className="det-line">📍 {s}</div>)}
                </div>
              )}

              {result.detection?.annotated_image_base64 && (
                <button className="toggle-ann-btn" onClick={() => setShowAnn(v => !v)}>
                  {showAnn ? 'Hide' : 'Show'} Annotated Image
                </button>
              )}

              {result.classification.isFallback && (
                <div className="fallback-notice">
                  ⚠️ Using heuristic fallback — train the ML model for accurate results.
                </div>
              )}
            </div>
          )}

          <div className="capture-actions">
            <button className="retake-btn" onClick={retake}>↩ Retake</button>
            {!result && (
              <button className={`analyse-btn ${loading ? 'loading' : ''}`} onClick={analyseCapture} disabled={loading}>
                {loading ? <><span className="spinner" /> Analysing...</> : '🔍 Analyse Capture'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={cvRef} style={{ display: 'none' }} />
    </div>
  );
}
