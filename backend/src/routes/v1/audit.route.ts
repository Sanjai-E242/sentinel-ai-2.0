import { Router, Request, Response, NextFunction } from 'express';
import { auditService } from '../../modules/audit/service.js';

const router = Router();

/**
 * GET /api/v1/audit
 * Lists audit log entries (optionally filtered by ?sessionId=, ?eventType=, ?entityId=, ?limit=)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : undefined;
    const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;

    const logs = await auditService.listLogs({
      sessionId,
      eventType,
      entityId,
      limit
    });

    res.status(200).json({
      data: { logs },
      logs,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

export const auditRouter = router;
