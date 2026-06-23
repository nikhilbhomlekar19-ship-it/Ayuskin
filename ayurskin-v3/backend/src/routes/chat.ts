import { Router, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { processMessage, createChatContext, handleAnalysisComplete, ChatContext } from '../services/chatbotEngine';
import { shouldUseLLM, llmChat, UserContextForChat } from '../services/llmChatbot';
import { SkinAnalysis } from '../models/SkinAnalysis';
import { HabitLog } from '../models/HabitLog';
import { User } from '../models/User';
import { detectTrend } from '../services/progressIntelligence';
import { computeHabitCorrelations } from '../services/habitCorrelation';

const router = Router();

// In-memory session store (replace with Redis for production)
const sessions = new Map<string, {
  ctx: ChatContext;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}>();

const ML_URL     = process.env.ML_SERVICE_URL        || 'http://localhost:5001';
const DETECT_URL = process.env.DETECTION_SERVICE_URL || 'http://localhost:5002';

// ─── Multer for live captures ─────────────────────────────────────────────────
const captureDir = path.join(__dirname, '../../uploads/captures');
if (!fs.existsSync(captureDir)) fs.mkdirSync(captureDir, { recursive: true });

const captureStorage = multer.diskStorage({
  destination: captureDir,
  filename: (_req, _file, cb) => cb(null, `capture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`),
});
const upload = multer({ storage: captureStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function callML(imagePath: string) {
  const fd = new FormData();
  fd.append('image', fs.createReadStream(imagePath));
  const res = await axios.post(`${ML_URL}/predict`, fd, { headers: fd.getHeaders(), timeout: 30000 });
  return res.data;
}

async function callDetect(imagePath: string) {
  const fd = new FormData();
  fd.append('image', fs.createReadStream(imagePath));
  const res = await axios.post(`${DETECT_URL}/detect`, fd, { headers: fd.getHeaders(), timeout: 30000 });
  return res.data;
}

async function callDetectB64(b64: string) {
  const res = await axios.post(`${DETECT_URL}/detect/base64`, { image: b64 }, { timeout: 30000 });
  return res.data;
}

async function buildUserContext(userId: string): Promise<UserContextForChat> {
  const [analyses, habitLogs, user] = await Promise.all([
    SkinAnalysis.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    HabitLog.find({ userId }).sort({ date: -1 }).limit(60).lean(),
    User.findById(userId).select('name skinType city age gender').lean(),
  ]);

  const latestA = analyses[0];
  const latestAnalysis = latestA ? {
    date:          new Date(latestA.createdAt).toISOString().slice(0, 10),
    condition:     latestA.condition,
    severityScore: (latestA.recommendations as any)?.severityScore ?? 0,
    confidence:    Math.round(latestA.confidence),
    skinType:      latestA.skinType,
    regionAnalysis: (latestA as any).regionAnalysis || [],
  } : null;

  const snapshots = analyses.map(a => ({
    createdAt:     new Date(a.createdAt),
    severityScore: (a.recommendations as any)?.severityScore ?? 0,
  }));
  const trend = snapshots.length >= 2 ? detectTrend(snapshots) : null;

  const histEntries = habitLogs.map(h => ({
    date: new Date(h.date).toISOString().slice(0, 10),
    waterIntakeLitres: h.waterIntakeLitres,
    sleepHours:        h.sleepHours,
    stressLevel:       h.stressLevel,
    dietType:          h.dietType,
    sugarConsumed:     h.sugarConsumed,
    dairyConsumed:     h.dairyConsumed,
    exerciseDone:      h.exerciseDone,
    sunExposureMinutes: h.sunExposureMinutes,
  }));
  const skinEntries = analyses.map(a => ({
    date:          new Date(a.createdAt).toISOString().slice(0, 10),
    severityScore: (a.recommendations as any)?.severityScore ?? 0,
    condition:     a.condition,
  }));
  const corrReport = computeHabitCorrelations(userId, histEntries, skinEntries);

  const severity = latestAnalysis?.severityScore ?? 0;
  const band = severity <= 25 ? 'clear' : severity <= 50 ? 'mild' : severity <= 75 ? 'moderate' : 'severe';

  return {
    name:     (user as any)?.name || 'there',
    skinType: (user as any)?.skinType || latestA?.skinType || 'unknown',
    city:     (user as any)?.city || 'India',
    age:      (user as any)?.age,
    gender:   (user as any)?.gender,
    env: { humidity: 60, temperature: 28, uvIndex: 6, aqi: 80, season: 'Summer' },
    latestAnalysis,
    trend: trend ? {
      direction:          trend.direction,
      weekOverWeekChange: trend.weekOverWeekChange,
      currentBand:        band,
    } : null,
    analysisHistory: analyses.slice(0, 5).map(a => ({
      date:          new Date(a.createdAt).toISOString().slice(0, 10),
      condition:     a.condition,
      severityScore: (a.recommendations as any)?.severityScore ?? 0,
    })),
    habitCorrelations: corrReport.correlations
      .filter(c => c.isSignificant)
      .slice(0, 3)
      .map(c => ({
        habit:          c.displayName,
        correlationPct: Math.round(c.pearsonR * 100),
        direction:      c.pearsonR < 0 ? 'improves' : 'worsens',
      })),
    topHabitInsight: corrReport.topNegativeInsight ?? corrReport.topPositiveInsight ?? undefined,
  };
}

// ─── POST /api/chat/session ───────────────────────────────────────────────────
router.post('/session', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.body;
    const sid = sessionId || uuidv4();

    if (!sessions.has(sid)) {
      const ctx = createChatContext(req.userId!, sid);
      sessions.set(sid, { ctx, history: [] });
      const greet = processMessage(ctx, 'hello');
      ctx.state = greet.newState;
      sessions.get(sid)!.history.push({ role: 'assistant', content: greet.response });
      return res.json({ sessionId: sid, message: { role: 'assistant', content: greet.response, action: greet.action }, state: ctx.state });
    }

    const sess = sessions.get(sid)!;
    return res.json({ sessionId: sid, history: sess.history.slice(-10), state: sess.ctx.state });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// ─── POST /api/chat/message ───────────────────────────────────────────────────
router.post('/message', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message?.trim()) return res.status(400).json({ error: 'sessionId and message required' });

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { ctx: createChatContext(req.userId!, sessionId), history: [] });
    }

    const sess = sessions.get(sessionId)!;
    sess.history.push({ role: 'user', content: message.trim() });
    if (sess.history.length > 50) sess.history = sess.history.slice(-50);

    let responseText: string;
    let action: any = { type: 'none' };
    let isLLM = false;

    if (shouldUseLLM(message.trim())) {
      isLLM = true;
      try {
        const userCtx = await buildUserContext(req.userId!);
        const llmHistory = sess.history.slice(-10, -1);
        responseText = await llmChat(message.trim(), llmHistory, userCtx);
      } catch (e) {
        // LLM failed — fall back to rule-based
        const r = processMessage(sess.ctx, message.trim());
        responseText = r.response;
        action = r.action;
        sess.ctx.state = r.newState;
      }
    } else {
      const r = processMessage(sess.ctx, message.trim());
      responseText = r.response;
      action = r.action;
      sess.ctx.state = r.newState;
    }

    sess.history.push({ role: 'assistant', content: responseText });
    return res.json({
      message: { role: 'assistant', content: responseText, action, isLLM },
      state: sess.ctx.state,
      slots: sess.ctx.slots,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// ─── DELETE /api/chat/session/:id ─────────────────────────────────────────────
router.delete('/session/:sessionId', authenticate, (req: AuthRequest, res: Response) => {
  sessions.delete(req.params.sessionId);
  res.json({ message: 'Session cleared' });
});

// ─── POST /api/capture/analyze ────────────────────────────────────────────────
// Receives base64 webcam image → ML classify + detect → returns results
router.post('/capture/analyze', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { image, sessionId } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    // Save base64 to temp file
    const b64 = image.includes(',') ? image.split(',')[1] : image;
    const buf  = Buffer.from(b64, 'base64');
    const tmpPath = path.join(captureDir, `tmp_${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, buf);

    const [classRes, detectRes] = await Promise.allSettled([
      callML(tmpPath),
      callDetectB64(image),
    ]);

    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

    const classification = classRes.status === 'fulfilled'
      ? classRes.value
      : { condition: 'normal', confidence: 0, isFallback: true };

    const detection = detectRes.status === 'fulfilled'
      ? detectRes.value
      : { detections: [], counts: {}, summary: [] };

    // Update chatbot session if provided
    if (sessionId && sessions.has(sessionId)) {
      const sess = sessions.get(sessionId)!;
      const msg = handleAnalysisComplete(sess.ctx, classification.condition, detection, 'live_' + Date.now());
      sess.ctx.slots.lastCondition = classification.condition;
      sess.history.push({ role: 'assistant', content: msg.response });
    }

    return res.json({ classification, detection, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Live capture analysis failed' });
  }
});

// ─── POST /api/detect/image ────────────────────────────────────────────────────
router.post('/detect/image', authenticate, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const result = await callDetect(req.file.path);
    return res.json({ ...result, imageUrl: `/uploads/captures/${req.file.filename}` });
  } catch (err: any) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Detection service failed' });
  }
});

// ─── POST /api/detect/base64 ──────────────────────────────────────────────────
router.post('/detect/base64', authenticate, async (req: AuthRequest, res: Response) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });
  try {
    return res.json(await callDetectB64(image));
  } catch (err: any) {
    res.status(500).json({ error: 'Detection failed' });
  }
});

export default router;
