import { Router, Request, Response, NextFunction } from 'express';
import { agentService } from '../../modules/agents/service.js';
import { sessionService } from '../../modules/sessions/service.js';
import { actionIngestionService } from '../../modules/actions/service.js';

const router = Router();

/**
 * POST /api/v1/agents/gemini/session
 * Establishes a governed Sentinel session for the external Gemini agent
 */
router.post('/gemini/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { task, principal, scopes } = req.body || {};

    const configuredScopes = Array.isArray(scopes) && scopes.length > 0
      ? scopes
      : ['project.read', 'project.write', 'source.read'];

    const agent = await agentService.registerAgent({
      name: 'Gemini Research Agent',
      type: 'external-ai-agent',
      scopes: configuredScopes,
      metadata: {
        principal: principal || 'gemini-agent@external.sentinel',
        task: task || 'Financial audit and repository inspection',
        provider: 'gemini',
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash'
      }
    });

    const session = await sessionService.createSession({
      agentId: agent.id,
      metadata: {
        task: task || 'Financial audit and repository inspection',
        principal: principal || 'gemini-agent@external.sentinel',
        scopes: configuredScopes
      }
    });

    res.status(201).json({
      data: {
        sessionId: session.id,
        agentId: agent.id,
        status: session.status,
        trajectory: {
          currentRisk: session.currentRisk,
          trajectoryDeviation: session.trajectoryDeviation,
          riskVelocity: session.riskVelocity,
          riskAcceleration: session.riskAcceleration,
          trajectoryState: session.trajectoryState
        },
        actions: [],
        decisions: []
      },
      sessionId: session.id,
      agentId: agent.id,
      status: session.status,
      trajectory: {
        currentRisk: session.currentRisk,
        trajectoryDeviation: session.trajectoryDeviation,
        riskVelocity: session.riskVelocity,
        riskAcceleration: session.riskAcceleration,
        trajectoryState: session.trajectoryState
      },
      actions: [],
      decisions: [],
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/agents
 * Registers a new agent
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await agentService.registerAgent(req.body);
    res.status(201).json({
      data: { agent },
      agent,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/agents
 * Lists all registered agents
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agents = await agentService.listAgents();
    res.status(200).json({
      data: { agents },
      agents,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/agents/:id
 * Retrieves a single agent by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await agentService.getAgent(req.params.id);
    res.status(200).json({
      data: { agent },
      agent,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/agents/:id/suspend
 * Suspends an agent
 */
router.post('/:id/suspend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reason = req.body?.reason;
    const agent = await agentService.suspendAgent(req.params.id, reason);
    res.status(200).json({
      data: { agent },
      agent,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/agents/:id/revoke
 * Revokes an agent
 */
router.post('/:id/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reason = req.body?.reason;
    const agent = await agentService.revokeAgent(req.params.id, reason);
    res.status(200).json({
      data: { agent },
      agent,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/agents/:agentId/actions
 * Evaluates an action proposed by an external agent against Sentinel policy & trajectory
 */
router.post('/:agentId/actions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = req.params.agentId;
    const body = req.body || {};

    const result = await actionIngestionService.ingestAction({
      ...body,
      agentId
    }, req.id);

    const risk = Number(result.event.metadata?.risk ?? 0);
    const trajectoryDeviation = Number(result.event.metadata?.trajectoryDeviation ?? 0);

    res.status(200).json({
      data: {
        decision: result.decision.action,
        risk,
        trajectoryDeviation,
        event: result.event,
        policyDecision: result.decision
      },
      decision: result.decision.action,
      risk,
      trajectoryDeviation,
      event: result.event,
      policyDecision: result.decision,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/agents/:agentId/sessions
 * Creates a session for a specific agent
 */
router.post('/:agentId/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await sessionService.createSession({
      agentId: req.params.agentId,
      metadata: req.body?.metadata
    });
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
 * GET /api/v1/agents/:agentId/sessions
 * Lists sessions for a specific agent
 */
router.get('/:agentId/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await sessionService.listSessions(req.params.agentId);
    res.status(200).json({
      data: { sessions },
      sessions,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

export const agentsRouter = router;
