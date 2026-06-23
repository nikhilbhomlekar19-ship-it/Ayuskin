import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SkinAnalysis } from '../models/SkinAnalysis';
import { User } from '../models/User';
import { generateRecommendations, SkinCondition } from '../services/recommendationEngine';
import { buildRoutine, SkinType } from '../services/routineBuilder';
import { computeSeverityScore } from '../services/progressIntelligence';

const router = Router();

// ─── Multer ───────────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../../uploads/analyses');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are supported.'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Service URLs ─────────────────────────────────────────────────────────────
const ML_URL     = process.env.ML_SERVICE_URL     || 'http://localhost:5001';
const DETECT_URL = process.env.DETECTION_SERVICE_URL || 'http://localhost:5002';
const REGION_URL = process.env.REGION_SERVICE_URL || 'http://localhost:5003';

// ─── ML callers ───────────────────────────────────────────────────────────────
async function callMLService(imagePath: string) {
  const fd = new FormData();
  fd.append('image', fs.createReadStream(imagePath));
  const res = await axios.post(`${ML_URL}/predict`, fd, { headers: fd.getHeaders(), timeout: 30000 });
  return res.data as { condition: SkinCondition; confidence: number; probabilities: Record<string, number>; model_type: string; is_fallback: boolean };
}

async function callSkinTypeService(imagePath: string) {
  const fd = new FormData();
  fd.append('image', fs.createReadStream(imagePath));
  const res = await axios.post(`${ML_URL}/skin-type`, fd, { headers: fd.getHeaders(), timeout: 15000 });
  return res.data as { skinType: string; metrics: Record<string, number>; confidence: string };
}

async function callRegionService(imagePath: string) {
  const fd = new FormData();
  fd.append('image', fs.createReadStream(imagePath));
  const res = await axios.post(`${REGION_URL}/analyze-regions`, fd, { headers: fd.getHeaders(), timeout: 45000 });
  return res.data as { regions: any[]; heatmapBase64?: string };
}

async function callDetectionService(imagePath: string) {
  const fd = new FormData();
  fd.append('image', fs.createReadStream(imagePath));
  const res = await axios.post(`${DETECT_URL}/detect`, fd, { headers: fd.getHeaders(), timeout: 30000 });
  return res.data as { detections: any[]; counts: Record<string, number>; summary: string[] };
}

// ─── POST /api/skin/analyze ───────────────────────────────────────────────────
router.post('/analyze', authenticate, upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: 'No image file uploaded.' }); return; }

  const { region = 'India', season = 'Summer' } = req.body;
  const imagePath = req.file.path;
  const imageUrl  = `/uploads/analyses/${req.file.filename}`;

  try {
    // 1. Fetch user profile for personalization
    const user = await User.findById(req.userId).select('skinType age gender city');
    const profileSkinType = (user?.skinType as SkinType) || 'unknown';

    // 2. Run ML + skin type + region analysis + detection in parallel
    const [predResult, skinTypeResult, regionResult, detectResult] = await Promise.allSettled([
      callMLService(imagePath),
      callSkinTypeService(imagePath),
      callRegionService(imagePath),
      callDetectionService(imagePath),
    ]);

    // 3. Extract results with fallbacks
    const prediction = predResult.status === 'fulfilled'
      ? predResult.value
      : { condition: 'normal' as SkinCondition, confidence: 0, probabilities: {}, model_type: 'unavailable', is_fallback: true };

    const skinTypeData = skinTypeResult.status === 'fulfilled'
      ? skinTypeResult.value
      : { skinType: profileSkinType || 'unknown', metrics: {}, confidence: 'fallback' };

    const regionData = regionResult.status === 'fulfilled'
      ? regionResult.value
      : { regions: [], heatmapBase64: undefined };

    const detectData = detectResult.status === 'fulfilled'
      ? detectResult.value
      : { detections: [], counts: { total: 0 }, summary: [] };

    // 4. Determine final skin type (prefer ML result, fallback to profile)
    const finalSkinType = (skinTypeData.skinType !== 'unknown' ? skinTypeData.skinType : profileSkinType) as SkinType;

    // 5. Compute severity score
    const severityResult = computeSeverityScore(
      { condition: prediction.condition, confidence: prediction.confidence, probabilities: prediction.probabilities },
      detectData.counts || {}
    );

    // 6. Generate recommendations + routine
    const recommendations = generateRecommendations(prediction.condition);
    const routine = buildRoutine(prediction.condition, finalSkinType, season);

    // 7. Save heatmap base64 as file if present
    let heatmapUrl: string | undefined;
    if (regionData.heatmapBase64) {
      const heatmapFilename = `heatmap_${Date.now()}.jpg`;
      const heatmapPath = path.join(uploadsDir, heatmapFilename);
      const b64Data = regionData.heatmapBase64.includes(',')
        ? regionData.heatmapBase64.split(',')[1]
        : regionData.heatmapBase64;
      fs.writeFileSync(heatmapPath, Buffer.from(b64Data, 'base64'));
      heatmapUrl = `/uploads/analyses/${heatmapFilename}`;
    }

    // 8. Persist to MongoDB
    const analysis = new SkinAnalysis({
      userId:    req.userId,
      condition: prediction.condition,
      confidence: prediction.confidence,
      probabilities: prediction.probabilities,
      imageUrl,
      imagePath,
      heatmapUrl,
      region,
      season,
      skinType:  finalSkinType,
      regionAnalysis: regionData.regions || [],
      modelType: prediction.model_type || 'unknown',
      isFallback: prediction.is_fallback || false,
      recommendations: {
        ...recommendations,
        routine,
        severityScore: severityResult.score,
      },
    });
    await analysis.save();

    res.status(200).json({
      id:             analysis._id,
      condition:      prediction.condition,
      confidence:     prediction.confidence,
      probabilities:  prediction.probabilities,
      imageUrl,
      heatmapUrl,
      region,
      season,
      skinType:       finalSkinType,
      skinTypeMetrics: skinTypeData.metrics,
      regionAnalysis: regionData.regions || [],
      detectionSummary: detectData.summary || [],
      detectionCounts:  detectData.counts  || {},
      severityScore:  severityResult.score,
      severityBand:   severityResult.band,
      modelType:      prediction.model_type,
      isFallback:     prediction.is_fallback,
      recommendations: { ...recommendations, routine },
      createdAt:      analysis.createdAt,
    });

  } catch (err) {
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    console.error('Skin analysis error:', err);
    res.status(500).json({ error: 'Failed to analyze skin image.' });
  }
});

