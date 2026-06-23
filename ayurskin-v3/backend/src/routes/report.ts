import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SkinAnalysis } from '../models/SkinAnalysis';
import { User } from '../models/User';
import { Report } from '../models/Report';
import { generatePdfReport } from '../services/pdfReportService';

const router = Router();
router.use(authenticate);

const REPORTS_DIR = path.join(__dirname, '../../uploads/reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// ─── POST /api/report/generate ────────────────────────────────────────────────
router.post('/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { analysisId } = req.body;
    if (!analysisId) { res.status(400).json({ error: 'analysisId is required.' }); return; }

    const [analysis, user] = await Promise.all([
      SkinAnalysis.findOne({ _id: analysisId, userId: req.userId }),
      User.findById(req.userId).select('-password'),
    ]);

    if (!analysis) { res.status(404).json({ error: 'Analysis not found.' }); return; }
    if (!user)     { res.status(404).json({ error: 'User not found.' }); return; }

    const filename   = `report_${req.userId}_${analysisId}_${Date.now()}.pdf`;
    const outputPath = path.join(REPORTS_DIR, filename);
    const pdfUrl     = `/uploads/reports/${filename}`;

    await generatePdfReport(
      {
        condition:     analysis.condition,
        confidence:    analysis.confidence,
        probabilities: Object.fromEntries((analysis.probabilities as any) || []),
        imageUrl:      analysis.imageUrl,
        imagePath:     analysis.imagePath,
        heatmapUrl:    (analysis as any).heatmapUrl,
        region:        analysis.region,
        season:        analysis.season,
        skinType:      (analysis as any).skinType,
        regionAnalysis: (analysis as any).regionAnalysis || [],
        recommendations: analysis.recommendations as any,
        createdAt:     analysis.createdAt,
      },
      {
        name:     user.name,
        email:    user.email,
        age:      (user as any).age,
        gender:   (user as any).gender,
        skinType: (user as any).skinType,
        city:     (user as any).city,
      },
      outputPath
    );

    // Save report record
    await Report.create({
      userId:     req.userId,
      analysisId: analysis._id,
      pdfUrl,
      pdfPath:    outputPath,
    });

    res.json({ pdfUrl, message: 'Report generated successfully.' });
  } catch (err) {
    console.error('[Report] Generation error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// ─── GET /api/report/:analysisId ─────────────────────────────────────────────
// Returns most recent report for this analysis, or 404 if none
router.get('/:analysisId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await Report.findOne({
      userId:     req.userId,
      analysisId: req.params.analysisId,
    }).sort({ generatedAt: -1 });

    if (!report) { res.status(404).json({ error: 'No report found for this analysis.' }); return; }
    res.json({ pdfUrl: report.pdfUrl, generatedAt: report.generatedAt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report.' });
  }
});

// ─── GET /api/report/list/all ─────────────────────────────────────────────────
router.get('/list/all', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reports = await Report.find({ userId: req.userId })
      .sort({ generatedAt: -1 })
      .limit(20)
      .select('-pdfPath');
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

export default router;
