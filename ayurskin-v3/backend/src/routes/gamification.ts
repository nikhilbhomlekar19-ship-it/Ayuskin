import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getGamificationState, BADGE_DEFINITIONS } from '../services/gamification';

const router = Router();
router.use(authenticate);

// GET /api/gamification/state
router.get('/state', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const state = await getGamificationState(req.userId!);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gamification state' });
  }
});

// GET /api/gamification/badges
router.get('/badges', (_req, res: Response): void => {
  res.json({ badges: BADGE_DEFINITIONS });
});

export default router;
