import React, { useState, useRef, useCallback } from 'react';
import { skinApi, SkinAnalysis, getImageUrl } from '../services/api';
import RecommendationsPanel from '../components/analysis/RecommendationsPanel';
import RegionHeatmap from '../components/analysis/RegionHeatmap';
import SkinTypeCard from '../components/analysis/SkinTypeCard';
import ReportButton from '../components/report/ReportButton';
import LiveCapture from '../components/camera/LiveCapture';

const REGIONS = ['North India','South India','East India','West India','Central India','Northeast India'];
const SEASONS = ['Summer','Monsoon','Autumn','Winter','Spring'];

const CONDITION_META: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  acne:         { emoji: '🔴', label: 'Acne Detected',     color: '#dc2626', bg: '#fef2f2' },
  pigmentation: { emoji: '🟣', label: 'Pigmentation',       color: '#9333ea', bg: '#faf5ff' },
  tanning:      { emoji: '🟡', label: 'Sun Tanning',        color: '#d97706', bg: '#fffbeb' },
  normal:       { emoji: '🟢', label: 'Healthy / Normal',   color: '#16a34a', bg: '#f0fdf4' },
};

type Tab = 'remedies' | 'diet' | 'exercises' | 'packs' | 'lifestyle' | 'routine';

const TABS: { key: Tab; label: string }[] = [
  { key: 'remedies',  label: '🌿 Remedies'  },
  { key: 'diet',      label: '🥗 Diet Plan' },
  { key: 'exercises', label: '🧘 Exercises' },
  { key: 'packs',     label: '🫙 Face Packs'},
  { key: 'lifestyle', label: '💡 Lifestyle' },
  { key: 'routine',   label: '🧴 Routine'   },
];

