import React from 'react';

type Tab = 'remedies' | 'diet' | 'exercises' | 'packs' | 'lifestyle' | 'routine';

interface Props {
  tab: Tab;
  recommendations: any;
  condition: string;
}

// ── Remedy Card ───────────────────────────────────────────────────────────────
function RemedyCard({ remedy }: { remedy: any }) {
  return (
    <div className="remedy-card">
      <h4 className="remedy-name">🌿 {remedy.name}</h4>
      <div className="remedy-section">
        <strong>Ingredients:</strong>
        <ul>{(remedy.ingredients || []).map((ing: string, i: number) => <li key={i}>{ing}</li>)}</ul>
      </div>
      <div className="remedy-section"><strong>Preparation:</strong> <p>{remedy.preparation}</p></div>
      <div className="remedy-section"><strong>Application:</strong> <p>{remedy.application}</p></div>
      <div className="remedy-section"><strong>Frequency:</strong> <span className="freq-badge">{remedy.frequency}</span></div>
      {remedy.benefits && (
        <div className="remedy-section">
          <strong>Why it works:</strong>
          <ul>{remedy.benefits.map((b: string, i: number) => <li key={i}>✓ {b}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ── Diet Day Card ─────────────────────────────────────────────────────────────
function DietDayCard({ day }: { day: any }) {
  const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return (
    <div className="diet-day-card">
      <div className="diet-day-header">Day {day.day} — {DAYS[day.day] || `Day ${day.day}`}</div>
      <div className="diet-meals">
        {[
          { label: '🌅 Morning',   val: day.morning },
          { label: '🍳 Breakfast', val: day.breakfast },
          { label: '🥘 Lunch',     val: day.lunch },
          { label: '🍎 Snack',     val: day.snack },
          { label: '🌙 Dinner',    val: day.dinner },
        ].map(m => (
          <div key={m.label} className="diet-meal-row">
            <span className="meal-label">{m.label}</span>
            <span className="meal-val">{m.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Exercise Card ─────────────────────────────────────────────────────────────
function ExerciseCard({ ex }: { ex: any }) {
  const mins = Math.floor(ex.durationSeconds / 60);
  const secs = ex.durationSeconds % 60;
  return (
    <div className="exercise-card">
      <div className="exercise-header">
        <div>
          <h4>{ex.name}</h4>
          <span className="ayurvedic-name">{ex.ayurvedicName}</span>
        </div>
        <div className="exercise-meta">
          <span className="duration">{mins > 0 ? `${mins}m ` : ''}{secs > 0 ? `${secs}s` : ''}</span>
          <span className="reps">{ex.repetitions}× reps</span>
        </div>
      </div>
      <p className="exercise-desc">{ex.description}</p>
      <ol className="exercise-steps">
        {(ex.steps || []).map((s: string, i: number) => <li key={i}>{s}</li>)}
      </ol>
      {ex.benefits && (
        <div className="exercise-benefits">
          {ex.benefits.map((b: string, i: number) => <span key={i} className="benefit-tag">✓ {b}</span>)}
        </div>
      )}
    </div>
  );
}

// ── Routine Tab ───────────────────────────────────────────────────────────────
function RoutineTab({ routine }: { routine: { morning: string[]; night: string[] } | undefined }) {
  if (!routine) return <p className="empty-tab">Routine not available for this analysis. Re-analyse to generate.</p>;
  return (
    <div className="routine-tab">
      <div className="routine-col">
        <div className="routine-col-header morning-header">☀️ Morning Routine</div>
        <div className="routine-steps">
          {routine.morning.map((step, i) => (
            <div key={i} className="routine-step morning">
              <span className="step-num">{i + 1}</span>
              <span className="step-text">{step}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="routine-col">
        <div className="routine-col-header night-header">🌙 Night Routine</div>
        <div className="routine-steps">
          {routine.night.map((step, i) => (
            <div key={i} className="routine-step night">
              <span className="step-num">{i + 1}</span>
              <span className="step-text">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function RecommendationsPanel({ tab, recommendations, condition }: Props) {
  if (!recommendations) return null;

  switch (tab) {
    case 'remedies':
      return (
        <div className="tab-panel">
          {(recommendations.remedies || []).map((r: any, i: number) => (
            <RemedyCard key={i} remedy={r} />
          ))}
          {(recommendations.remedies || []).length === 0 && (
            <p className="empty-tab">No remedies available.</p>
          )}
        </div>
      );

    case 'diet': {
      const dp = recommendations.dietPlan;
      if (!dp) return <p className="empty-tab">Diet plan not available.</p>;
      return (
        <div className="tab-panel diet-panel">
          {/* General tips */}
          {dp.generalTips?.length > 0 && (
            <div className="diet-tips-box">
              <h4>📌 Key Principles</h4>
              <ul>{dp.generalTips.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {/* Avoid / Superfoods */}
          <div className="diet-two-col">
            {dp.avoidFoods?.length > 0 && (
              <div className="avoid-box">
                <h4>🚫 Avoid These</h4>
                <ul>{dp.avoidFoods.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul>
              </div>
            )}
            {dp.superfoods?.length > 0 && (
              <div className="super-box">
                <h4>⭐ Superfoods</h4>
                <div className="superfood-pills">
                  {dp.superfoods.map((f: string, i: number) => (
                    <span key={i} className="superfood-pill">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Hydration */}
          {dp.hydration && (
            <div className="hydration-box">
              <strong>💧 Hydration:</strong> {dp.hydration}
            </div>
          )}
          {/* 7-day plan */}
          {dp.days?.length > 0 && (
            <>
              <h4 style={{ margin: '20px 0 12px' }}>📅 7-Day Meal Plan</h4>
              <div className="diet-days-grid">
                {dp.days.map((day: any) => <DietDayCard key={day.day} day={day} />)}
              </div>
            </>
          )}
        </div>
      );
    }

    case 'exercises':
      return (
        <div className="tab-panel">
          {(recommendations.exercises || []).map((ex: any, i: number) => (
            <ExerciseCard key={i} ex={ex} />
          ))}
          {(recommendations.exercises || []).length === 0 && (
            <p className="empty-tab">No exercises available.</p>
          )}
        </div>
      );

    case 'packs':
      return (
        <div className="tab-panel">
          {(recommendations.homemadePacks || []).map((p: any, i: number) => (
            <RemedyCard key={i} remedy={p} />
          ))}
          {(recommendations.homemadePacks || []).length === 0 && (
            <p className="empty-tab">No face pack recipes available.</p>
          )}
        </div>
      );

    case 'lifestyle':
      return (
        <div className="tab-panel lifestyle-panel">
          <div className="lifestyle-section">
            <h4>✅ Recommended Practices</h4>
            <ul>
              {(recommendations.lifestyleTips || []).map((t: string, i: number) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="lifestyle-section avoid-section">
            <h4>🚫 Avoid These Practices</h4>
            <ul>
              {(recommendations.avoidPractices || []).map((t: string, i: number) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
          {recommendations.explainedLogic && (
            <details className="logic-box">
              <summary>📖 Why These Recommendations? (Scientific Basis)</summary>
              <pre className="logic-text">{recommendations.explainedLogic}</pre>
            </details>
          )}
        </div>
      );

    case 'routine':
      return (
        <div className="tab-panel">
          <RoutineTab routine={recommendations.routine} />
        </div>
      );

    default:
      return null;
  }
}
