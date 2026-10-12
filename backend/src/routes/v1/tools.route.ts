/**
 * Sentinel 2.0 — Protected Tool Gateway Routes
 *
 * Exposes endpoints for executing protected tools exclusively via Sentinel's decision pipeline.
 * Direct execution of protected tools without Sentinel evaluation is strictly prohibited.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { toolGateway, ProtectedToolName } from '../../modules/tools/gateway.js';
import { simulatedCustomerStore } from '../../modules/tools/customer-store.js';
import { BadRequestError } from '../../middleware/errorHandler.js';

export const toolsRouter = Router();

/**
 * POST /api/v1/tools/execute
 * Governs external agent tool requests through Sentinel before dispatching to simulated customer store.
 */
toolsRouter.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, sessionId, tool, params } = req.body || {};

    if (!agentId || typeof agentId !== 'string') {
      throw new BadRequestError("Field 'agentId' is required to execute a protected tool");
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new BadRequestError("Field 'sessionId' is required to execute a protected tool");
    }

    if (!tool || typeof tool !== 'string') {
      throw new BadRequestError("Field 'tool' is required to execute a protected tool");
    }

    const result = await toolGateway.executeToolRequest({
      agentId,
      sessionId,
      tool: tool as ProtectedToolName,
      params
    });

    const isThrottled = result.reasonCodes.includes('RATE_LIMIT_EXCEEDED');
    const statusCode = result.decision === 'BLOCK' ? (isThrottled ? 429 : 403) : 200;

    res.status(statusCode).json({
      data: result,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/tools/customer-store
 * Retrieves current in-memory simulated database state for demonstration inspection
 */
toolsRouter.get('/customer-store', (_req: Request, res: Response) => {
  const state = simulatedCustomerStore.getState();
  res.status(200).json({
    data: state,
    ...state
  });
});

/**
 * POST /api/v1/tools/customer-store/reset
 * Resets simulated database to pristine initial test/demo state
 */
toolsRouter.post('/customer-store/reset', (_req: Request, res: Response) => {
  simulatedCustomerStore.reset();
  const state = simulatedCustomerStore.getState();
  res.status(200).json({
    message: 'Simulated customer store reset to initial state',
    data: state,
    ...state
  });
});
