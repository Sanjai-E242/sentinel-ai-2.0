import { Router, Request, Response } from 'express';
import { HealthService } from '../services/health.service.js';

const router = Router();

/**
 * GET /api/health
 * Returns standard Sentinel API health status
 */
router.get('/', (_req: Request, res: Response) => {
  const health = HealthService.getHealth();
  res.status(200).json(health);
});

export const healthRouter = router;
