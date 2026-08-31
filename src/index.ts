import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { validateEnv } from './utils/env';
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLoggerMiddleware } from './middleware/requestLogger';
import { globalLimiter } from './middleware/rateLimiter';
import { db } from './db';
import { sql } from 'drizzle-orm';

import authRoutes from './routes/auth';
import matchRoutes from './routes/matches';
import inningsRoutes from './routes/innings';
import ballRoutes from './routes/balls';
import batterRoutes from './routes/batters';
import bowlerRoutes from './routes/bowlers';
import matchPlayerRoutes from './routes/matchPlayers';
import competitionRoutes from './routes/competitions';
import competitionStageRoutes from './routes/competitionStages';
import teamRoutes from './routes/teams';
import playerRoutes from './routes/players';
import presetRoutes from './routes/presets';
import playerStatsRoutes from './routes/playerStats';

dotenv.config();
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Behind a reverse proxy (Render/Heroku), trust the first hop so
// express-rate-limit can read the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(globalLimiter);

app.get('/api/health', async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({
      status: 'ok',
      database: 'connected',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database connection failed',
      },
      status: 'error',
      database: 'disconnected',
      version: '1.0.0',
    });
  }
});

// API Routes
app.use('/api/v1', authRoutes);
app.use('/api/v1', matchRoutes);
app.use('/api/v1', inningsRoutes);
app.use('/api/v1', ballRoutes);
app.use('/api/v1', batterRoutes);
app.use('/api/v1', bowlerRoutes);
app.use('/api/v1', matchPlayerRoutes);
app.use('/api/v1', competitionRoutes);
app.use('/api/v1', competitionStageRoutes);
app.use('/api/v1', teamRoutes);
app.use('/api/v1', playerRoutes);
app.use('/api/v1', presetRoutes);
app.use('/api/v1', playerStatsRoutes);

// Legacy routes
app.use('/api', authRoutes);
app.use('/api', matchRoutes);
app.use('/api', inningsRoutes);
app.use('/api', ballRoutes);
app.use('/api', batterRoutes);
app.use('/api', bowlerRoutes);
app.use('/api', matchPlayerRoutes);
app.use('/api', competitionRoutes);
app.use('/api', competitionStageRoutes);
app.use('/api', teamRoutes);
app.use('/api', playerRoutes);
app.use('/api', presetRoutes);
app.use('/api', playerStatsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found',
    },
  });
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: 'info',
    message: `Cricket Scorer API v1.0.0 running on port ${PORT}`,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  }));
});

process.on('SIGTERM', () => {
  console.log(JSON.stringify({
    level: 'warn',
    message: 'SIGTERM received, shutting down gracefully',
    timestamp: new Date().toISOString(),
  }));
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log(JSON.stringify({
    level: 'warn',
    message: 'SIGINT received, shutting down gracefully',
    timestamp: new Date().toISOString(),
  }));
  server.close(() => process.exit(0));
});

export default app;
