import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';

const router = Router();
router.use(authenticate);

const profileSchema = z.object({
  age:      z.number().min(10).max(120).optional(),
  gender:   z.enum(['male','female','other','prefer_not']).optional(),
  skinType: z.enum(['oily','dry','combination','normal']).optional(),
  city:     z.string().min(2).max(100).optional(),
  name:     z.string().min(2).max(100).optional(),
});

// GET /api/profile
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/profile
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
    const updates: any = { ...parsed.data };
    // Check if profile is complete after this update
    const user = await User.findById(req.userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    Object.assign(user, updates);
    if (user.age && user.gender && user.skinType && user.city) {
      user.profileComplete = true;
    }
    await user.save();
    const updated = await User.findById(req.userId).select('-password');
    res.json({ message: 'Profile updated.', user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
