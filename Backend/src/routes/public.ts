import { Router } from 'express';
import { getEnv } from '../config/env';
import { getGeminiService } from '../services/geminiService';
import { AuthController } from '../controllers/authController';
import { asyncHandler } from '../utils/errors';
import type { Services } from '../services';

export function publicRoutes(services: Services): Router {
  const router = Router();
  const auth = new AuthController(services);

  router.get('/health', (_req, res) => {
    const env = getEnv();
    res.json({
      data: {
        status: 'ok',
        service: 'resumegen-api',
        time: new Date().toISOString(),
        environment: env.nodeEnv,
        authMode: env.authMode,
        database: services.repo.kind,
        aiConfigured: getGeminiService().configured,
        aiModel: env.geminiModel,
        sheetsConfigured: env.hasGoogleCredentials && Boolean(env.spreadsheetId),
      },
    });
  });

  router.get('/config', auth.config);
  router.post('/auth/demo', asyncHandler(auth.demoLogin));

  return router;
}
