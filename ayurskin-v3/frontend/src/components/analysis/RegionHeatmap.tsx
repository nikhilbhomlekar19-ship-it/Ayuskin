import React from 'react';
import { RegionResult, getImageUrl } from '../../services/api';

const CONDITION_STYLE: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
  acne:         { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', emoji: '🔴' },
  pigmentation: { bg: '#faf5ff', border: '#d8b4fe', text: '#9333ea', emoji: '🟣' },
  tanning:      { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', emoji: '🟡' },
  normal:       { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', emoji: '🟢' },
};

interface Props {
  heatmapUrl?: string;
  regions: RegionResult[];
}

export default function RegionHeatmap({ heatmapUrl, regions }: Props) {
  if (regions.length === 0 && !heatmapUrl) {
    return (
      <div className="region-empty">
        <p>⚠️ Region analysis not available — ensure the region analysis service (port 5003) is running and face is clearly visible.</p>
      </div>
    );
  }

  return (
    <div className="region-heatmap">
      <h3>🗺️ Region-Wise Analysis</h3>

      <div className="region-layout">
        {/* Annotated image from Python backend */}
        {heatmapUrl && (
          <div className="heatmap-image-wrapper">
            <img
              src={getImageUrl(heatmapUrl)}
              alt="Region heatmap with annotations"
              className="heatmap-img"
            />
            <div className="heatmap-caption">Colour-coded: 🔴 Acne · 🟣 Pigmentation · 🟡 Tanning · 🟢 Normal</div>
          </div>
        )}

        {/* Region score cards */}
        {regions.length > 0 && (
          <div className="region-cards">
            {regions.map(r => {
              const style = CONDITION_STYLE[r.condition] || CONDITION_STYLE.normal;
              const regionLabel = r.region.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <div
                  key={r.region}
                  className="region-card"
                  style={{ background: style.bg, borderColor: style.border }}
                >
                  <div className="region-card-top">
                    <span className="region-emoji">{style.emoji}</span>
                    <span className="region-label">{regionLabel}</span>
                  </div>
                  <div className="region-condition" style={{ color: style.text }}>
                    {r.condition.charAt(0).toUpperCase() + r.condition.slice(1)}
                  </div>
                  <div className="region-conf">{r.confidence.toFixed(0)}% confidence</div>

                  {/* Mini prob bar */}
                  <div className="region-prob-bar">
                    <div
                      className="region-prob-fill"
                      style={{ width: `${r.confidence}%`, background: style.text }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary insight */}
      {regions.length > 0 && (() => {
        const conditionCount: Record<string, number> = {};
        regions.forEach(r => { conditionCount[r.condition] = (conditionCount[r.condition] || 0) + 1; });
        const dominantCondition = Object.entries(conditionCount).sort((a, b) => b[1] - a[1])[0];
        return (
          <div className="region-insight">
            <strong>📌 Insight:</strong> {dominantCondition[0].charAt(0).toUpperCase() + dominantCondition[0].slice(1)} is detected in {dominantCondition[1]} of {regions.length} facial zones.
            {conditionCount['normal'] === regions.length && ' All zones appear healthy! ✨'}
          </div>
        );
      })()}
    </div>
  );
}
