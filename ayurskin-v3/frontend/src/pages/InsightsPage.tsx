import React, { useState, useEffect } from 'react';
import { progressApi, gamificationApi } from '../services/api';

const BAND_COLOR: Record<string, string> = { clear: '#27ae60', mild: '#f39c12', moderate: '#e67e22', severe: '#e74c3c' };
const TREND_EMOJI: Record<string, string> = { improving: '📈', worsening: '📉', stable: '➡️' };

export default function InsightsPage() {
  const [trend, setTrend] = useState<any>(null);
  const [gamification, setGamification] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      progressApi.getTrend().then(setTrend).catch(() => {}),
      gamificationApi.getState().then(setGamification).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-state">Loading insights...</div>;

  return (
    <div className="insights-page">
      <div className="page-header">
        <h2>💡 Skin Intelligence</h2>
        <p>AI-powered analysis of your skin trends and progress</p>
      </div>

      {/* Severity + Trend */}
      {trend && (
        <div className="insight-section">
          <div className="trend-summary card">
            <div className="trend-header">
              <div className="trend-icon">{TREND_EMOJI[trend.direction] || '➡️'}</div>
              <div>
                <h3 style={{ color: BAND_COLOR[trend.band] || '#333' }}>
                  {trend.band?.charAt(0).toUpperCase() + trend.band?.slice(1) || 'Unknown'} Skin
                </h3>
                <p>Severity score: <strong>{trend.severityScore ?? '--'}/100</strong></p>
              </div>
              <div className="trend-badge" style={{ background: trend.direction === 'improving' ? '#d5f5e3' : trend.direction === 'worsening' ? '#fde8e8' : '#f0f0f0', color: trend.direction === 'improving' ? '#27ae60' : trend.direction === 'worsening' ? '#e74c3c' : '#666' }}>
                {trend.direction?.charAt(0).toUpperCase() + trend.direction?.slice(1)}
                {trend.weekOverWeekChange !== 0 && ` (${trend.weekOverWeekChange > 0 ? '+' : ''}${trend.weekOverWeekChange}%)`}
              </div>
            </div>
            {trend.insight && <p className="trend-insight">💬 {trend.insight}</p>}
            {trend.alert?.triggered && (
              <div className={`alert-banner alert-${trend.alert.level}`}>
                <strong>⚠️ {trend.alert.message}</strong>
                <p>{trend.alert.actionRequired}</p>
                {trend.alert.showDermatologistCard && (
                  <div className="derm-card">🏥 Consider booking a dermatologist consultation for professional evaluation.</div>
                )}
              </div>
            )}
          </div>

          {/* Severity Timeline */}
          {trend.timeline?.length > 0 && (
            <div className="timeline-card card">
              <h4>Severity Timeline</h4>
              <div className="timeline-chart">
                {trend.timeline.map((point: any, i: number) => (
                  <div key={i} className="timeline-point">
                    <div className="timeline-bar-wrapper">
                      <div className="timeline-bar" style={{ height: `${point.severityScore}%`, background: BAND_COLOR[point.band] || '#ddd' }} title={`${point.condition}: ${point.severityScore}/100`} />
                    </div>
                    <div className="timeline-date">{new Date(point.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                  </div>
                ))}
              </div>
              <div className="timeline-legend">
                {Object.entries(BAND_COLOR).map(([band, color]) => (
                  <span key={band} className="legend-item"><span style={{ background: color, width: 10, height: 10, borderRadius: 2, display: 'inline-block', marginRight: 4 }} />{band}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gamification */}
      {gamification && (
        <div className="gamification-section">
          <div className="stats-row">
            <div className="stat-card card">
              <div className="stat-icon">🔥</div>
              <div className="stat-val">{gamification.streakDays}</div>
              <div className="stat-lbl">Day Streak</div>
            </div>
            <div className="stat-card card">
              <div className="stat-icon">🔬</div>
              <div className="stat-val">{gamification.totalAnalyses}</div>
              <div className="stat-lbl">Analyses</div>
            </div>
            <div className="stat-card card">
              <div className="stat-icon">📈</div>
              <div className="stat-val">{gamification.skinScore}</div>
              <div className="stat-lbl">Skin Score</div>
            </div>
            <div className="stat-card card">
              <div className="stat-icon">🏆</div>
              <div className="stat-val">{gamification.earnedBadgeCount || 0}</div>
              <div className="stat-lbl">Badges</div>
            </div>
          </div>

          {/* Weekly Progress */}
          <div className="weekly-progress card">
            <div className="wp-header">
              <h4>Weekly Goal</h4>
              <span>{gamification.weeklyGoalProgress}%</span>
            </div>
            <div className="wp-bar-bg">
              <div className="wp-bar-fill" style={{ width: `${gamification.weeklyGoalProgress}%` }} />
            </div>
          </div>

          {/* Badges */}
          <div className="badges-grid card">
            <h4>🏅 Achievements</h4>
            <div className="badge-list">
              {gamification.allBadges?.map((badge: any) => (
                <div key={badge.id} className={`badge-item ${badge.earned ? 'earned' : 'locked'}`}>
                  <div className="badge-emoji">{badge.emoji}</div>
                  <div className="badge-info">
                    <div className="badge-name">{badge.name}</div>
                    <div className="badge-desc">{badge.triggerDescription}</div>
                    {badge.earned && badge.earnedAt && (
                      <div className="badge-date">Earned {new Date(badge.earnedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                    )}
                  </div>
                  {badge.earned ? <span className="badge-check">✓</span> : <span className="badge-lock">🔒</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!trend && !gamification && (
        <div className="empty-state card">
          <span className="empty-icon">💡</span>
          <h3>No insights yet</h3>
          <p>Upload skin analyses and log daily habits to see your personalised insights here!</p>
        </div>
      )}
    </div>
  );
}
