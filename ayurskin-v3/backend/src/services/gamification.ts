import { GamificationState } from '../models/GamificationState';

export interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  triggerDescription: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: 'first_analysis', name: 'First Step', emoji: '🌱', description: 'Completed your first skin analysis.', triggerDescription: 'Complete 1 skin analysis' },
  { id: 'week_warrior', name: 'Week Warrior', emoji: '🔥', description: 'Maintained a 7-day analysis streak.', triggerDescription: '7-day upload streak' },
  { id: 'hydration_hero', name: 'Hydration Hero', emoji: '💧', description: 'Logged 2L+ water for 5 consecutive days.', triggerDescription: '5 days of 2L+ water' },
  { id: 'skin_improver', name: 'Skin Improver', emoji: '📈', description: 'Reduced severity by 25% from baseline.', triggerDescription: '25% severity reduction' },
  { id: 'ayurveda_explorer', name: 'Ayurveda Explorer', emoji: '🌿', description: 'Tried 5 different Ayurvedic remedies.', triggerDescription: 'Use 5 distinct remedies' },
  { id: 'month_champion', name: 'Month Champion', emoji: '🏆', description: 'Maintained a 30-day streak.', triggerDescription: '30-day streak' },
  { id: 'habit_scientist', name: 'Habit Scientist', emoji: '🔬', description: 'Logged habits for 14 consecutive days.', triggerDescription: '14-day habit log streak' },
  { id: 'consistent_uploader', name: 'Consistent Tracker', emoji: '📸', description: 'Uploaded 10 total analyses.', triggerDescription: '10 total analyses' },
];

export async function recordActivity(userId: string, payload: { type: 'analysis' | 'habit_log' | 'remedy_used'; remedyName?: string; severityScore?: number }): Promise<BadgeDefinition[]> {
  let state = await GamificationState.findOne({ userId });
  if (!state) state = await GamificationState.create({ userId });

  const newlyEarned: BadgeDefinition[] = [];
  const alreadyEarnedIds = new Set(state.earnedBadges.map((b: any) => b.badgeId));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (payload.type === 'analysis') {
    state.totalAnalyses += 1;
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (!state.lastActivityDate) { state.streakDays = 1; }
    else {
      const last = new Date(state.lastActivityDate); last.setHours(0, 0, 0, 0);
      if (last.getTime() === yesterday.getTime()) state.streakDays += 1;
      else if (last.getTime() < yesterday.getTime()) state.streakDays = 1;
    }
    state.lastActivityDate = today;
    state.longestStreak = Math.max(state.longestStreak, state.streakDays);

    if (typeof payload.severityScore === 'number') {
      if (state.baselineSeverity === null) state.baselineSeverity = payload.severityScore;
      const improvement = state.baselineSeverity > 0 ? Math.max(0, ((state.baselineSeverity - payload.severityScore) / state.baselineSeverity) * 100) : 0;
      state.skinScore = Math.round(Math.min(100, improvement));
    }
  } else if (payload.type === 'habit_log') {
    state.totalHabitLogs += 1;
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (!state.lastHabitLogDate) { state.habitLogStreak = 1; }
    else {
      const last = new Date(state.lastHabitLogDate); last.setHours(0, 0, 0, 0);
      if (last.getTime() === yesterday.getTime()) state.habitLogStreak += 1;
      else if (last.getTime() < yesterday.getTime()) state.habitLogStreak = 1;
    }
    state.lastHabitLogDate = today;
    state.longestHabitStreak = Math.max(state.longestHabitStreak, state.habitLogStreak);
  } else if (payload.type === 'remedy_used' && payload.remedyName) {
    if (!state.remediesUsed.includes(payload.remedyName)) state.remediesUsed.push(payload.remedyName);
  }

  const checks = [
    { id: 'first_analysis', earned: state.totalAnalyses >= 1 },
    { id: 'week_warrior', earned: state.streakDays >= 7 },
    { id: 'consistent_uploader', earned: state.totalAnalyses >= 10 },
    { id: 'skin_improver', earned: state.skinScore >= 25 },
    { id: 'ayurveda_explorer', earned: state.remediesUsed.length >= 5 },
    { id: 'month_champion', earned: state.streakDays >= 30 },
    { id: 'habit_scientist', earned: state.habitLogStreak >= 14 },
  ];

  for (const check of checks) {
    if (check.earned && !alreadyEarnedIds.has(check.id)) {
      state.earnedBadges.push({ badgeId: check.id, earnedAt: new Date() });
      const def = BADGE_DEFINITIONS.find(b => b.id === check.id);
      if (def) newlyEarned.push(def);
    }
  }

  state.weeklyGoalProgress = Math.min(100, Math.round(
    (Math.min(state.streakDays, 7) / 7 * 50) + (Math.min(state.habitLogStreak, 7) / 7 * 50)
  ));

  await state.save();
  return newlyEarned;
}

export async function getGamificationState(userId: string) {
  const state = await GamificationState.findOne({ userId }).lean();
  if (!state) return { streakDays: 0, longestStreak: 0, totalAnalyses: 0, skinScore: 0, weeklyGoalProgress: 0, earnedBadges: [], allBadges: BADGE_DEFINITIONS };

  const earnedIds = new Set((state.earnedBadges as any[]).map((b: any) => b.badgeId));
  return {
    streakDays: state.streakDays, longestStreak: state.longestStreak,
    totalAnalyses: state.totalAnalyses, habitLogStreak: state.habitLogStreak,
    skinScore: state.skinScore, weeklyGoalProgress: state.weeklyGoalProgress,
    remediesUsedCount: state.remediesUsed.length,
    allBadges: BADGE_DEFINITIONS.map(b => ({
      ...b, earned: earnedIds.has(b.id),
      earnedAt: (state.earnedBadges as any[]).find((e: any) => e.badgeId === b.id)?.earnedAt ?? null,
    })),
    earnedBadgeCount: state.earnedBadges.length,
  };
}
