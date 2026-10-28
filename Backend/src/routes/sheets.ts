import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  GoogleSheetsController,
  sheetsConfigSchema,
  sheetsImportConfirmSchema,
} from '../controllers/googleSheetsController';
import { asyncHandler } from '../utils/errors';
import type { Services } from '../services';

export function sheetsRoutes(services: Services): Router {
  const router = Router();
  const controller = new GoogleSheetsController(services);
  router.use(requireAuth);

  router.get('/status', asyncHandler(controller.status));
  router.patch('/config', validateBody(sheetsConfigSchema), asyncHandler(controller.config));
  router.post('/sync', asyncHandler(controller.sync));
  router.get('/preview', asyncHandler(controller.preview));
  router.post('/import', asyncHandler(controller.importPreview));
  router.post(
    '/import/confirm',
    validateBody(sheetsImportConfirmSchema),
    asyncHandler(controller.importConfirm),
  );

  return router;
}
