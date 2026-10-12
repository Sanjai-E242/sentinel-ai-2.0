import { Router, Request, Response, NextFunction } from 'express';
import { actionIngestionService } from '../../modules/actions/service.js';

const router = Router();

/**
 * POST /api/v1/actions
 * Ingests an action event from an external AI agent and produces a policy decision
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await actionIngestionService.ingestAction(req.body, req.id);
    res.status(200).json({
      data: {
        event: result.event,
        decision: result.decision
      },
      event: result.event,
      decision: result.decision,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/actions
 * Lists all action events (optionally filtered by ?sessionId= or ?agentId=)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
    const events = await actionIngestionService.listActions(sessionId, agentId);
    res.status(200).json({
      data: { events },
      events,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/actions/:id
 * Retrieves a single action event by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await actionIngestionService.getAction(req.params.id);
    res.status(200).json({
      data: { event },
      event,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

export const actionsRouter = router;
