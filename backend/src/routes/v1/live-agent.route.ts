/**
 * Sentinel 2.0 — Live External AI Agent Routes
 *
 * Exposes endpoints for managing external AI models (Gemini, Mock),
 * monitoring real-time agent trajectories, and executing human intervention reviews.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { externalAgentGateway } from '../../modules/external-agent/gateway.js';
import { BadRequestError } from '../../middleware/errorHandler.js';

export const liveAgentRouter = Router();

/**
 * GET /api/v1/live-agent/status
 * Returns current provider status (Gemini Connected vs Mock Provider, model name, supported scenarios)
 */
liveAgentRouter.get('/status', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = externalAgentGateway.getStatus();
    res.status(200).json({
      data: status,
      ...status
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/live-agent/start
 * Starts a new governed external agent session
 */
liveAgentRouter.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scenarioId, taskPrompt, forceProvider } = req.body || {};
    const session = await externalAgentGateway.startSession({
      scenarioId,
      taskPrompt,
      forceProvider
    });

    res.status(201).json({
      data: session,
      ...session
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/live-agent/step
 * Advances one single governed step in an active session
 */
liveAgentRouter.post('/step', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== 'string') {
      throw new BadRequestError("Field 'sessionId' is required to execute an agent step");
    }

    const stepResult = await externalAgentGateway.stepSession(sessionId);
    res.status(200).json({
      data: stepResult,
      ...stepResult
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/live-agent/decision
 * Submits human operator intervention decision (ALLOW_ONCE, DENY, REVOKE_SESSION)
 */
liveAgentRouter.post('/decision', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, decision, reviewerId, reason } = req.body || {};
    if (!sessionId || !decision) {
      throw new BadRequestError("Fields 'sessionId' and 'decision' are required");
    }

    const result = await externalAgentGateway.submitHumanDecision(sessionId, decision, reviewerId, reason);
    res.status(200).json({
      data: result,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/live-agent/run
 * Runs a complete governed agent loop (either full run or until CONFIRM/BLOCK)
 */
liveAgentRouter.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scenarioId, taskPrompt, forceProvider, autoApproveConfirm, maxSteps } = req.body || {};
    const result = await externalAgentGateway.runFullSession({
      scenarioId,
      taskPrompt,
      forceProvider,
      autoApproveConfirm: autoApproveConfirm ?? true,
      maxSteps: maxSteps || 6
    });

    res.status(200).json({
      data: result,
      ...result
    });
  } catch (err) {
    next(err);
  }
});
