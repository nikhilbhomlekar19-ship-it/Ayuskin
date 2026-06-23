import React, { useEffect, useState } from 'react';
import { skinApi, progressApi, gamificationApi, SkinAnalysisRecord, ProgressSnapshot, getImageUrl } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const CONDITION_COLOR: Record<string, string> = {
  acne: '#dc2626', pigmentation: '#9333ea', tanning: '#d97706', normal: '#16a34a',
};
const CONDITION_EMOJI: Record<string, string> = {
  acne: '🔴', pigmentation: '🟣', tanning: '🟡', normal: '🟢',
};
const BAND_COLOR: Record<string, string> = {
  clear: '#16a34a', mild: '#d97706', moderate: '#ea580c', severe: '#dc2626',
};

interface GamState {
  streakDays: number;
  totalAnalyses: number;
  skinScore: number;
  weeklyGoalProgress: number;
  habitLogStreak: number;
  allBadges: any[];
  earnedBadgeCount: number;
}

export default function DashboardPage({ setPage }: { setPage: (p: string) => void }) {
  const { user } = useAuth();
  const [analyses,  setAnalyses]  = useState<SkinAnalysisRecord[]>([]);
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [gam,       setGam]       = useState<GamState | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      skinApi.list(1, 4).then(d => setAnalyses(d.analyses)).catch(() => {}),
      progressApi.list().then(d => setSnapshots(d.slice(0, 3))).catch(() => {}),
      gamificationApi.getState().then(d => setGam(d as GamState)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const latest    = analyses[0];
  const latestSev = (latest?.recommendations as any)?.severityScore;
  const latestBand = latestSev != null ? (latestSev <= 25 ? 'clear' : latestSev <= 50 ? 'mild' : latestSev <= 75 ? 'moderate' : 'severe') : null;

  return (
    <div className="dashboard-page">

      {/* Welcome */}
      <div className="dash-welcome">
        <div>
          <h2>Namaste, {user?.name?.split(' ')[0] || 'there'} 🙏</h2>
          <p>Your Ayurvedic skin health summary</p>
        </div>
        {latest && latestBand && (
          <div className="severity-pill" style={{ background: BAND_COLOR[latestBand] + '22', color: BAND_COLOR[latestBand], border: `1px solid ${BAND_COLOR[latestBand]}44` }}>
            {latestBand.charAt(0).toUpperCase() + latestBand.slice(1)} — Severity {latestSev}/100
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card card" onClick={() => setPage('analysis')}>
          <div className="stat-icon">🔬</div>
          <div className="stat-label">Total Analyses</div>
          <div className="stat-value">{analyses.length}</div>
        </div>
        <div className="stat-card card" onClick={() => setPage('progress')}>
          <div className="stat-icon">📸</div>
          <div className="stat-label">Progress Photos</div>
          <div className="stat-value">{snapshots.length}</div>
        </div>
        {gam && (
          <>
            <div className="stat-card card">
              <div className="stat-icon">🔥</div>
              <div className="stat-label">Day Streak</div>
              <div className="stat-value">{gam.streakDays}</div>
            </div>
            <div className="stat-card card">
              <div className="stat-icon">⭐</div>
              <div className="stat-label">Skin Score</div>
              <div className="stat-value">{gam.skinScore}/100</div>
            </div>
          </>
        )}
        {latest && (
          <div className="stat-card card" style={{ borderTop: `3px solid ${CONDITION_COLOR[latest.condition]}` }}>
            <div className="stat-icon">{CONDITION_EMOJI[latest.condition]}</div>
            <div className="stat-label">Latest Condition</div>
            <div className="stat-value" style={{ color: CONDITION_COLOR[latest.condition], fontSize: '1rem' }}>
              {latest.condition.charAt(0).toUpperCase() + latest.condition.slice(1)}
            </div>
          </div>
        )}
      </div>

      {/* Weekly Goal */}
      {gam && (
        <div className="weekly-goal card">
          <div className="goal-header">
            <h3>📅 Weekly Goal Progress</h3>
            <span className="goal-pct">{gam.weeklyGoalProgress}%</span>
          </div>
          <div className="goal-bar-track">
            <div className="goal-bar-fill" style={{ width: `${gam.weeklyGoalProgress}%` }} />
          </div>
          <p className="goal-hint">Upload analyses + log habits daily to earn badges 🏅</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions card">
        <h3>Quick Actions</h3>
        <div className="action-btns">
          <button className="action-btn primary" onClick={() => setPage('analysis')}>
            🔍 New Skin Analysis
          </button>
          <button className="action-btn" onClick={() => setPage('progress')}>
            📈 Add Progress Photo
          </button>
          <button className="action-btn" onClick={() => setPage('habits')}>
            📋 Log Habits
          </button>
          <button className="action-btn" onClick={() => setPage('history')}>
            🗂 View History
          </button>
        </div>
      </div>

      {/* Badges */}
      {gam && gam.allBadges?.length > 0 && (
        <div className="badges-section card">
          <h3>🏅 Badges — {gam.earnedBadgeCount}/{gam.allBadges.length} earned</h3>
          <div className="badges-grid">
            {gam.allBadges.map((b: any) => (
              <div key={b.id} className={`badge-item ${b.earned ? 'earned' : 'locked'}`} title={b.triggerDescription}>
                <span className="badge-emoji">{b.emoji}</span>
                <span className="badge-name">{b.name}</span>
                {b.earned && <span className="badge-check">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Analyses */}
      {!loading && analyses.length > 0 && (
        <div className="dash-section card">
          <div className="section-header">
            <h3>Recent Analyses</h3>
            <button className="see-all-btn" onClick={() => setPage('history')}>See All →</button>
          </div>
          <div className="dash-analyses">
            {analyses.map(a => (
              <div key={a._id} className="dash-analysis-row">
                {a.imageUrl && (
                  <img src={getImageUrl(a.imageUrl)} alt="skin" className="dash-thumb" />
                )}
                <div className="dash-row-info">
                  <span className="dash-condition" style={{ color: CONDITION_COLOR[a.condition] }}>
                    {CONDITION_EMOJI[a.condition]} {a.condition.charAt(0).toUpperCase() + a.condition.slice(1)}
                  </span>
                  <span className="dash-conf">{a.confidence.toFixed(1)}% confidence</span>
                  {(a as any).skinType && (a as any).skinType !== 'unknown' && (
                    <span className="dash-skintype">Skin: {(a as any).skinType}</span>
                  )}
                </div>
                <div className="dash-date">
                  {new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Photos */}
      {!loading && snapshots.length > 0 && (
        <div className="dash-section card">
          <div className="section-header">
            <h3>Progress Photos</h3>
            <button className="see-all-btn" onClick={() => setPage('progress')}>See All →</button>
          </div>
          <div className="dash-progress-row">
            {snapshots.map(s => (
              <div key={s._id} className="dash-progress-thumb">
                <img src={getImageUrl(s.imageUrl)} alt="progress" />
                {s.analysisResult && (
                  <div className="thumb-badge" style={{ background: CONDITION_COLOR[s.analysisResult.condition] }}>
                    {s.analysisResult.condition}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onboarding — no data yet */}
      {!loading && analyses.length === 0 && (
        <div className="onboarding-card card">
          <div className="onboarding-icon">🌿</div>
          <h3>Start Your Ayurvedic Skin Journey</h3>
          <p>
            Upload a photo or use the live camera to get a full skin analysis — including
            region-wise detection, skin type classification, Ayurvedic remedies, a 7-day
            diet plan, and a personalized AM/PM skincare routine.
          </p>
          <button className="action-btn primary large" onClick={() => setPage('analysis')}>
            🔍 Analyse My Skin Now
          </button>
        </div>
      )}
    </div>
  );
}
