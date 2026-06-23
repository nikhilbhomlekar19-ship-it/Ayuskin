import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { HabitLog } from '../models/HabitLog';
import { SkinAnalysis } from '../models/SkinAnalysis';
import { computeHabitCorrelations, HabitLogEntry, SkinSeverityEntry } from '../services/habitCorrelation';
import { recordActivity } from '../services/gamification';

const router = Router();
router.use(authenticate);

// POST /api/habits/log — create or update today's log
router.post('/log', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { waterIntakeLitres, sleepHours, stressLevel, dietType, sugarConsumed, dairyConsumed, exerciseDone, sunExposureMinutes, notes } = req.body;
    if (typeof waterIntakeLitres !== 'number' || typeof sleepHours !== 'number' || typeof stressLevel !== 'number' || !['clean', 'moderate', 'junk'].includes(dietType)) {
      res.status(400).json({ error: 'Invalid habit log data. Required: waterIntakeLitres, sleepHours, stressLevel (1-5), dietType (clean/moderate/junk)' });
      return;
    }
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const log = await HabitLog.findOneAndUpdate(
      { userId: req.userId, date: today },
      { userId: req.userId, date: today, waterIntakeLitres: Math.min(10, Math.max(0, waterIntakeLitres)), sleepHours: Math.min(24, Math.max(0, sleepHours)), stressLevel: Math.min(5, Math.max(1, Math.round(stressLevel))), dietType, sugarConsumed: Boolean(sugarConsumed), dairyConsumed: Boolean(dairyConsumed), exerciseDone: Boolean(exerciseDone), sunExposureMinutes: Math.min(720, Math.max(0, sunExposureMinutes ?? 0)), notes: notes ?? undefined },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const newBadges = await recordActivity(req.userId!, { type: 'habit_log' });
    res.json({ success: true, habitLog: log, newBadges });
  } catch (err: any) {
    console.error('[Habits] POST /log error:', err);
    res.status(500).json({ error: 'Failed to save habit log' });
  }
});

// GET /api/habits/log — get logs for last N days
router.get('/log', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = Math.min(90, parseInt(req.query.days as string || '30', 10));
    const since = new Date(); since.setDate(since.getDate() - days); since.setUTCHours(0, 0, 0, 0);
    const logs = await HabitLog.find({ userId: req.userId, date: { $gte: since } }).sort({ date: 1 }).lean();
    res.json({ logs, count: logs.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch habit logs' });
  }
});

// GET /api/habits/today — get today's log if exists
router.get('/today', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const log = await HabitLog.findOne({ userId: req.userId, date: today }).lean();
    res.json({ log: log || null, hasLogged: !!log });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch today log' });
  }
});

// GET /api/habits/correlation — compute correlations
router.get('/correlation', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const since = new Date(); since.setDate(since.getDate() - 60); since.setUTCHours(0, 0, 0, 0);
    const [habitLogs, analyses] = await Promise.all([
      HabitLog.find({ userId: req.userId, date: { $gte: since } }).sort({ date: 1 }).lean(),
      SkinAnalysis.find({ userId: req.userId, createdAt: { $gte: since } }).sort({ createdAt: 1 }).lean(),
    ]);

    const habitEntries: HabitLogEntry[] = habitLogs.map(h => ({ date: new Date(h.date).toISOString().slice(0, 10), waterIntakeLitres: h.waterIntakeLitres, sleepHours: h.sleepHours, stressLevel: h.stressLevel, dietType: h.dietType, sugarConsumed: h.sugarConsumed, dairyConsumed: h.dairyConsumed, exerciseDone: h.exerciseDone, sunExposureMinutes: h.sunExposureMinutes }));
    const skinEntries: SkinSeverityEntry[] = analyses.map(a => ({ date: new Date(a.createdAt).toISOString().slice(0, 10), severityScore: (a.recommendations as any)?.severityScore ?? 0, condition: a.condition }));

    const report = computeHabitCorrelations(req.userId!, habitEntries, skinEntries);
    res.json(report);
  } catch (err) {
    console.error('[Habits] GET /correlation error:', err);
    res.status(500).json({ error: 'Failed to compute correlations' });
  }
});

export default router;