export default function AnalysisPage() {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [mode,    setMode]    = useState<'upload' | 'camera'>('upload');
  const [preview, setPreview] = useState<string | null>(null);
  const [file,    setFile]    = useState<File | null>(null);
  const [region,  setRegion]  = useState('North India');
  const [season,  setSeason]  = useState('Summer');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState<SkinAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('remedies');
  const [dragOver,  setDragOver]  = useState(false);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('Please upload an image file.'); return; }
    if (f.size > 10 * 1024 * 1024)   { setError('Image must be under 10 MB.'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
    setResult(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleAnalyze = async () => {
    if (!file) { setError('Please select an image first.'); return; }
    setLoading(true); setError('');
    try {
      const res = await skinApi.analyze(file, region, season);
      setResult(res);
      setActiveTab('remedies');
      // Scroll to results
      setTimeout(() => document.querySelector('.results-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleCameraResult = (res: any) => {
    // Convert live capture result into a partial SkinAnalysis shape for display
    if (res?.classification) {
      setResult({
        id:              'live-' + Date.now(),
        condition:       res.classification.condition,
        confidence:      res.classification.confidence,
        probabilities:   res.classification.probabilities || {},
        imageUrl:        '',
        heatmapUrl:      undefined,
        region,
        season,
        skinType:        res.classification.skinType || 'unknown',
        regionAnalysis:  [],
        detectionSummary: res.detection?.summary || [],
        detectionCounts: res.detection?.counts   || {},
        severityScore:   res.classification.severityScore || 0,
        severityBand:    'mild',
        modelType:       res.classification.model_type || 'live',
        isFallback:      res.classification.isFallback || false,
        recommendations: {} as any,
        createdAt:       new Date().toISOString(),
      });
    }
  };

  const condMeta = result ? (CONDITION_META[result.condition] || CONDITION_META.normal) : null;

  return (
    <div className="analysis-page">
      <div className="page-header">
        <h2>🔬 Skin Analysis</h2>
        <p>Upload a photo or use live camera — get AI-powered Ayurvedic analysis with region detection</p>
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle card">
        <button className={`mode-btn ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>
          📁 Upload Photo
        </button>
        <button className={`mode-btn ${mode === 'camera' ? 'active' : ''}`} onClick={() => setMode('camera')}>
          📸 Live Camera
        </button>
      </div>

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div className="upload-section card">
          <div
            className={`dropzone ${dragOver ? 'drag-over' : ''} ${preview ? 'has-preview' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <div className="preview-wrapper">
                <img src={preview} alt="Preview" className="preview-img" />
                <div className="preview-overlay"><span>Click to change image</span></div>
              </div>
            ) : (
              <div className="dropzone-placeholder">
                <div className="dropzone-icon">📸</div>
                <p>Drop your photo here, or <strong>click to browse</strong></p>
                <span className="dropzone-hint">JPEG, PNG, WebP · max 10 MB</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden-input" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

          <div className="upload-controls">
            <div className="select-group">
              <label>Region</label>
              <select value={region} onChange={e => setRegion(e.target.value)}>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="select-group">
              <label>Season</label>
              <select value={season} onChange={e => setSeason(e.target.value)}>
                {SEASONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <button className={`analyze-btn ${loading ? 'loading' : ''}`}
              onClick={handleAnalyze} disabled={!file || loading}>
              {loading ? <><span className="spinner" /> Analysing...</> : '🔍 Analyse Skin'}
            </button>
          </div>
          {error && <div className="error-banner">⚠️ {error}</div>}

          {loading && (
            <div className="analysis-progress">
              <div className="progress-steps">
                {['ML Classification','Skin Type Detection','Region Analysis','Recommendations'].map((step, i) => (
                  <div key={step} className="progress-step">
                    <div className="step-dot animating" style={{ animationDelay: `${i * 0.4}s` }} />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Camera Mode */}
      {mode === 'camera' && (
        <LiveCapture
          onAnalysisComplete={handleCameraResult}
          onClose={() => setMode('upload')}
        />
      )}

      {/* Results */}
      {result && condMeta && (
        <div className="results-section">

          {/* Condition Card */}
          <div className="condition-card card" style={{ borderLeft: `5px solid ${condMeta.color}`, background: condMeta.bg }}>
            <div className="condition-header">
              <div className="condition-left">
                <div className="condition-emoji">{condMeta.emoji}</div>
                <div>
                  <h3 className="condition-label" style={{ color: condMeta.color }}>{condMeta.label}</h3>
                  <p className="condition-sub">
                    Confidence: <strong>{result.confidence.toFixed(1)}%</strong>
                    {' · '}Severity: <strong>{result.severityScore}/100</strong>
                    {' · '}Band: <strong style={{ textTransform: 'capitalize' }}>{result.severityBand}</strong>
                    {result.isFallback && <span className="fallback-badge"> ⚠ Fallback mode</span>}
                  </p>
                </div>
              </div>
              <div className="prob-bars">
                {Object.entries(result.probabilities).map(([cls, prob]) => (
                  <div key={cls} className="prob-row">
                    <span className="prob-label">{cls}</span>
                    <div className="prob-track">
                      <div className="prob-fill"
                        style={{ width: `${prob}%`, background: cls === result.condition ? condMeta.color : '#d1d5db' }} />
                    </div>
                    <span className="prob-pct">{Number(prob).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detection summary */}
            {result.detectionSummary?.length > 0 && (
              <div className="detection-summary">
                {result.detectionSummary.map((s, i) => <div key={i} className="det-line">📍 {s}</div>)}
              </div>
            )}
          </div>

          {/* Skin Type */}
          <SkinTypeCard skinType={result.skinType} metrics={result.skinTypeMetrics} />

          {/* Region Heatmap */}
          <div className="card">
            <RegionHeatmap heatmapUrl={result.heatmapUrl} regions={result.regionAnalysis || []} />
          </div>

          {/* Recommendation Tabs */}
          <div className="rec-tabs card">
            <div className="tab-bar">
              {TABS.map(t => (
                <button key={t.key}
                  className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="tab-content">
              <RecommendationsPanel tab={activeTab} recommendations={result.recommendations} condition={result.condition} />
            </div>
          </div>

          {/* PDF Report — only for saved analyses (have real id) */}
          {result.id && !result.id.startsWith('live-') && (
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>📄 Dermatology Report</h3>
              <ReportButton analysisId={result.id} />
            </div>
          )}

        </div>
      )}
    </div>
  );
}
