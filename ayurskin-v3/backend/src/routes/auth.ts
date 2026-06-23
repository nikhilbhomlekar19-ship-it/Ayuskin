import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { generateToken } from '../middleware/auth';

const router = Router();

const signupSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.string().email(),
  password: z.string().min(6).max(100)
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1)
});

router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
    const { name, email, password } = parsed.data;
    const existing = await User.findOne({ email });
    if (existing) { res.status(409).json({ error: 'An account with this email already exists.' }); return; }
    const user = new User({ name, email, password });
    await user.save();
    const token = generateToken(user._id.toString());
    res.status(201).json({ message: 'Account created successfully.', token, user: { id: user._id, name: user.name, email: user.email, profileComplete: user.profileComplete, createdAt: user.createdAt } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
    const { email, password } = parsed.data;
    const user = await User.findOne({ email });
    if (!user) { res.status(401).json({ error: 'Invalid email or password.' }); return; }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) { res.status(401).json({ error: 'Invalid email or password.' }); return; }
    const token = generateToken(user._id.toString());
    res.json({ message: 'Login successful.', token, user: { id: user._id, name: user.name, email: user.email, profileComplete: user.profileComplete, age: user.age, gender: user.gender, skinType: user.skinType, city: user.city, createdAt: user.createdAt } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

export default router;
