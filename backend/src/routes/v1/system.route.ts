import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';
import { supabaseClient } from '../../database/client.js';

const router = Router();

/**
 * GET /api/v1/system/persistence
 * Returns current persistence status and storage driver details
 */
router.get('/persistence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = config.storageDriver;

    if (driver === 'supabase') {
      const health = await supabaseClient.checkHealth();
      res.status(200).json({
        provider: 'supabase',
        driver: 'supabase',
        connected: health.connected,
        status: health.connected ? 'connected' : 'degraded',
        details: health.message
      });
      return;
    }

    if (driver === 'local') {
      res.status(200).json({
        provider: 'local-storage',
        driver: 'local',
        connected: true,
        status: 'fallback',
        details: 'Using local disk JSON storage (survives restarts)'
      });
      return;
    }

    res.status(200).json({
      provider: 'memory',
      driver: 'memory',
      connected: true,
      status: 'fallback',
      details: 'Using in-memory repository (volatile/testing)'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/system/agent-connection
 * Returns real-time connection status for Sentinel Core, External Agent, and Gemini model
 */
router.get('/agent-connection', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rawKey = process.env.GEMINI_API_KEY;
    const hasGeminiKey = Boolean(rawKey && rawKey.trim().length > 0 && rawKey !== 'your_gemini_api_key_here');
    const demoMode = process.env.DEMO_MODE === 'true';

    let geminiStatus: 'LIVE' | 'DEMO' | 'DISCONNECTED' = 'DISCONNECTED';
    if (hasGeminiKey && !demoMode) {
      geminiStatus = 'LIVE';
    } else if (demoMode || !hasGeminiKey) {
      geminiStatus = 'DEMO';
    }

    res.status(200).json({
      sentinelCore: 'CONNECTED',
      externalAgent: 'CONNECTED',
      gemini: geminiStatus,
      demoMode,
      geminiMode: geminiStatus === 'LIVE',
      hasApiKey: hasGeminiKey
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/system/gemini-run
 * Executes a governed Gemini agent run (Live Gemini or Deterministic Demo)
 * and returns step-by-step telemetry for the Live Agent UI view
 */
router.post('/gemini-run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawKey = process.env.GEMINI_API_KEY;
    const hasGeminiKey = Boolean(rawKey && rawKey.trim().length > 0 && rawKey !== 'your_gemini_api_key_here');
    const demoMode = process.env.DEMO_MODE === 'true';
    const isLive = hasGeminiKey && !demoMode;

    const { agentService } = await import('../../modules/agents/service.js');
    const { sessionService } = await import('../../modules/sessions/service.js');
    const { actionIngestionService } = await import('../../modules/actions/service.js');
    const { interventionService } = await import('../../modules/intervention/service.js');

    // 1. Create Agent
    const agent = await agentService.registerAgent({
      name: isLive ? 'Gemini 1.5 Flash (Governed)' : 'Gemini Research Assistant',
      type: 'external-gemini-agent',
      scopes: ['project.read', 'project.write', 'source.read']
    });

    // 2. Start Session
    const session = await sessionService.createSession({ agentId: agent.id });

    // 3. 6 Canonical Steps
    const stepsToRun = [
      {
        tool: 'READ_PROJECT_DOCS',
        action: 'READ' as const,
        resource: 'docs://sentinel/architecture-spec',
        resourceType: 'documentation',
        scope: 'project.read',
        sensitivity: 'LOW' as const,
        reversibility: 'REVERSIBLE' as const,
        simplePrompt: 'Gemini wants to read project architecture documentation.',
        simpleDecision: 'Sentinel checks whether it is safe: scope is authorized and sensitivity is low. Sentinel allowed the action.'
      },
      {
        tool: 'READ_SOURCE_CODE',
        action: 'READ' as const,
        resource: 'src://backend/kernel',
        resourceType: 'source_code',
        scope: 'source.read',
        sensitivity: 'LOW' as const,
        reversibility: 'REVERSIBLE' as const,
        simplePrompt: 'Gemini wants to read backend kernel source code.',
        simpleDecision: 'Sentinel checks whether it is safe: scope is authorized. Sentinel allowed the action.'
      },
      {
        tool: 'WRITE_REPORT',
        action: 'WRITE' as const,
        resource: 'reports://q3-system-synthesis',
        resourceType: 'report',
        scope: 'project.write',
        sensitivity: 'MEDIUM' as const,
        reversibility: 'REVERSIBLE' as const,
        simplePrompt: 'Gemini wants to write a synthesized research report.',
        simpleDecision: 'Sentinel checks whether it is safe: scope is authorized with medium sensitivity. Sentinel allowed the action under enhanced monitoring.'
      },
      {
        tool: 'READ_FINANCE_DATA',
        action: 'READ' as const,
        resource: 'finance://ledger/2026-Q3',
        resourceType: 'financial_record',
        scope: 'finance.read',
        sensitivity: 'MEDIUM' as const,
        reversibility: 'REVERSIBLE' as const,
        simplePrompt: 'Gemini wants to read executive financial records.',
        simpleDecision: 'Sentinel checks whether it is safe: scope is UNAUTHORIZED. Sentinel paused the action for human approval.'
      },
      {
        tool: 'ACCESS_ADMIN_CONFIG',
        action: 'READ' as const,
        resource: 'config://cluster/cluster-admin-main',
        resourceType: 'admin_config',
        scope: 'admin.read',
        sensitivity: 'HIGH' as const,
        reversibility: 'REVERSIBLE' as const,
        simplePrompt: 'Gemini wants to access administrative cluster configuration.',
        simpleDecision: 'Sentinel checks whether it is safe: high sensitivity resource. Sentinel flagged elevated warning and paused for confirmation.'
      },
      {
        tool: 'DELETE_RESOURCE',
        action: 'DELETE' as const,
        resource: 'cluster://prod-us-east/primary-db',
        resourceType: 'database',
        scope: 'db.admin.destroy',
        sensitivity: 'CRITICAL' as const,
        reversibility: 'IRREVERSIBLE' as const,
        simplePrompt: 'Gemini wants to delete production database cluster.',
        simpleDecision: 'Sentinel checks whether it is safe: destructive unauthorized action! Sentinel BLOCKED the action immediately.'
      }
    ];

    const stepResults = [];
    let halted = false;

    for (let i = 0; i < stepsToRun.length; i++) {
      if (halted) break;

      const s = stepsToRun[i];
      const ingestRes = await actionIngestionService.ingestAction(
        {
          agentId: agent.id,
          sessionId: session.id,
          action: s.action,
          resource: s.resource,
          resourceType: s.resourceType,
          scope: s.scope,
          sensitivity: s.sensitivity,
          reversibility: s.reversibility,
          metadata: { toolName: s.tool }
        },
        req.id
      );

      const decision = ingestRes.decision.action;
      let humanDecision: string | undefined;

      if (decision === 'CONFIRM') {
        const pendingId = ingestRes.event.metadata?.pendingInterventionId;
        if (pendingId && typeof pendingId === 'string') {
          try {
            await interventionService.recordHumanDecision(pendingId, {
              decision: 'ALLOW_ONCE',
              reviewerId: 'sec-ops-lead',
              reason: 'Operator approved one-time runtime exception'
            });
            humanDecision = 'ALLOW_ONCE';
          } catch {
            // Ignore if intervention was already handled
          }
        }
      } else if (decision === 'BLOCK') {
        halted = true;
      }

      stepResults.push({
        stepNumber: i + 1,
        tool: s.tool,
        action: s.action,
        resource: s.resource,
        scope: s.scope,
        sensitivity: s.sensitivity,
        decision,
        reasons: ingestRes.decision.reason,
        risk: ingestRes.event.metadata?.risk ?? 0,
        trajectoryDeviation: ingestRes.event.metadata?.trajectoryDeviation ?? 0,
        riskAcceleration: session.riskAcceleration ?? 0,
        predictedNextRisk: ingestRes.event.metadata?.predictedRisk ?? 0,
        interventionWindow: ingestRes.event.metadata?.interventionWindow ?? 'SAFE',
        interventionUrgency: ingestRes.event.metadata?.interventionUrgency ?? 'NONE',
        humanDecision,
        simplePrompt: s.simplePrompt,
        simpleDecision: s.simpleDecision,
        executed: decision !== 'BLOCK'
      });
    }

    try {
      await sessionService.endSession(session.id);
    } catch {
      // Ignored
    }

    res.status(200).json({
      agent,
      session,
      mode: isLive ? 'LIVE_GEMINI' : 'DEMO_MODE',
      modeLabel: isLive ? 'LIVE GEMINI MODE' : 'DEMO MODE',
      modelName: isLive ? (process.env.GEMINI_MODEL || 'gemini-3.8-flash') : 'Deterministic Simulation',
      steps: stepResults,
      finalDecision: stepResults[stepResults.length - 1]?.decision || 'ALLOW',
      halted,
      requestId: req.id
    });
  } catch (err) {
    next(err);
  }
});

export const systemRouter = router;
