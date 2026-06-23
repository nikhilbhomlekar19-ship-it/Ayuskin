import React, { useState, useEffect } from 'react';
import { habitsApi } from '../services/api';

const DIET_OPTIONS = [
  { value: 'clean', label: '🥗 Clean', desc: 'Mostly home-cooked, vegetables, dal' },
  { value: 'moderate', label: '🍱 Moderate', desc: 'Mix of healthy and processed' },
  { value: 'junk', label: '🍔 Junk', desc: 'Mostly processed, fried, fast food' },
];

export default function HabitsPage() {
  const [todayLog, setTodayLog] = useState<HabitLog | null>(null);
  const [hasLogged, setHasLogged] = useState(false);
  const [recentLogs, setRecentLogs] = useState<HabitLog[]>([]);
  const [correlation, setCorrelation] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'insights'>('log');

  // Form state
  const [water, setWater] = useState(2.0);
  const [sleep, setSleep] = useState(7.5);
  const [stress, setStress] = useState(2);
  const [diet, setDiet] = useState<'clean' | 'moderate' | 'junk'>('moderate');
  const [sugar, setSugar] = useState(false);
  const [dairy, setDairy] = useState(false);
  const [exercise, setExercise] = useState(false);
  const [sun, setSun] = useState(30);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [todayRes, logsRes] = await Promise.all([
        habitsApi.getToday(),
        habitsApi.getLogs(30),
      ]);
      setHasLogged(todayRes.hasLogged);
      if (todayRes.log) {
        setTodayLog(todayRes.log);
        prefillForm(todayRes.log);
      }
      setRecentLogs(logsRes.logs);
      // Load correlations in background
      habitsApi.getCorrelation().then(setCorrelation).catch(() => {});
    } catch (e) {}
  }

  function prefillForm(log: HabitLog) {
    setWater(log.waterIntakeLitres);
    setSleep(log.sleepHours);
    setStress(log.stressLevel);
    setDiet(log.dietType);
    setSugar(log.sugarConsumed);
    setDairy(log.dairyConsumed);
    setExercise(log.exerciseDone);
    setSun(log.sunExposureMinutes);
    setNotes(log.notes || '');
  }

  async function handleSave() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await habitsApi.logHabits({ waterIntakeLitres: water, sleepHours: sleep, stressLevel: stress, dietType: diet, sugarConsumed: sugar, dairyConsumed: dairy, exerciseDone: exercise, sunExposureMinutes: sun, notes });
      setSuccess(hasLogged ? '✅ Log updated!' : '✅ Log saved! Keep it up!');
      setHasLogged(true);
      setTodayLog(res.habitLog);
      if (res.newBadges?.length > 0) setSuccess(`✅ Log saved! 🏆 Badge earned: ${res.newBadges.map((b: any) => b.emoji + ' ' + b.name).join(', ')}`);
      setTimeout(() => setSuccess(''), 5000);
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  const stressLabels = ['', '😌 Very Low', '🙂 Low', '😐 Moderate', '😟 High', '😫 Very High'];

  return (
    <div className="habits-page">
      <div className="page-header">
        <h2>📋 Daily Habit Tracker</h2>
        <p>Log your lifestyle habits to discover what's affecting your skin</p>
      </div>

      <div className="habit-tabs">
        {(['log', 'history', 'insights'] as const).map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'log' ? '📝 Today' : t === 'history' ? '📅 History' : '💡 Insights'}
          </button>
        ))}
      </div>

      {activeTab === 'log' && (
        <div className="habit-form card">
          <div className="habit-form-header">
            <h3>Today's Check-In {hasLogged && <span className="logged-badge">✓ Logged</span>}</h3>
            <p style={{ color: '#666', fontSize: 13 }}>Takes about 60 seconds</p>
          </div>

          <div className="habit-grid">
            {/* Water */}
            <div className="habit-field">
              <label>💧 Water Intake: <strong>{water.toFixed(1)}L</strong></label>
              <input type="range" min={0} max={5} step={0.1} value={water} onChange={e => setWater(parseFloat(e.target.value))} className="habit-slider" />
              <div className="slider-labels"><span>0L</span><span>2.5L (goal)</span><span>5L</span></div>
            </div>

            {/* Sleep */}
            <div className="habit-field">
              <label>😴 Sleep: <strong>{sleep.toFixed(1)} hours</strong></label>
              <input type="range" min={0} max={12} step={0.5} value={sleep} onChange={e => setSleep(parseFloat(e.target.value))} className="habit-slider" />
              <div className="slider-labels"><span>0h</span><span>7.5h (goal)</span><span>12h</span></div>
            </div>

            {/* Stress */}
            <div className="habit-field">
              <label>🧠 Stress Level: <strong>{stressLabels[stress]}</strong></label>
              <input type="range" min={1} max={5} step={1} value={stress} onChange={e => setStress(parseInt(e.target.value))} className="habit-slider stress-slider" />
              <div className="slider-labels"><span>Low</span><span>High</span></div>
            </div>

            {/* Sun */}
            <div className="habit-field">
              <label>☀️ Sun Exposure: <strong>{sun} min</strong></label>
              <input type="range" min={0} max={180} step={5} value={sun} onChange={e => setSun(parseInt(e.target.value))} className="habit-slider" />
              <div className="slider-labels"><span>0</span><span>30 min</span><span>3h+</span></div>
            </div>

            {/* Diet */}
            <div className="habit-field full-width">
              <label>🍽️ Diet Quality Today</label>
              <div className="diet-options">
                {DIET_OPTIONS.map(opt => (
                  <button key={opt.value} className={`diet-btn ${diet === opt.value ? 'active' : ''}`} onClick={() => setDiet(opt.value as any)}>
                    <span className="diet-label">{opt.label}</span>
                    <span className="diet-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="habit-toggles full-width">
              {[
                { label: '🍬 Consumed Sugar', value: sugar, set: setSugar },
                { label: '🥛 Consumed Dairy', value: dairy, set: setDairy },
                { label: '🏃 Did Exercise', value: exercise, set: setExercise },
              ].map(item => (
                <button key={item.label} className={`toggle-btn ${item.value ? 'on' : 'off'}`} onClick={() => item.set(!item.value)}>
                  <span className="toggle-indicator">{item.value ? '✓' : '○'}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Notes */}
            <div className="habit-field full-width">
              <label>📝 Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Feeling stressed from exams, ate outside..." rows={2} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, resize: 'none' }} />
            </div>
          </div>

          {error && <div className="error-banner">⚠️ {error}</div>}
          {success && <div className="success-banner">{success}</div>}

          <button className={`save-habit-btn ${saving ? 'loading' : ''}`} onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving...' : hasLogged ? '🔄 Update Log' : '💾 Save Today\'s Log'}
          </button>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="habit-history">
          {recentLogs.length === 0 ? (
            <div className="empty-state card"><span className="empty-icon">📋</span><p>No habit logs yet. Start logging daily for best results!</p></div>
          ) : (
            <div className="habit-history-grid">
              {recentLogs.slice().reverse().map(log => (
                <div key={log._id} className="habit-history-card card">
                  <div className="habit-history-date">{new Date(log.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                  <div className="habit-history-row"><span>💧</span><span>{log.waterIntakeLitres.toFixed(1)}L water</span></div>
                  <div className="habit-history-row"><span>😴</span><span>{log.sleepHours}h sleep</span></div>
                  <div className="habit-history-row"><span>🧠</span><span>Stress: {stressLabels[log.stressLevel]?.split(' ')[1] || log.stressLevel}</span></div>
                  <div className="habit-history-row"><span>🍽️</span><span>{log.dietType}</span></div>
                  <div className="habit-history-chips">
                    {log.exerciseDone && <span className="habit-chip green">🏃 Exercise</span>}
                    {log.sugarConsumed && <span className="habit-chip red">🍬 Sugar</span>}
                    {log.dairyConsumed && <span className="habit-chip yellow">🥛 Dairy</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="habit-insights">
          {!correlation || !correlation.sufficientData ? (
            <div className="insight-notice card">
              <div style={{ fontSize: 40 }}>🔬</div>
              <h3>Building Your Insights...</h3>
              <p>{correlation?.dataMessage || 'Log your habits daily and upload skin analyses for at least 7 days. Then come back here for personalised correlations!'}</p>
              <div className="insight-progress">
                <div className="insight-progress-bar" style={{ width: `${Math.min(100, ((correlation?.sampleSize || 0) / 7) * 100)}%` }} />
              </div>
              <p style={{ fontSize: 12, color: '#888' }}>{correlation?.sampleSize || 0} / 7 days needed</p>
            </div>
          ) : (
            <>
              {correlation.topNegativeInsight && (
                <div className="insight-card card green-border">
                  <div className="insight-icon">🎯</div>
                  <h4>Top Positive Factor</h4>
                  <p>{correlation.topNegativeInsight}</p>
                </div>
              )}
              {correlation.topPositiveInsight && (
                <div className="insight-card card red-border">
                  <div className="insight-icon">⚠️</div>
                  <h4>Top Risk Factor</h4>
                  <p>{correlation.topPositiveInsight}</p>
                </div>
              )}
              <div className="correlation-list card">
                <h4>All Correlations</h4>
                {correlation.correlations.map((c: any) => (
                  <div key={c.habitDimension} className={`correlation-row ${c.isSignificant ? 'significant' : ''}`}>
                    <div className="corr-info">
                      <span className="corr-name">{c.displayName}</span>
                      <span className="corr-strength">{c.strength !== 'none' ? c.strength : 'weak'}</span>
                    </div>
                    <div className="corr-bar-wrapper">
                      <div className="corr-bar" style={{ width: `${Math.abs(c.pearsonR) * 100}%`, background: c.pearsonR < 0 ? '#27ae60' : '#e74c3c' }} />
                    </div>
                    <span className="corr-value" style={{ color: c.pearsonR < 0 ? '#27ae60' : c.pearsonR > 0 ? '#e74c3c' : '#888' }}>
                      {c.pearsonR > 0 ? '+' : ''}{(c.pearsonR * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
              {correlation.weeklyGoalRecommendations?.length > 0 && (
                <div className="weekly-goals card">
                  <h4>🎯 This Week's Goals</h4>
                  {correlation.weeklyGoalRecommendations.map((g: string, i: number) => (
                    <div key={i} className="goal-item">✓ {g}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
