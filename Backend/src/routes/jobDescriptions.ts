import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { aiRateLimiter } from '../middleware/rateLimit';
import { jobDescriptionInputSchema } from '../../../shared/schemas';
import { JobDescriptionController } from '../controllers/jobDescriptionController';
import { asyncHandler } from '../utils/errors';
import type { Services } from '../services';

export function jobDescriptionRoutes(services: Services): Router {
  const router = Router();
  const controller = new JobDescriptionController(services);
  router.use(requireAuth);

  router.get('/', asyncHandler(controller.list));
  router.post('/', validateBody(jobDescriptionInputSchema), asyncHandler(controller.create));
  router.get('/:id', asyncHandler(controller.get));
  router.patch('/:id', validateBody(jobDescriptionInputSchema), asyncHandler(controller.update));
  router.delete('/:id', asyncHandler(controller.remove));
  router.post('/:id/analyze', aiRateLimiter, asyncHandler(controller.analyze));

  return router;
}
