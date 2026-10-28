import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { aiRateLimiter } from '../middleware/rateLimit';
import {
  generateResumeRequestSchema,
  matchRequestSchema,
  saveResumeRequestSchema,
  suggestionsRequestSchema,
} from '../../../shared/schemas';
import { ResumeController } from '../controllers/resumeController';
import { asyncHandler } from '../utils/errors';
import type { Services } from '../services';

export function resumeRoutes(services: Services): Router {
  const router = Router();
  const controller = new ResumeController(services);
  router.use(requireAuth);

  router.post('/match', aiRateLimiter, validateBody(matchRequestSchema), asyncHandler(controller.match));
  router.post(
    '/generate',
    aiRateLimiter,
    validateBody(generateResumeRequestSchema),
    asyncHandler(controller.generate),
  );
  router.post(
    '/pdf',
    validateBody(generateResumeRequestSchema),
    asyncHandler(controller.previewPdf),
  );
  router.post(
    '/suggestions',
    aiRateLimiter,
    validateBody(suggestionsRequestSchema),
    asyncHandler(controller.suggest),
  );

  router.get('/', asyncHandler(controller.list));
  router.post('/', validateBody(saveResumeRequestSchema), asyncHandler(controller.save));
  router.get('/:id', asyncHandler(controller.get));
  router.patch('/:id', asyncHandler(controller.rename));
  router.delete('/:id', asyncHandler(controller.remove));
  router.get('/:id/pdf', asyncHandler(controller.savedPdf));

  return router;
}
