import { Router, Request, Response, NextFunction } from 'express';
import { evaluationService } from '../../modules/evaluation/service.js';

export const evaluationRouter = Router();

/**
 * GET /api/v1/evaluation
 * Returns actual aggregated evaluation metrics from deterministic scenario runs
 */
evaluationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = evaluationService.getMetrics();
    res.status(200).json({
      data: metrics,
      ...metrics,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});
