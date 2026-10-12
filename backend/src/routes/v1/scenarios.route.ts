import { Router, Request, Response, NextFunction } from 'express';
import { SCENARIOS, SCENARIO_DEFINITIONS, runScenario } from '../../modules/scenarios/index.js';
import { NotFoundError } from '../../middleware/errorHandler.js';

const router = Router();

/**
 * GET /api/v1/scenarios
 * Lists all available deterministic test scenarios
 */
router.get('/', (req: Request, res: Response) => {
  const scenarioList = SCENARIO_DEFINITIONS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    stepCount: s.steps.length,
    expectedFinalState: s.expectedFinalState,
    demonstrates: s.demonstrates
  }));

  res.status(200).json({
    data: { scenarios: scenarioList },
    scenarios: scenarioList,
    requestId: req.id
  });
});

/**
 * POST /api/v1/scenarios/:id/run
 * Executes a deterministic scenario and returns complete step-by-step telemetry
 */
router.post('/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarioId = req.params.id;
    if (!SCENARIOS[scenarioId]) {
      throw new NotFoundError(
        `Scenario '${scenarioId}' not found. Available: ${Object.keys(SCENARIOS).join(', ')}`,
        'SCENARIO_NOT_FOUND'
      );
    }

    const result = await runScenario(scenarioId);

    res.status(200).json({
      data: result,
      ...result,
      actions: result.trajectory.actions,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

export const scenariosRouter = router;
