import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/index.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  // Request ID injection
  app.use(requestIdMiddleware);

  // Basic security and parsing middleware
  app.use(helmet());
  // Allowed origins helper
  const configuredOrigins = Array.isArray(config.corsOrigin)
    ? config.corsOrigin
    : [config.corsOrigin];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Render health checks)
      if (!origin) return callback(null, true);

      // Explicit match from configured origins (env vars)
      if (configuredOrigins.includes(origin)) return callback(null, true);

      // Match Vercel production and preview deployment domains
      if (
        origin === 'https://sentinel-2-frontend-neon.vercel.app' ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }

      // Match local development
      if (
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }

      // Allow Render internal/preview
      if (origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Accept']
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request telemetry
  app.use(requestLogger);

  // Mount API router
  app.use(config.apiPrefix, apiRouter);

  // Fallback for root route
  app.get('/', (_req, res) => {
    res.json({
      name: 'Sentinel 2.0 API',
      description: 'Runtime Control Layer for AI Agents',
      health: `${config.apiPrefix}/health`
    });
  });

  // 404 & centralized error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
