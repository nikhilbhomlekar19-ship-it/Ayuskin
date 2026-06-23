import React, { useState, useEffect } from 'react';
import { skinApi, SkinAnalysisRecord, CompareResult, getImageUrl } from '../services/api';
import ReportButton from '../components/report/ReportButton';

const CONDITION_COLOR: Record<string, string> = {
  acne: '#dc2626', pigmentation: '#9333ea', tanning: '#d97706', normal: '#16a34a',
};
const CONDITION_EMOJI: Record<string, string> = {
  acne: '🔴', pigmentation: '🟣', tanning: '🟡', normal: '🟢',
};

export default function HistoryPage() {
  const [analyses,      setAnalyses]      = useState<SkinAnalysisRecord[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [compareMode,   setCompareMode]   = useState(false);
  const [selected,      setSelected]      = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [comparing,     setComparing]     = useState(false);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [error,         setError]         = useState('');

  useEffect(() => {
    skinApi.list(1, 20)
      .then(d => setAnalyses(d.analyses))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this analysis? This cannot be undone.')) return;
    try {
      await skinApi.delete(id);
      setAnalyses(a => a.filter(x => x._id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e: any) { setError(e.message); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
    setCompareResult(null);
  };

  const handleCompare = async () => {
    if (selected.length !== 2) { setError('Select exactly 2 analyses to compare.'); return; }
    setComparing(true); setError('');
    try {
      const res = await skinApi.compare(selected[0], selected[1]);
      setCompareResult(res);
    } catch (e: any) { setError(e.message); }
    finally { setComparing(false); }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="history-page">
      <div className="page-header">
        <h2>🗂 Analysis History</h2>
        <p>All past skin analyses — tap any card to expand, compare two, or download a PDF report</p>
      </div>

      {/* Toolbar */}
      <div className="history-toolbar">
        <button className={`toolbar-btn ${compareMode ? 'active' : ''}`}
          onClick={() => { setCompareMode(m => !m); setSelected([]); setCompareResult(null); }}>
          {compareMode ? '✕ Cancel Compare' : '⚖ Compare Two'}
        </button>
        {compareMode && selected.length === 2 && (
          <button className="toolbar-btn primary" onClick={handleCompare} disabled={comparing}>
            {comparing ? 'Comparing...' : '🔍 Run Comparison'}
          </button>
        )}
        {compareMode && (
          <span className="select-hint">Select 2 analyses to compare ({selected.length}/2)</span>
        )}
      </div>

      {error && <div className="error-banner">⚠️ {error}</div>}

      {/* Comparison Result */}
      {compareResult && (
        <div className="compare-result card">
          <h3>📊 Comparison Results — {compareResult.daysBetween} days apart</h3>
          <div className="compare-images">
            <div className="compare-side">
              <img src={getImageUrl(compareResult.before.imageUrl)} alt="Before" />
              <div className="compare-label before">
                Before · {fmtDate(compareResult.before.createdAt)}<br />
                <strong style={{ color: CONDITION_COLOR[compareResult.before.condition] }}>
                  {compareResult.before.condition}
                </strong>
              </div>
            </div>
            <div className="compare-arrow">→</div>
            <div className="compare-side">
              <img src={getImageUrl(compareResult.after.imageUrl)} alt="After" />
              <div className="compare-label after">
                After · {fmtDate(compareResult.after.createdAt)}<br />
                <strong style={{ color: CONDITION_COLOR[compareResult.after.condition] }}>
                  {compareResult.after.condition}
                </strong>
              </div>
            </div>
          </div>

          {compareResult.mlComparison?.changes && (
            <div className="compare-metrics">
              {Object.entries(compareResult.mlComparison.changes).map(([key, val]: any) => (
                <div key={key} className={`metric-card ${val.improved ? 'improved' : 'not-improved'}`}>
                  <div className="metric-name">{key.replace(/_/g, ' ')}</div>
                  <div className="metric-values">
                    <span>{Number(val.before).toFixed(1)}</span>
                    <span className="metric-arrow">{val.improved ? '↑' : '↓'}</span>
                    <span>{Number(val.after).toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="compare-insights">
            {compareResult.insights.map((ins, i) => (
              <div key={i} className="insight-item">📌 {ins}</div>
            ))}
          </div>
        </div>
      )}

      {/* History Grid */}
      {loading ? (
        <div className="loading-state">Loading history...</div>
      ) : analyses.length === 0 ? (
        <div className="empty-state card">
          <span className="empty-icon">🔬</span>
          <p>No analyses yet. Head to the Analysis tab to get started!</p>
        </div>
      ) : (
        <div className="history-grid">
          {analyses.map(a => {
            const isExpanded = expandedId === a._id;
            const isSelected = selected.includes(a._id);
            return (
              <div key={a._id}
                className={`history-card card ${compareMode && isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
                onClick={() => compareMode ? toggleSelect(a._id) : setExpandedId(isExpanded ? null : a._id)}>

                {compareMode && (
                  <div className={`select-badge ${isSelected ? 'checked' : ''}`}>
                    {isSelected ? '✓' : '○'}
                  </div>
                )}

                {a.imageUrl && (
                  <img src={getImageUrl(a.imageUrl)} alt="skin" className="history-img" />
                )}

                <div className="history-info">
                  <div className="history-condition" style={{ color: CONDITION_COLOR[a.condition] }}>
                    {CONDITION_EMOJI[a.condition]} {a.condition.charAt(0).toUpperCase() + a.condition.slice(1)}
                  </div>
                  <div className="history-conf">{a.confidence.toFixed(1)}% confidence</div>
                  {(a as any).skinType && (a as any).skinType !== 'unknown' && (
                    <div className="history-skintype">Skin: {(a as any).skinType}</div>
                  )}
                  <div className="history-meta">{a.region} · {a.season}</div>
                  <div className="history-date">{fmtDate(a.createdAt)}</div>
                </div>

                {!compareMode && (
                  <button className="card-delete-btn" onClick={e => { e.stopPropagation(); handleDelete(a._id); }}>
                    🗑
                  </button>
                )}

                {/* Expanded detail */}
                {isExpanded && !compareMode && (
                  <div className="history-expanded" onClick={e => e.stopPropagation()}>
                    {/* Region analysis mini table */}
                    {(a as any).regionAnalysis?.length > 0 && (
                      <div className="history-regions">
                        <strong>Region Analysis</strong>
                        <div className="region-mini-grid">
                          {(a as any).regionAnalysis.map((r: any) => (
                            <div key={r.region} className="region-mini-item"
                              style={{ color: CONDITION_COLOR[r.condition] || '#374151' }}>
                              <span>{r.region.replace('_', ' ')}</span>
                              <span>{r.condition} ({r.confidence.toFixed(0)}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top 2 remedies */}
                    {(a as any).recommendations?.remedies?.slice(0, 1).map((rem: any, i: number) => (
                      <div key={i} className="history-remedy-preview">
                        <strong>🌿 Top Remedy:</strong> {rem.name}
                        <span> — {rem.frequency}</span>
                      </div>
                    ))}

                    {/* PDF report */}
                    <ReportButton analysisId={a._id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
