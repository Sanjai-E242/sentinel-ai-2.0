import { Router, Request, Response, NextFunction } from 'express';
import { interventionService } from '../../modules/intervention/service.js';

const router = Router();

/**
 * GET /api/v1/interventions
 * Lists interventions with optional status filter (e.g. ?status=PENDING)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    let items;
    if (status === 'PENDING') {
      items = await interventionService.listPendingInterventions();
    } else {
      items = await interventionService.listAllInterventions();
      if (status) {
        items = items.filter((i) => i.status === status);
      }
    }

    res.status(200).json({
      data: items,
      interventions: items,
      count: items.length,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/interventions/:id
 * Retrieves details of a specific intervention by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await interventionService.getIntervention(req.params.id);

    res.status(200).json({
      data: item,
      ...item,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/interventions/:id/decision
 * Submits human operator review decision (ALLOW_ONCE, DENY, REVOKE_SESSION)
 */
router.post('/:id/decision', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision, reviewerId, reason } = req.body;
    const resolved = await interventionService.recordHumanDecision(req.params.id, {
      decision,
      reviewerId,
      reason
    });

    res.status(200).json({
      data: resolved,
      ...resolved,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

export const interventionsRouter = router;
