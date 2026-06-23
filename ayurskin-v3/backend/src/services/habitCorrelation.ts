export interface HabitLogEntry {
  date: string;
  waterIntakeLitres: number;
  sleepHours: number;
  stressLevel: number;
  dietType: 'clean' | 'moderate' | 'junk';
  sugarConsumed: boolean;
  dairyConsumed: boolean;
  exerciseDone: boolean;
  sunExposureMinutes: number;
}

export interface SkinSeverityEntry {
  date: string;
  severityScore: number;
  condition: string;
}

export interface CorrelationResult {
  habitDimension: string;
  displayName: string;
  pearsonR: number;
  direction: 'positive' | 'negative' | 'none';
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  sampleSize: number;
  insightString: string;
  isSignificant: boolean;
}

export interface HabitCorrelationReport {
  userId: string;
  generatedAt: Date;
  sampleSize: number;
  correlations: CorrelationResult[];
  topPositiveInsight: string | null;
  topNegativeInsight: string | null;
  weeklyGoalRecommendations: string[];
  sufficientData: boolean;
  dataMessage: string;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX, dy = y[i] - meanY;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

function encodeHabit(entry: HabitLogEntry): Record<string, number> {
  return {
    waterIntake: entry.waterIntakeLitres,
    sleepHours: entry.sleepHours,
    stressLevel: entry.stressLevel,
    dietScore: entry.dietType === 'clean' ? 0 : entry.dietType === 'moderate' ? 1 : 2,
    sugarConsumed: entry.sugarConsumed ? 1 : 0,
    dairyConsumed: entry.dairyConsumed ? 1 : 0,
    exerciseSkipped: entry.exerciseDone ? 0 : 1,
    sunExposure: Math.min(entry.sunExposureMinutes, 120),
  };
}

const DISPLAY_NAMES: Record<string, string> = {
  waterIntake: 'Water intake (litres/day)',
  sleepHours: 'Sleep duration (hours)',
  stressLevel: 'Stress level (1-5)',
  dietScore: 'Diet quality (clean→junk)',
  sugarConsumed: 'Sugar consumption',
  dairyConsumed: 'Dairy consumption',
  exerciseSkipped: 'Skipping exercise',
  sunExposure: 'Sun exposure (minutes)',
};

function buildInsight(dim: string, r: number, isSignificant: boolean): string {
  if (!isSignificant) return `No significant correlation between ${DISPLAY_NAMES[dim]?.toLowerCase()} and skin condition yet.`;
  const pct = Math.abs(Math.round(r * 100));
  if (dim === 'waterIntake' && r < 0) return `Higher water intake correlates with ${pct}% clearer skin. Days you drink more consistently show lower severity.`;
  if (dim === 'stressLevel' && r > 0) return `High stress correlates with ${pct}% worse skin. Cortisol directly triggers sebum overproduction. Pranayama can help.`;
  if (dim === 'sugarConsumed' && r > 0) return `Sugar consumption days show ${pct}% higher skin severity. Try cutting refined sugar for 2 weeks to test this pattern.`;
  if (dim === 'dairyConsumed' && r > 0) return `Dairy correlates with ${pct}% higher severity. Consider plant-based alternatives (oat milk, almond milk) for 3 weeks.`;
  if (dim === 'sleepHours' && r < 0) return `More sleep correlates with ${pct}% lower severity. Skin repairs during deep sleep — aim for 7.5–8 hours consistently.`;
  if (dim === 'dietScore' && r > 0) return `Junk food days show ${pct}% higher severity. Even replacing one junk meal/day with dal + vegetables helps.`;
  if (dim === 'exerciseSkipped' && r > 0) return `Skipping exercise correlates with ${pct}% worse skin. Exercise improves circulation and detoxification.`;
  if (dim === 'sunExposure' && r > 0) return `Days with more sun exposure show ${pct}% higher severity. Apply SPF 30+ before going out.`;
  return `${DISPLAY_NAMES[dim]} shows a ${Math.abs(r) >= 0.4 ? 'moderate' : 'weak'} ${r > 0 ? 'positive' : 'negative'} correlation (r=${r.toFixed(2)}).`;
}

export function computeHabitCorrelations(userId: string, habitLogs: HabitLogEntry[], skinEntries: SkinSeverityEntry[]): HabitCorrelationReport {
  const skinByDate = new Map(skinEntries.map(s => [s.date.slice(0, 10), s.severityScore]));
  const habitByDate = new Map(habitLogs.map(h => [h.date.slice(0, 10), h]));
  const overlapping = [...habitByDate.keys()].filter(d => skinByDate.has(d)).sort();
  const sufficientData = overlapping.length >= 7;

  if (!sufficientData) {
    return {
      userId, generatedAt: new Date(), sampleSize: overlapping.length, correlations: [],
      topPositiveInsight: null, topNegativeInsight: null,
      weeklyGoalRecommendations: ['Log habits daily and upload skin photos — 7+ matching days needed for correlations.'],
      sufficientData: false,
      dataMessage: `Only ${overlapping.length} overlapping days found. Need 7+ days of both habit logs and skin analyses.`,
    };
  }

  const severityValues = overlapping.map(d => skinByDate.get(d)!);
  const dims = Object.keys(encodeHabit(habitByDate.get(overlapping[0])!));

  const correlations: CorrelationResult[] = dims.map(dim => {
    const habitValues = overlapping.map(d => encodeHabit(habitByDate.get(d)!)[dim]);
    const r = pearsonCorrelation(habitValues, severityValues);
    const absR = Math.abs(r);
    const strength: CorrelationResult['strength'] = absR >= 0.6 ? 'strong' : absR >= 0.4 ? 'moderate' : absR >= 0.3 ? 'weak' : 'none';
    const isSignificant = absR >= 0.30;
    const direction: CorrelationResult['direction'] = r > 0.05 ? 'positive' : r < -0.05 ? 'negative' : 'none';
    return {
      habitDimension: dim, displayName: DISPLAY_NAMES[dim] ?? dim,
      pearsonR: Math.round(r * 1000) / 1000, direction, strength,
      sampleSize: overlapping.length, isSignificant,
      insightString: buildInsight(dim, r, isSignificant),
    };
  }).sort((a, b) => Math.abs(b.pearsonR) - Math.abs(a.pearsonR));

  const sigPos = correlations.filter(c => c.isSignificant && c.pearsonR > 0);
  const sigNeg = correlations.filter(c => c.isSignificant && c.pearsonR < 0);
  const goals: string[] = [];
  if (correlations.find(c => c.habitDimension === 'waterIntake' && c.pearsonR < -0.3)) goals.push('Goal: Drink 2.5L+ water every day this week.');
  if (correlations.find(c => c.habitDimension === 'stressLevel' && c.pearsonR > 0.3)) goals.push('Goal: 10 min Anulom Vilom pranayama daily to reduce cortisol.');
  if (correlations.find(c => c.habitDimension === 'sugarConsumed' && c.pearsonR > 0.3)) goals.push('Goal: Avoid refined sugar for 7 days and track the difference.');
  if (goals.length === 0) goals.push('Keep logging — no single dominant habit driver identified yet.');

  return {
    userId, generatedAt: new Date(), sampleSize: overlapping.length, correlations,
    topPositiveInsight: sigPos[0]?.insightString ?? null,
    topNegativeInsight: sigNeg[0]?.insightString ?? null,
    weeklyGoalRecommendations: goals, sufficientData: true,
    dataMessage: `Analysis based on ${overlapping.length} days of matching data.`,
  };
}
