import React, { useState } from 'react';
import { reportApi, getImageUrl } from '../../services/api';

interface Props { analysisId: string; }

export default function ReportButton({ analysisId }: Props) {
  const [loading,   setLoading]   = useState(false);
  const [pdfUrl,    setPdfUrl]    = useState<string | null>(null);
  const [error,     setError]     = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportApi.generate(analysisId);
      setPdfUrl(res.pdfUrl);
      // Auto-trigger download
      triggerDownload(res.pdfUrl);
    } catch (e: any) {
      setError(e.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = (url: string) => {
    const fullUrl = getImageUrl(url);
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = `ayurskin-report-${analysisId.slice(-8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="report-section">
      {error && <div className="error-banner small">⚠️ {error}</div>}

      <div className="report-btns">
        <button
          className={`report-btn ${loading ? 'loading' : ''}`}
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <><span className="spinner-sm" /> Generating PDF...</>
          ) : (
            <>📄 Download PDF Report</>
          )}
        </button>

        {pdfUrl && (
          <button
            className="report-btn secondary"
            onClick={() => triggerDownload(pdfUrl)}
          >
            ⬇️ Re-download Report
          </button>
        )}
      </div>

      <p className="report-note">
        Includes: diagnosis, region analysis, heatmap, remedies, AM/PM routine, lifestyle tips.
      </p>
    </div>
  );
}