// ─── GET /api/skin/analyses ───────────────────────────────────────────────────
router.get('/analyses', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip  = (page - 1) * limit;

    const [analyses, total] = await Promise.all([
      SkinAnalysis.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-recommendations.dietPlan.days -imagePath'),
      SkinAnalysis.countDocuments({ userId: req.userId }),
    ]);

    res.json({ analyses, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analyses.' });
  }
});

// ─── GET /api/skin/analyses/:id ───────────────────────────────────────────────
router.get('/analyses/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analysis = await SkinAnalysis.findOne({ _id: req.params.id, userId: req.userId }).select('-imagePath');
    if (!analysis) { res.status(404).json({ error: 'Analysis not found.' }); return; }
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analysis.' });
  }
});

// ─── DELETE /api/skin/analyses/:id ───────────────────────────────────────────
router.delete('/analyses/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analysis = await SkinAnalysis.findOne({ _id: req.params.id, userId: req.userId });
    if (!analysis) { res.status(404).json({ error: 'Analysis not found.' }); return; }
    if (analysis.imagePath && fs.existsSync(analysis.imagePath)) fs.unlinkSync(analysis.imagePath);
    await analysis.deleteOne();
    res.status(200).json({ message: 'Analysis deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete analysis.' });
  }
});

// ─── POST /api/skin/compare ───────────────────────────────────────────────────
router.post('/compare', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { analysisId1, analysisId2 } = req.body;
    if (!analysisId1 || !analysisId2) {
      res.status(400).json({ error: 'Both analysisId1 and analysisId2 are required.' });
      return;
    }

    const [a1, a2] = await Promise.all([
      SkinAnalysis.findOne({ _id: analysisId1, userId: req.userId }),
      SkinAnalysis.findOne({ _id: analysisId2, userId: req.userId }),
    ]);

    if (!a1 || !a2) { res.status(404).json({ error: 'One or both analyses not found.' }); return; }

    // ML comparison if both images exist
    let mlComparison = null;
    if (a1.imagePath && a2.imagePath && fs.existsSync(a1.imagePath) && fs.existsSync(a2.imagePath)) {
      try {
        const fd = new FormData();
        fd.append('image1', fs.createReadStream(a1.imagePath));
        fd.append('image2', fs.createReadStream(a2.imagePath));
        const r = await axios.post(`${ML_URL}/predict/compare`, fd, { headers: fd.getHeaders(), timeout: 30000 });
        mlComparison = r.data;
      } catch (e) { console.warn('ML comparison failed'); }
    }

    const insights: string[] = [];
    if (a1.condition !== a2.condition) {
      insights.push(a2.condition === 'normal'
        ? `🎉 Great improvement! Condition improved from ${a1.condition} → normal.`
        : `Condition changed from ${a1.condition} → ${a2.condition}.`);
    } else {
      insights.push(`Condition remained ${a1.condition} between analyses.`);
    }
    const confChange = a2.confidence - a1.confidence;
    if (Math.abs(confChange) > 5) {
      insights.push(confChange > 0
        ? `Condition severity increased (confidence +${confChange.toFixed(1)}%).`
        : `Condition severity reduced (confidence ${confChange.toFixed(1)}%).`);
    }
    const days = Math.round((new Date(a2.createdAt).getTime() - new Date(a1.createdAt).getTime()) / 86400000);
    insights.push(`${days} days between analyses.`);

    res.json({
      before: { id: a1._id, condition: a1.condition, confidence: a1.confidence, imageUrl: a1.imageUrl, createdAt: a1.createdAt },
      after:  { id: a2._id, condition: a2.condition, confidence: a2.confidence, imageUrl: a2.imageUrl, createdAt: a2.createdAt },
      mlComparison,
      insights,
      daysBetween: days,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compare analyses.' });
  }
});

export default router;
