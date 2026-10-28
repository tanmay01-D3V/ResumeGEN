import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { aiRateLimiter } from '../middleware/rateLimit';
import { importConfirmSchema, importPreviewRequestSchema } from '../../../shared/schemas';
import { PortfolioController } from '../controllers/portfolioController';
import { asyncHandler } from '../utils/errors';
import type { Services } from '../services';

export function portfolioRoutes(services: Services): Router {
  const router = Router();
  const controller = new PortfolioController(services);
  router.use(requireAuth);

  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));
  router.post(
    '/structure-text',
    aiRateLimiter,
    validateBody(importPreviewRequestSchema),
    asyncHandler(controller.structureText),
  );
  router.post(
    '/import-preview',
    aiRateLimiter,
    validateBody(importPreviewRequestSchema),
    asyncHandler(controller.structureText),
  );
  router.post(
    '/import-confirm',
    validateBody(importConfirmSchema),
    asyncHandler(controller.importConfirm),
  );
  router.get('/:id', asyncHandler(controller.get));
  router.patch('/:id', asyncHandler(controller.update));
  router.delete('/:id', asyncHandler(controller.remove));

  return router;
}
