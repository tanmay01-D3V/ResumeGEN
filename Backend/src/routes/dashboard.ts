import { Router } from 'express';
import { requireAuth, currentUser } from '../middleware/auth';
import { AuthController } from '../controllers/authController';
import { buildDashboard } from '../services/dashboardService';
import { asyncHandler } from '../utils/errors';
import type { Services } from '../services';

export function dashboardRoutes(services: Services): Router {
  const router = Router();
  const auth = new AuthController(services);
  router.use(requireAuth);

  router.get('/dashboard', asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const dashboard = await buildDashboard(services, user.uid);
    res.json({ data: dashboard });
  }));

  router.get('/me', asyncHandler(auth.me));
  router.patch('/me', asyncHandler(auth.updateMe));
  router.post('/demo/seed', asyncHandler(auth.seed));

  return router;
}
