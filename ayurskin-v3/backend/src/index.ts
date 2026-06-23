import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

import authRoutes from './routes/auth';
import skinRoutes from './routes/skin';
import progressRoutes from './routes/progress';
import chatRoutes from './routes/chat';
import habitsRoutes from './routes/habits';
import environmentRoutes from './routes/environment';
import gamificationRoutes from './routes/gamification';
import reportRoutes from './routes/report';
import profileRoutes from './routes/profile';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ayurskin';

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: 'Too many requests' });
const analysisLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'Analysis limit reached. Try again in an hour.' });
app.use('/api/', limiter);
app.use('/api/skin/analyze', analysisLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth',         authRoutes);
app.use('/api/skin',         skinRoutes);
app.use('/api/progress',     progressRoutes);
app.use('/api/chat',         chatRoutes);
app.use('/api/capture',      chatRoutes);
app.use('/api/detect',       chatRoutes);
app.use('/api/habits',       habitsRoutes);
app.use('/api/environment',  environmentRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/report',       reportRoutes);
app.use('/api/profile',      profileRoutes);

app.get('/api/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'ayurskin-api', version: '3.0.0', timestamp: new Date().toISOString() });
});

app.use((_req, res) => { res.status(404).json({ error: 'Route not found.' }); });
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`✅ AyurSkin API v3 running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  }
}

startServer();
export default app;
