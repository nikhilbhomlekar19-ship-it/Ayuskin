import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getEnvironmentData, getFallbackEnvironmentData, summariseEnvironment } from '../services/environmentService';

const router = Router();
router.use(authenticate);

// GET /api/environment/:city
router.get('/:city', async (req: Request, res: Response): Promise<void> => {
  try {
    const city = decodeURIComponent(req.params.city).trim();
    if (!city || city.length < 2) { res.status(400).json({ error: 'City name required' }); return; }
    const env = await getEnvironmentData(city);
    res.json({ ...env, summary: summariseEnvironment(env) });
  } catch (err: any) {
    console.error('[Environment] Error:', err);
    const fallback = getFallbackEnvironmentData(req.params.city);
    res.json({ ...fallback, summary: summariseEnvironment(fallback), isFallback: true });
  }
});

// GET /api/environment/fallback/:city
router.get('/fallback/:city', (_req: Request, res: Response): void => {
  const city = decodeURIComponent(_req.params.city || 'India');
  const env = getFallbackEnvironmentData(city);
  res.json({ ...env, summary: summariseEnvironment(env), isFallback: true });
});

export default router;
