import React from 'react';

const SKIN_TYPE_INFO: Record<string, { emoji: string; title: string; traits: string[]; color: string }> = {
  oily:        { emoji: '💧', title: 'Oily Skin', color: '#2563eb', traits: ['Shiny T-zone (forehead, nose, chin)', 'Enlarged pores', 'Prone to blackheads & acne', 'Makeup doesn\'t stay long'] },
  dry:         { emoji: '🏜️', title: 'Dry Skin',  color: '#92400e', traits: ['Tight feeling after washing', 'Flaking or rough patches', 'Fine lines more visible', 'Feels comfortable after moisturiser'] },
  combination: { emoji: '⚖️', title: 'Combination Skin', color: '#7c3aed', traits: ['Oily T-zone, dry cheeks', 'Most common Indian skin type', 'Needs zone-specific care', 'Pores visible near nose'] },
  normal:      { emoji: '✨', title: 'Normal Skin', color: '#16a34a', traits: ['Balanced sebum production', 'Small, barely visible pores', 'Smooth texture, even tone', 'Rarely sensitive or reactive'] },
  unknown:     { emoji: '❓', title: 'Skin Type Unknown', color: '#6b7280', traits: ['Run analysis for classification', 'Or update in your Profile'] },
};

interface Props {
  skinType: string;
  metrics?: Record<string, number>;
}

export default function SkinTypeCard({ skinType, metrics }: Props) {
  const info = SKIN_TYPE_INFO[skinType] || SKIN_TYPE_INFO.unknown;

  return (
    <div className="skin-type-card" style={{ borderColor: info.color }}>
      <div className="skin-type-header">
        <span className="skin-type-emoji">{info.emoji}</span>
        <div>
          <div className="skin-type-label" style={{ color: info.color }}>Skin Type Detected</div>
          <div className="skin-type-name">{info.title}</div>
        </div>
      </div>

      <ul className="skin-type-traits">
        {info.traits.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>

      {metrics && Object.keys(metrics).length > 0 && (
        <div className="skin-metrics">
          <div className="metrics-title">Analysis Metrics</div>
          <div className="metrics-grid">
            {Object.entries(metrics).map(([key, val]) => (
              <div key={key} className="metric-item">
                <span className="metric-key">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="metric-val">{Number(val).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
