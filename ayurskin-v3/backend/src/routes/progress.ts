import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ProgressSnapshot } from '../models/ProgressSnapshot';
import { SkinAnalysis } from '../models/SkinAnalysis';
import { computeSeverityScore, detectTrend, computeAlertStatus, buildInsightString } from '../services/progressIntelligence';
import { recordActivity } from '../services/gamification';

const router = Router();

const progressDir = path.join(__dirname, '../../uploads/progress');
if (!fs.existsSync(progressDir)) fs.mkdirSync(progressDir, { recursive: true });

const storage = multer.diskStorage({
  destination: progressDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `progress_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG/PNG/WebP'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// ─── POST /api/progress/snapshots ────────────────────────────────────────────
router.post('/snapshots', authenticate, upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: 'No image uploaded.' }); return; }
  const { note } = req.body;
  const imageUrl  = `/uploads/progress/${req.file.filename}`;
  const imagePath = req.file.path;

  try {
    let mlPrediction: any = null;
    try {
      const fd = new FormData();
      fd.append('image', fs.createReadStream(imagePath));
      const r = await axios.post(`${ML_URL}/predict`, fd, { headers: fd.getHeaders(), timeout: 20000 });
      mlPrediction = r.data;
    } catch (e) { console.warn('[Progress] ML skipped'); }

    const severityResult = mlPrediction
      ? computeSeverityScore(mlPrediction, { total: 0 })
      : { score: 0, band: 'clear' as const, breakdown: { acneComponent: 0, pigmentationComponent: 0, tanningComponent: 0, detectionComponent: 0 } };

    // Compare with most recent previous snapshot
    const previousSnapshot = await ProgressSnapshot.findOne({ userId: req.userId }).sort({ createdAt: -1 });
    let comparisonWithPrevious: any;

    if (previousSnapshot && previousSnapshot.imagePath && fs.existsSync(previousSnapshot.imagePath)) {
      try {
        const fd = new FormData();
        fd.append('image1', fs.createReadStream(previousSnapshot.imagePath));
        fd.append('image2', fs.createReadStream(imagePath));
        const r = await axios.post(`${ML_URL}/predict/compare`, fd, { headers: fd.getHeaders(), timeout: 30000 });
        const comp = r.data;
        const insights: string[] = [];
        if (comp.insights?.acne_reduction > 5)       insights.push(`Acne reduction: ${comp.insights.acne_reduction.toFixed(1)}% improvement`);
        if (comp.changes?.brightness?.improved)      insights.push('Skin brightness improved');
        if (comp.insights?.overall_improvement)      insights.push('Overall condition improved to normal');
        if (insights.length === 0)                   insights.push('Keep following your skincare routine consistently');
        comparisonWithPrevious = {
          previousSnapshotId:   previousSnapshot._id,
          acneReduction:        comp.insights?.acne_reduction || 0,
          brightnessImprovement: comp.changes?.brightness?.change || 0,
          uniformityImprovement: comp.changes?.uniformity?.change || 0,
          overallImprovement:   comp.insights?.overall_improvement || false,
          insights,
        };
      } catch (e) { console.warn('[Progress] Compare failed'); }
    }

    const snapshot = new ProgressSnapshot({
      userId: req.userId,
      imageUrl,
      imagePath,
      note,
      analysisResult: mlPrediction
        ? { condition: mlPrediction.condition, confidence: mlPrediction.confidence, probabilities: mlPrediction.probabilities }
        : undefined,
      comparisonWithPrevious,
    });
    await snapshot.save();
    await recordActivity(req.userId!, { type: 'analysis', severityScore: severityResult.score });

    res.status(201).json({ ...snapshot.toObject(), severityScore: severityResult.score, severityBand: severityResult.band });
  } catch (err) {
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    console.error('[Progress] Error:', err);
    res.status(500).json({ error: 'Failed to save progress snapshot.' });
  }
});

// ─── GET /api/progress/snapshots ─────────────────────────────────────────────
router.get('/snapshots', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const snapshots = await ProgressSnapshot.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select('-imagePath');
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch snapshots.' });
  }
});

// ─── DELETE /api/progress/snapshots/:id ──────────────────────────────────────
router.delete('/snapshots/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const s = await ProgressSnapshot.findOne({ _id: req.params.id, userId: req.userId });
    if (!s) { res.status(404).json({ error: 'Not found.' }); return; }
    if (s.imagePath && fs.existsSync(s.imagePath)) fs.unlinkSync(s.imagePath);
    await s.deleteOne();
    res.json({ message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete.' });
  }
});

// ─── GET /api/progress/trend ─────────────────────────────────────────────────
router.get('/trend', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analyses = await SkinAnalysis.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    if (analyses.length === 0) {
      res.json({ hasData: false, message: 'No analyses yet. Upload a skin photo to start tracking!' });
      return;
    }

    const latest = analyses[0];
    const severityResult = computeSeverityScore(
      { condition: latest.condition, confidence: latest.confidence, probabilities: latest.probabilities },
      { total: 0 }
    );

    const snapshots = analyses.map(a => ({
      createdAt:     new Date(a.createdAt),
      severityScore: (a.recommendations as any)?.severityScore ?? severityResult.score,
    }));

    const trend  = detectTrend(snapshots);
    const alert  = computeAlertStatus(severityResult, trend);
    const insight = buildInsightString(severityResult, trend, latest.condition);

    // Timeline for chart — chronological order, one point per analysis
    const timeline = [...analyses].reverse().map(a => {
      const s = (a.recommendations as any)?.severityScore ?? 0;
      return {
        date:          new Date(a.createdAt).toISOString().slice(0, 10),
        severityScore: s,
        band:          s <= 25 ? 'clear' : s <= 50 ? 'mild' : s <= 75 ? 'moderate' : 'severe',
        condition:     a.condition,
        skinType:      (a as any).skinType || 'unknown',
      };
    });

    res.json({
      hasData:           true,
      severityScore:     severityResult.score,
      band:              severityResult.band,
      breakdown:         severityResult.breakdown,
      direction:         trend.direction,
      slope:             trend.slope,
      weekOverWeekChange: trend.weekOverWeekChange,
      dataPoints:        trend.dataPoints,
      trendConfidence:   trend.confidence,
      alert,
      insight,
      timeline,
      latestCondition:   latest.condition,
      latestSkinType:    (latest as any).skinType || 'unknown',
    });
  } catch (err) {
    console.error('[Progress] Trend error:', err);
    res.status(500).json({ error: 'Failed to compute trend.' });
  }
});

export default router;
