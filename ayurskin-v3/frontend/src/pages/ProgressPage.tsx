import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { progressApi, ProgressSnapshot, TrendData, getImageUrl } from '../services/api';

const CONDITION_COLOR: Record<string, string> = {
  acne: '#dc2626', pigmentation: '#9333ea', tanning: '#d97706', normal: '#16a34a',
};
const BAND_COLOR: Record<string, string> = {
  clear: '#16a34a', mild: '#d97706', moderate: '#ea580c', severe: '#dc2626',
};

// Custom tooltip for the chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.date}</div>
      <div>Severity: <strong style={{ color: BAND_COLOR[d.band] || '#374151' }}>{d.severityScore}/100</strong></div>
      <div style={{ textTransform: 'capitalize', color: CONDITION_COLOR[d.condition] || '#374151' }}>{d.condition}</div>
      <div style={{ color: '#6b7280', textTransform: 'capitalize' }}>Band: {d.band}</div>
    </div>
  );
};

export default function ProgressPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [trend,     setTrend]     = useState<TrendData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [note,      setNote]      = useState('');
  const [file,      setFile]      = useState<File | null>(null);
  const [preview,   setPreview]   = useState<string | null>(null);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  const fetchAll = async () => {
    try {
      const [snaps, trendData] = await Promise.all([
        progressApi.list(),
        progressApi.getTrend(),
      ]);
      setSnapshots(snaps);
      setTrend(trendData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('Please select an image.'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a photo.'); return; }
    setUploading(true); setError('');
    try {
      await progressApi.createSnapshot(file, note || undefined);
      setSuccess('Progress photo saved and analysed!');
      setFile(null); setPreview(null); setNote('');
      await fetchAll();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this progress photo?')) return;
    try {
      await progressApi.delete(id);
      setSnapshots(s => s.filter(x => x._id !== id));
    } catch (err: any) { setError(err.message); }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const trendIcon = trend?.direction === 'improving' ? '📉' : trend?.direction === 'worsening' ? '📈' : '➡️';
  const trendColor = trend?.direction === 'improving' ? '#16a34a' : trend?.direction === 'worsening' ? '#dc2626' : '#d97706';

  return (
    <div className="progress-page">
      <div className="page-header">
        <h2>📈 Progress Tracker</h2>
        <p>Track your skin improvement over time with photos and severity charts</p>
      </div>

      {/* Trend Summary */}
      {trend?.hasData && (
        <div className="trend-summary card">
          <div className="trend-cards">
            <div className="trend-card">
              <div className="trend-icon">{trendIcon}</div>
              <div className="trend-label">Trend</div>
              <div className="trend-val" style={{ color: trendColor, textTransform: 'capitalize' }}>
                {trend.direction}
              </div>
            </div>
            <div className="trend-card">
              <div className="trend-icon">📊</div>
              <div className="trend-label">Current Severity</div>
              <div className="trend-val" style={{ color: BAND_COLOR[trend.band || 'clear'] }}>
                {trend.severityScore}/100 ({trend.band})
              </div>
            </div>
            <div className="trend-card">
              <div className="trend-icon">📅</div>
              <div className="trend-label">Week-over-Week</div>
              <div className="trend-val" style={{ color: (trend.weekOverWeekChange || 0) <= 0 ? '#16a34a' : '#dc2626' }}>
                {(trend.weekOverWeekChange || 0) > 0 ? '+' : ''}{trend.weekOverWeekChange}%
              </div>
            </div>
            <div className="trend-card">
              <div className="trend-icon">🔢</div>
              <div className="trend-label">Data Points</div>
              <div className="trend-val">{trend.dataPoints} analyses</div>
            </div>
          </div>

          {trend.insight && (
            <div className="trend-insight">{trend.insight}</div>
          )}

          {trend.alert?.triggered && (
            <div className={`trend-alert alert-${trend.alert.level}`}>
              <strong>⚠️ {trend.alert.message}</strong>
              <p>{trend.alert.actionRequired}</p>
              {trend.alert.showDermatologistCard && (
                <div className="dermat-card">
                  🏥 Consider consulting a qualified dermatologist if no improvement in 3 weeks.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Severity Chart */}
      {trend?.hasData && trend.timeline && trend.timeline.length >= 2 && (
        <div className="chart-card card">
          <h3>📉 Skin Severity Over Time</h3>
          <p className="chart-sub">Lower score = clearer skin. 0 = perfect, 100 = severe</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend.timeline} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="severityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }}
                tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={50} stroke="#d97706" strokeDasharray="4 4" label={{ value: 'Mild', fontSize: 10 }} />
              <ReferenceLine y={75} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'Severe', fontSize: 10 }} />
              <Area type="monotone" dataKey="severityScore" stroke="#16a34a" strokeWidth={2.5}
                fill="url(#severityGrad)" dot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }}
                activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Upload New Snapshot */}
      <div className="upload-card card">
        <h3>Add Progress Photo</h3>
        <div className="progress-upload-row">
          <div className={`progress-dropzone ${preview ? 'has-preview' : ''}`} onClick={() => fileRef.current?.click()}>
            {preview
              ? <img src={preview} alt="preview" className="progress-preview-img" />
              : <div className="progress-dropzone-inner"><span>📸</span><p>Click to upload</p></div>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden-input"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <div className="progress-upload-meta">
            <textarea placeholder="Add a note (optional) — e.g. Week 3, neem paste routine"
              value={note} onChange={e => setNote(e.target.value)} rows={3} />
            <button className={`upload-btn ${uploading ? 'loading' : ''}`} onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? <><span className="spinner" /> Analysing & Saving...</> : '📤 Save Progress Photo'}
            </button>
          </div>
        </div>
        {error   && <div className="error-banner">⚠️ {error}</div>}
        {success && <div className="success-banner">✅ {success}</div>}
      </div>

      {/* Snapshot Timeline */}
      {loading ? (
        <div className="loading-state">Loading progress history...</div>
      ) : snapshots.length === 0 ? (
        <div className="empty-state card">
          <span className="empty-icon">📷</span>
          <p>No progress photos yet. Upload your first photo above!</p>
        </div>
      ) : (
        <div className="snapshots-grid">
          {snapshots.map((snap, idx) => (
            <div key={snap._id} className="snapshot-card card">
              <div className="snapshot-img-wrapper">
                <img src={getImageUrl(snap.imageUrl)} alt={`Progress ${idx + 1}`} className="snapshot-img" />
                <div className="snapshot-overlay">
                  <button className="delete-btn" onClick={() => handleDelete(snap._id)}>🗑</button>
                </div>
                <div className="snapshot-date-badge">{fmtDate(snap.createdAt)}</div>
              </div>

              {snap.analysisResult && (
                <div className="snapshot-condition"
                  style={{ background: CONDITION_COLOR[snap.analysisResult.condition] + '18',
                           borderLeft: `3px solid ${CONDITION_COLOR[snap.analysisResult.condition]}` }}>
                  <strong style={{ color: CONDITION_COLOR[snap.analysisResult.condition] }}>
                    {snap.analysisResult.condition.charAt(0).toUpperCase() + snap.analysisResult.condition.slice(1)}
                  </strong>
                  <span> · {snap.analysisResult.confidence.toFixed(1)}% confidence</span>
                </div>
              )}

              {snap.severityScore != null && (
                <div className="snapshot-severity">
                  Severity: <strong style={{ color: BAND_COLOR[snap.severityBand || 'clear'] }}>
                    {snap.severityScore}/100 ({snap.severityBand})
                  </strong>
                </div>
              )}

              {snap.note && <p className="snapshot-note">"{snap.note}"</p>}

              {snap.comparisonWithPrevious && (
                <div className="comparison-block">
                  <h5>vs Previous Photo</h5>
                  <div className="comparison-metrics">
                    <div className="metric">
                      <span className="metric-label">Acne reduction</span>
                      <span className={`metric-value ${snap.comparisonWithPrevious.acneReduction > 0 ? 'positive' : 'neutral'}`}>
                        {snap.comparisonWithPrevious.acneReduction > 0 ? '↓ ' : '— '}
                        {Math.abs(snap.comparisonWithPrevious.acneReduction).toFixed(1)}%
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Brightness</span>
                      <span className={`metric-value ${snap.comparisonWithPrevious.brightnessImprovement > 0 ? 'positive' : 'neutral'}`}>
                        {snap.comparisonWithPrevious.brightnessImprovement > 0 ? '↑' : '↓'}
                        {Math.abs(snap.comparisonWithPrevious.brightnessImprovement).toFixed(1)}
                      </span>
                    </div>
                    {snap.comparisonWithPrevious.overallImprovement && (
                      <div className="metric overall-win">🎉 Overall condition improved!</div>
                    )}
                  </div>
                  <ul className="comparison-insights">
                    {snap.comparisonWithPrevious.insights.map((ins, i) => <li key={i}>• {ins}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
