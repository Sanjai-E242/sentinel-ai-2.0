import { Router, Request, Response, NextFunction } from 'express';
import { sessionService } from '../../modules/sessions/service.js';
import { trajectoryService } from '../../modules/trajectory/service.js';
import { interventionService } from '../../modules/intervention/service.js';
import { simulationService } from '../../modules/intervention/simulation.service.js';

const router = Router();

/**
 * POST /api/v1/sessions
 * Starts a new session for an agent
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await sessionService.createSession(req.body);
    res.status(201).json({
      data: { session },
      session,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions
 * Lists sessions (optionally filtered by ?agentId=)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
    const sessions = await sessionService.listSessions(agentId);
    res.status(200).json({
      data: { sessions },
      sessions,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:id
 * Retrieves a single session by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await sessionService.getSession(req.params.id);
    res.status(200).json({
      data: { session },
      session,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sessions/:id/end
 * Marks an active session as completed
 */
router.post('/:id/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await sessionService.endSession(req.params.id);
    res.status(200).json({
      data: { session },
      session,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:id/trajectory
 * Returns comprehensive trajectory analysis, features, deviation breakdown, and replay sequence
 */
router.get('/:id/trajectory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trajectory = await trajectoryService.getSessionTrajectory(req.params.id);
    res.status(200).json({
      data: trajectory,
      ...trajectory,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:id/risk
 * Returns compact risk telemetry suitable for polling
 */
router.get('/:id/risk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const riskTelemetry = await trajectoryService.getSessionRiskTelemetry(req.params.id);
    res.status(200).json({
      data: riskTelemetry,
      ...riskTelemetry,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:id/intervention
 * Returns current intervention analysis, optimal window, and pending review if any
 */
router.get('/:id/intervention', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interventionData = await interventionService.getSessionIntervention(req.params.id);
    res.status(200).json({
      data: interventionData,
      ...interventionData,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:id/forecast
 * Returns forward trajectory risk forecast
 */
router.get('/:id/forecast', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forecast = await interventionService.getSessionForecast(req.params.id);
    res.status(200).json({
      data: forecast,
      ...forecast,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:id/counterfactual
 * Returns 3-path counterfactual simulation (EARLY vs RECOMMENDED vs LATE)
 */
router.get('/:id/counterfactual', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const counterfactual = await interventionService.getSessionCounterfactual(req.params.id);
    res.status(200).json({
      data: counterfactual,
      ...counterfactual,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sessions/:id/simulate-intervention
 * Simulates counterfactual intervention strategies (early, optimal, late, or all) on the session's recorded trajectory
 */
router.post('/:id/simulate-intervention', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const scenario = req.body?.scenario as 'early' | 'optimal' | 'late' | 'all' | undefined;

    if (scenario && ['early', 'optimal', 'late'].includes(scenario)) {
      const result = await simulationService.simulateSessionScenario(
        sessionId,
        scenario as 'early' | 'optimal' | 'late'
      );
      res.status(200).json({
        data: result.simulation,
        simulation: result.simulation,
        comparison: result.comparison,
        requestId: req.id
      });
    } else {
      // Default: simulate all 3 scenarios and return full comparison
      const comparison = await simulationService.simulateAllForSession(sessionId);
      res.status(200).json({
        data: comparison,
        ...comparison,
        requestId: req.id
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:id/simulate-intervention
 * Retrieves complete 3-path counterfactual simulation comparison for the session
 */
router.get('/:id/simulate-intervention', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comparison = await simulationService.simulateAllForSession(req.params.id);
    res.status(200).json({
      data: comparison,
      ...comparison,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

export const sessionsRouter = router;
