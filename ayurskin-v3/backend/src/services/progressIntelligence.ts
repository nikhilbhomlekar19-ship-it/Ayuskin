export type SeverityBand = 'clear' | 'mild' | 'moderate' | 'severe';
export type TrendDirection = 'improving' | 'worsening' | 'stable';

export interface SeverityResult {
  score: number;
  band: SeverityBand;
  breakdown: { acneComponent: number; pigmentationComponent: number; tanningComponent: number; detectionComponent: number };
}

export interface TrendResult {
  direction: TrendDirection;
  slope: number;
  weekOverWeekChange: number;
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface AlertStatus {
  level: 'none' | 'info' | 'warning' | 'high' | 'medical';
  triggered: boolean;
  message: string;
  actionRequired: string;
  showDermatologistCard: boolean;
}

export function computeSeverityScore(mlPrediction: any, detectionCounts: any): SeverityResult {
  const probs = mlPrediction?.probabilities || {};
  const counts = detectionCounts || {};
  const acneConf = Math.min(100, probs['acne'] ?? 0);
  const pigConf = Math.min(100, probs['pigmentation'] ?? 0);
  const tanConf = Math.min(100, probs['tanning'] ?? 0);
  const detNorm = Math.min(100, ((counts.total || 0) / 20) * 100);

  const acneComp = 0.40 * acneConf;
  const pigComp = 0.25 * pigConf;
  const tanComp = 0.20 * tanConf;
  const detComp = 0.15 * detNorm;
  const score = Math.min(100, Math.round(acneComp + pigComp + tanComp + detComp));
  const band: SeverityBand = score <= 25 ? 'clear' : score <= 50 ? 'mild' : score <= 75 ? 'moderate' : 'severe';

  return { score, band, breakdown: { acneComponent: Math.round(acneComp), pigmentationComponent: Math.round(pigComp), tanningComponent: Math.round(tanComp), detectionComponent: Math.round(detComp) } };
}

function linearRegressionSlope(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  if (n < 2) return 0;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

export function detectTrend(snapshots: Array<{ createdAt: Date; severityScore: number }>): TrendResult {
  if (snapshots.length < 2) return { direction: 'stable', slope: 0, weekOverWeekChange: 0, dataPoints: snapshots.length, confidence: 'low' };

  const sorted = [...snapshots].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const recent = sorted.slice(-10);
  const first = new Date(recent[0].createdAt);
  const points = recent.map(s => ({ x: (new Date(s.createdAt).getTime() - first.getTime()) / 86400000, y: s.severityScore }));
  const slope = linearRegressionSlope(points);
  const direction: TrendDirection = slope > 0.7 ? 'worsening' : slope < -0.7 ? 'improving' : 'stable';

  const now = new Date(recent[recent.length - 1].createdAt).getTime();
  const oneWeekAgo = now - 7 * 86400000;
  const twoWeeksAgo = now - 14 * 86400000;
  const lastWeek = recent.filter(s => new Date(s.createdAt).getTime() >= oneWeekAgo);
  const priorWeek = recent.filter(s => { const t = new Date(s.createdAt).getTime(); return t >= twoWeeksAgo && t < oneWeekAgo; });
  const avg = (arr: typeof recent) => arr.length ? arr.reduce((s, p) => s + p.severityScore, 0) / arr.length : null;
  const lwAvg = avg(lastWeek), pwAvg = avg(priorWeek);
  const weekOverWeekChange = lwAvg !== null && pwAvg !== null && pwAvg > 0 ? Math.round(((lwAvg - pwAvg) / pwAvg) * 100) : 0;
  const confidence = recent.length >= 6 ? 'high' : recent.length >= 3 ? 'medium' : 'low';

  return { direction, slope: Math.round(slope * 100) / 100, weekOverWeekChange, dataPoints: recent.length, confidence };
}

export function computeAlertStatus(severity: SeverityResult, trend: TrendResult, hasMoleGrowth = false): AlertStatus {
  if (hasMoleGrowth) return { level: 'medical', triggered: true, message: 'A skin mark may have changed. Professional evaluation recommended.', actionRequired: 'Consult a dermatologist. Check ABCDE criteria for moles.', showDermatologistCard: true };
  if (severity.band === 'severe' && trend.direction === 'worsening') return { level: 'high', triggered: true, message: `Severe condition (score: ${severity.score}/100) with worsening trend.`, actionRequired: 'Consider consulting a dermatologist. Review diet and products.', showDermatologistCard: true };
  if (trend.weekOverWeekChange > 25) return { level: 'high', triggered: true, message: `Rapid worsening: severity up ${trend.weekOverWeekChange}% this week.`, actionRequired: 'Check for new products or diet changes introduced this week.', showDermatologistCard: true };
  if (severity.band === 'severe') return { level: 'warning', triggered: true, message: `High severity (${severity.score}/100). Monitor closely.`, actionRequired: 'Maintain remedy consistency. See dermatologist if no improvement in 3 weeks.', showDermatologistCard: true };
  if (severity.band === 'moderate' && trend.direction === 'worsening') return { level: 'warning', triggered: true, message: 'Moderate severity with worsening trend.', actionRequired: 'Review sleep and diet. Ensure consistent remedy application.', showDermatologistCard: false };
  if (severity.band === 'mild') return { level: 'info', triggered: false, message: 'Mild condition. Stay consistent.', actionRequired: 'No immediate action needed.', showDermatologistCard: false };
  return { level: 'none', triggered: false, message: 'Skin looks clear. Great job!', actionRequired: 'Maintain your current routine.', showDermatologistCard: false };
}

export function buildInsightString(severity: SeverityResult, trend: TrendResult, condition: string): string {
  const parts: string[] = [];
  const bandDesc = { clear: 'looking clear', mild: 'showing mild signs', moderate: 'in moderate condition', severe: 'in a severe state' };
  parts.push(`Your skin is currently ${bandDesc[severity.band]} (severity score: ${severity.score}/100).`);

  if (trend.dataPoints >= 3) {
    if (trend.direction === 'improving') parts.push(`Trending positively — ${Math.abs(trend.weekOverWeekChange)}% improvement compared to last week. Keep it up!`);
    else if (trend.direction === 'worsening') parts.push(`Trend alert: severity has increased by ${Math.abs(trend.weekOverWeekChange)}% this week. Consider reviewing your diet and stress levels.`);
    else parts.push(`Your skin has been stable over the last ${trend.dataPoints} snapshots.`);
  } else {
    parts.push('Upload more progress photos for trend analysis — at least 3 snapshots needed.');
  }

  return parts.join(' ');
}
