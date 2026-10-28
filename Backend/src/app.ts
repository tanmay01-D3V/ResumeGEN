import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getEnv } from './config/env';
import { createRepository, type Repository } from './repositories';
import { buildServices, type Services } from './services';
import { generalRateLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { publicRoutes } from './routes/public';
import { portfolioRoutes } from './routes/portfolio';
import { jobDescriptionRoutes } from './routes/jobDescriptions';
import { resumeRoutes } from './routes/resumes';
import { sheetsRoutes } from './routes/sheets';
import { dashboardRoutes } from './routes/dashboard';
import { logger } from './utils/logger';

function requestLogger(req: Request, res: Response, next: () => void): void {
  const started = Date.now();
  res.on('finish', () => {
    // Log only method, path, status and duration. No bodies, tokens or JD text.
    logger.info('request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started,
    });
  });
  next();
}

export interface CreateAppOptions {
  services?: Services;
  repo?: Repository;
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const env = getEnv();
  const repo = options.repo ?? options.services?.repo ?? createRepository();
  const services = options.services ?? buildServices(repo);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowedOrigins = new Set(env.frontendUrls);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
        if (
          env.nodeEnv !== 'production' &&
          /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  if (env.nodeEnv !== 'test') app.use('/api', generalRateLimiter);

  app.get('/', (_req, res) => {
    res.json({
      data: {
        name: 'ResumeGEN API',
        version: '1.0.0',
        health: '/api/health',
        documentation: 'docs/api-documentation.md',
      },
    });
  });

  app.use('/api', publicRoutes(services));
  app.use('/api', dashboardRoutes(services));
  app.use('/api/portfolio', portfolioRoutes(services));
  app.use('/api/job-descriptions', jobDescriptionRoutes(services));
  app.use('/api/resumes', resumeRoutes(services));
  app.use('/api/integrations/google-sheets', sheetsRoutes(services));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
