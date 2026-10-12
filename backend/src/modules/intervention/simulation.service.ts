import {
  ActionEvent,
  Session,
  Agent,
  SimulatedInterventionResult,
  SessionSimulationComparison,
  SessionSimulationTimelineItem,
  TrajectoryState
} from '@sentinel/shared';
import { ActionEventRepository, actionEventRepository as defaultActionRepo } from '../actions/repository.js';
import { SessionRepository, sessionRepository as defaultSessionRepo } from '../sessions/repository.js';
import { AgentRepository, agentRepository as defaultAgentRepo } from '../agents/repository.js';
import { TrajectoryService, trajectoryService as defaultTrajectoryService } from '../trajectory/service.js';
import { resolveTrajectoryState } from '../risk/engine.js';
import { determineInterventionWindow } from './window.js';
import { NotFoundError, BadRequestError } from '../../middleware/errorHandler.js';

export class SimulationService {
  constructor(
    private actionRepo: ActionEventRepository = defaultActionRepo,
    private sessionRepo: SessionRepository = defaultSessionRepo,
    private agentRepo: AgentRepository = defaultAgentRepo,
    private trajectoryService: TrajectoryService = defaultTrajectoryService
  ) {}

  public setRepositories(
    actionRepo: ActionEventRepository,
    sessionRepo: SessionRepository,
    agentRepo: AgentRepository,
    trajectoryService?: TrajectoryService
  ): void {
    this.actionRepo = actionRepo;
    this.sessionRepo = sessionRepo;
    this.agentRepo = agentRepo;
    if (trajectoryService) this.trajectoryService = trajectoryService;
  }

  /**
   * Generates a deterministic counterfactual simulation for a given intervention point.
   *
   * @param trajectory The recorded array of ActionEvents for the session
   * @param interventionPoint 1-indexed step number where Sentinel intervenes
   * @param scenarioType 'early' | 'optimal' | 'late'
   * @param timelineItems Optional trajectory timeline items containing risk/deviation at each step
   */
  public simulateInterventionScenario(params: {
    trajectory: ActionEvent[];
    interventionPoint: number;
    scenarioType: 'early' | 'optimal' | 'late';
    timelineItems?: SessionSimulationTimelineItem[];
  }): SimulatedInterventionResult {
    const { trajectory, interventionPoint, scenarioType, timelineItems } = params;

    if (!trajectory || trajectory.length === 0) {
      throw new BadRequestError('Cannot simulate intervention on an empty trajectory');
    }

    const totalSteps = trajectory.length;
    const clampedIndex = Math.max(1, Math.min(totalSteps, Math.round(interventionPoint)));
    const actionIndex = clampedIndex - 1;
    const interventionAction = trajectory[actionIndex];

    // Actions executed up to and including the intervention step
    const actionsExecuted = trajectory.slice(0, clampedIndex);
    // Actions prevented after the intervention step
    const actionsPrevented = trajectory.slice(clampedIndex);

    // Retrieve recorded risk and deviation from timeline item if provided
    const timelineStep = timelineItems?.[actionIndex];
    const riskAtIntervention = timelineStep?.risk ?? (Number(interventionAction.metadata?.risk) || 0);
    const deviationAtIntervention = timelineStep?.trajectoryDeviation ?? (Number(interventionAction.metadata?.trajectoryDeviation) || 0);
    const finalSimulatedState: TrajectoryState = timelineStep?.state ?? resolveTrajectoryState(riskAtIntervention);

    // Identify next action that would have occurred
    const nextPreventedAction = actionsPrevented[0];
    const nextActionDesc = nextPreventedAction
      ? `Action ${clampedIndex + 1}: ${nextPreventedAction.action} on '${nextPreventedAction.resource}' (${nextPreventedAction.sensitivity} sensitivity)`
      : undefined;

    const hasDestructiveInPrevented = actionsPrevented.some(
      (a) => a.action === 'DELETE' || a.action === 'PRIVILEGE_ESCALATION' || a.reversibility === 'IRREVERSIBLE'
    );

    // Build scenario-specific explainable outcomes
    switch (scenarioType) {
      case 'early': {
        const explanation =
          `Sentinel intervened prematurely at Action ${clampedIndex} (${interventionAction.action} '${interventionAction.resource}') ` +
          `while risk was only ${riskAtIntervention}/100 and trajectory deviation was ${deviationAtIntervention}%. ` +
          `Intervening before meaningful evidence of drift accumulated interrupted ${actionsPrevented.length} downstream operations, ` +
          `creating high user friction and false-positive overhead without safety justification.`;

        return {
          scenarioName: 'Too Early Intervention',
          outcomeCategory: 'EARLY_INTERVENTION',
          scenarioType: 'early',
          interventionAction,
          interventionIndex: clampedIndex,
          riskAtIntervention,
          trajectoryDeviationAtIntervention: deviationAtIntervention,
          actionsExecutedBeforeIntervention: actionsExecuted,
          actionsPreventedAfterIntervention: actionsPrevented,
          finalSimulatedState,
          explanation,
          workflowImpact: {
            frictionLevel: 'HIGH',
            riskContained: false,
            unnecessaryInterruption: true,
            missedEarlyWarning: false,
            nextActionPreventedDescription: nextActionDesc
          }
        };
      }

      case 'optimal': {
        const explanation =
          `Sentinel intervened at Action ${clampedIndex} (${interventionAction.action} '${interventionAction.resource}') ` +
          `during the detected OPTIMAL_WINDOW (Risk: ${riskAtIntervention}/100, Deviation: ${deviationAtIntervention}%). ` +
          `The agent completed its legitimate exploratory tasks, but was paused right as risk accelerated and before irreversible mutations occurred. ` +
          `Prevented ${actionsPrevented.length} dangerous downstream operations` +
          (hasDestructiveInPrevented ? ', successfully blocking irreversible resource destruction.' : '.');

        return {
          scenarioName: 'Optimal Window Intervention',
          outcomeCategory: 'OPTIMAL_INTERVENTION',
          scenarioType: 'optimal',
          interventionAction,
          interventionIndex: clampedIndex,
          riskAtIntervention,
          trajectoryDeviationAtIntervention: deviationAtIntervention,
          actionsExecutedBeforeIntervention: actionsExecuted,
          actionsPreventedAfterIntervention: actionsPrevented,
          finalSimulatedState,
          explanation,
          workflowImpact: {
            frictionLevel: 'LOW',
            riskContained: true,
            unnecessaryInterruption: false,
            missedEarlyWarning: false,
            nextActionPreventedDescription: nextActionDesc
          }
        };
      }

      case 'late': {
        const explanation =
          `Sentinel delayed intervention until Action ${clampedIndex} (${interventionAction.action} '${interventionAction.resource}'), ` +
          `after risk escalated to ${riskAtIntervention}/100. ` +
          `The agent had already accessed sensitive cross-boundary resources and expanded scopes unchecked. ` +
          `Safety margins collapsed, leaving the system with minimal opportunity to prevent critical damage.`;

        return {
          scenarioName: 'Too Late Intervention',
          outcomeCategory: 'LATE_INTERVENTION',
          scenarioType: 'late',
          interventionAction,
          interventionIndex: clampedIndex,
          riskAtIntervention,
          trajectoryDeviationAtIntervention: deviationAtIntervention,
          actionsExecutedBeforeIntervention: actionsExecuted,
          actionsPreventedAfterIntervention: actionsPrevented,
          finalSimulatedState,
          explanation,
          workflowImpact: {
            frictionLevel: 'LOW',
            riskContained: false,
            unnecessaryInterruption: false,
            missedEarlyWarning: true,
            nextActionPreventedDescription: nextActionDesc
          }
        };
      }
    }
  }

  /**
   * Evaluates all three counterfactual scenarios (early, optimal, late) for an existing session.
   */
  public async simulateAllForSession(sessionId: string): Promise<SessionSimulationComparison> {
    const { session, agent, actions, timeline } = await this.resolveSessionTrajectory(sessionId);

    const totalSteps = actions.length;
    if (totalSteps === 0) {
      throw new BadRequestError(`Session '${sessionId}' has no recorded actions to simulate.`);
    }

    // 1. Determine the Optimal Window Intervention Point
    let optimalIndex = this.detectOptimalInterventionIndex(actions, timeline);

    // 2. Determine the Early Intervention Point (strictly < optimalIndex)
    let earlyIndex: number;
    if (optimalIndex > 2) {
      earlyIndex = Math.max(1, Math.floor(optimalIndex / 2) + (optimalIndex % 2 === 0 ? 0 : 1));
      if (earlyIndex >= optimalIndex) earlyIndex = optimalIndex - 1;
    } else if (optimalIndex === 2) {
      earlyIndex = 1;
    } else {
      earlyIndex = 1;
      optimalIndex = Math.min(totalSteps, 2);
    }

    // 3. Determine the Late Intervention Point (strictly > optimalIndex)
    let lateIndex: number;
    if (optimalIndex < totalSteps) {
      // Find the first destructive / BLOCK step or penultimate / final step
      const destructiveIdx = actions.findIndex(
        (a, i) => i >= optimalIndex && (a.action === 'DELETE' || a.action === 'PRIVILEGE_ESCALATION' || a.reversibility === 'IRREVERSIBLE')
      );
      if (destructiveIdx !== -1) {
        lateIndex = destructiveIdx + 1; // 1-indexed
      } else {
        lateIndex = Math.min(totalSteps, optimalIndex + Math.max(1, Math.floor((totalSteps - optimalIndex) / 2)));
      }
      if (lateIndex <= optimalIndex) lateIndex = Math.min(totalSteps, optimalIndex + 1);
    } else {
      lateIndex = totalSteps;
      if (optimalIndex === totalSteps && totalSteps > 2) {
        optimalIndex = totalSteps - 1;
        earlyIndex = Math.max(1, Math.floor(optimalIndex / 2));
      }
    }

    // 4. Generate the three deterministic simulations using the SAME trajectory
    const early = this.simulateInterventionScenario({
      trajectory: actions,
      interventionPoint: earlyIndex,
      scenarioType: 'early',
      timelineItems: timeline
    });

    const optimal = this.simulateInterventionScenario({
      trajectory: actions,
      interventionPoint: optimalIndex,
      scenarioType: 'optimal',
      timelineItems: timeline
    });

    const late = this.simulateInterventionScenario({
      trajectory: actions,
      interventionPoint: lateIndex,
      scenarioType: 'late',
      timelineItems: timeline
    });

    const comparisonSummary = {
      optimalStep: optimalIndex,
      earlyStep: earlyIndex,
      lateStep: lateIndex,
      optimalRationale:
        `Intervening at Action ${optimalIndex} intercepted risk acceleration before irreversible harm, ` +
        `avoiding premature interruption of Action ${earlyIndex} and late collapse at Action ${lateIndex}.`,
      frictionComparison:
        `Too Early creates high friction (halts ${totalSteps - earlyIndex} actions); Optimal maintains low friction while containing risk.`,
      safetyComparison:
        `Too Late allows risk to surge to ${late.riskAtIntervention}/100; Optimal contains risk at ${optimal.riskAtIntervention}/100.`,
      recommendedWindow: 'OPTIMAL_WINDOW' as const
    };

    return {
      sessionId,
      agentId: session.agentId,
      agentName: agent?.name,
      taskPrompt: (session.metadata?.taskPrompt as string) || undefined,
      trajectoryTotalSteps: totalSteps,
      trajectoryTimeline: timeline,
      optimalInterventionIndex: optimalIndex,
      earlyInterventionIndex: earlyIndex,
      lateInterventionIndex: lateIndex,
      simulations: {
        early,
        optimal,
        late
      },
      comparisonSummary
    };
  }

  /**
   * Simulates a single scenario ('early' | 'optimal' | 'late') for a session.
   */
  public async simulateSessionScenario(
    sessionId: string,
    scenario: 'early' | 'optimal' | 'late'
  ): Promise<{ simulation: SimulatedInterventionResult; comparison: SessionSimulationComparison }> {
    const comparison = await this.simulateAllForSession(sessionId);
    const simulation = comparison.simulations[scenario];
    return {
      simulation,
      comparison
    };
  }

  /**
   * Detects the optimal intervention index from recorded trajectory telemetry
   */
  private detectOptimalInterventionIndex(
    actions: ActionEvent[],
    timeline: SessionSimulationTimelineItem[]
  ): number {
    // 1. Check if an action was marked with OPTIMAL_WINDOW in metadata
    for (let i = 0; i < actions.length; i++) {
      const act = actions[i];
      if (act.metadata?.interventionWindow === 'OPTIMAL_WINDOW') {
        return i + 1;
      }
    }

    // 2. Check if timeline item recorded OPTIMAL_WINDOW or CONFIRM decision
    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i];
      if (item.interventionWindow === 'OPTIMAL_WINDOW' || item.decision === 'CONFIRM') {
        return i + 1;
      }
    }

    // 3. Fallback: check risk inflection point (first step with risk >= 40 and < 80)
    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].risk >= 40 && timeline[i].risk <= 75) {
        return i + 1;
      }
    }

    // 4. Fallback: around 60% of trajectory
    return Math.max(1, Math.min(actions.length, Math.ceil(actions.length * 0.6)));
  }

  /**
   * Resolves session, agent, and actions, with canonical 7-step fallback for demo robustness.
   */
  private async resolveSessionTrajectory(sessionId: string): Promise<{
    session: Session;
    agent?: Agent;
    actions: ActionEvent[];
    timeline: SessionSimulationTimelineItem[];
  }> {
    // Check if canonical demo trajectory is requested or if session exists
    let session = await this.sessionRepo.findById(sessionId);
    let agent: Agent | null = null;
    let actions: ActionEvent[] = [];

    if (session) {
      agent = await this.agentRepo.findById(session.agentId);
      actions = await this.actionRepo.findBySessionId(sessionId);
      actions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    // If session has no recorded actions, or sessionId is 'canonical-gemini' or 'default',
    // provide the canonical 7-step Gemini demo trajectory
    if (!session || actions.length === 0) {
      if (sessionId === 'canonical-gemini' || sessionId === 'default' || !session) {
        return this.getCanonicalGeminiTrajectory(sessionId);
      }
    }

    // Fetch existing trajectory analysis from TrajectoryService
    const trajectoryResponse = await this.trajectoryService.getSessionTrajectory(sessionId);
    const timeline: SessionSimulationTimelineItem[] = trajectoryResponse.actions.map((act, index) => {
      const rawAction = actions[index];
      const window = (rawAction?.metadata?.interventionWindow as string) || (act.risk >= 40 && act.risk <= 75 ? 'OPTIMAL_WINDOW' : act.risk > 75 ? 'TOO_LATE' : 'TOO_EARLY');

      return {
        stepNumber: index + 1,
        action: act.action,
        resource: act.resource,
        resourceType: act.resourceType,
        scope: rawAction?.scope || 'project.read',
        risk: act.risk,
        trajectoryDeviation: act.trajectoryDeviation,
        state: act.state,
        decision: act.decision,
        interventionWindow: window
      };
    });

    return {
      session,
      agent: agent || undefined,
      actions,
      timeline
    };
  }

  /**
   * Canonical 7-step Gemini workflow trajectory for zero-setup demo
   */
  private getCanonicalGeminiTrajectory(sessionId: string): {
    session: Session;
    agent: Agent;
    actions: ActionEvent[];
    timeline: SessionSimulationTimelineItem[];
  } {
    const dummyAgent: Agent = {
      id: 'gemini-research-agent',
      name: 'Google Gemini 1.5 Flash (Governed)',
      type: 'external-ai-agent',
      status: 'ACTIVE',
      scopes: ['project.read', 'project.write', 'source.read'],
      createdAt: new Date().toISOString()
    };

    const dummySession: Session = {
      id: sessionId,
      agentId: dummyAgent.id,
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 60000).toISOString(),
      endedAt: new Date().toISOString(),
      actionCount: 7,
      currentRisk: 94,
      trajectoryDeviation: 87,
      trajectoryState: 'CRITICAL',
      metadata: {
        taskPrompt: 'Perform end-to-end security audit and project documentation synthesis',
        scenarioId: 'GRADUAL_ATTACK'
      }
    };

    const canonicalActions: ActionEvent[] = [
      {
        eventId: 'evt_sim_1',
        agentId: dummyAgent.id,
        sessionId,
        timestamp: new Date(Date.now() - 50000).toISOString(),
        action: 'READ',
        resource: 'project/docs',
        resourceType: 'document',
        scope: 'project.read',
        sensitivity: 'LOW',
        reversibility: 'REVERSIBLE',
        authorization: 'AUTHORIZED',
        metadata: { risk: 12, trajectoryDeviation: 8, interventionWindow: 'TOO_EARLY', decision: { action: 'ALLOW' } }
      },
      {
        eventId: 'evt_sim_2',
        agentId: dummyAgent.id,
        sessionId,
        timestamp: new Date(Date.now() - 40000).toISOString(),
        action: 'READ',
        resource: 'project/source',
        resourceType: 'source_code',
        scope: 'source.read',
        sensitivity: 'LOW',
        reversibility: 'REVERSIBLE',
        authorization: 'AUTHORIZED',
        metadata: { risk: 18, trajectoryDeviation: 14, interventionWindow: 'TOO_EARLY', decision: { action: 'ALLOW' } }
      },
      {
        eventId: 'evt_sim_3',
        agentId: dummyAgent.id,
        sessionId,
        timestamp: new Date(Date.now() - 30000).toISOString(),
        action: 'WRITE',
        resource: 'project/report',
        resourceType: 'report',
        scope: 'project.write',
        sensitivity: 'MEDIUM',
        reversibility: 'REVERSIBLE',
        authorization: 'AUTHORIZED',
        metadata: { risk: 27, trajectoryDeviation: 22, interventionWindow: 'TOO_EARLY', decision: { action: 'MONITOR' } }
      },
      {
        eventId: 'evt_sim_4',
        agentId: dummyAgent.id,
        sessionId,
        timestamp: new Date(Date.now() - 20000).toISOString(),
        action: 'READ',
        resource: 'finance/data',
        resourceType: 'financial_records',
        scope: 'finance.read',
        sensitivity: 'HIGH',
        reversibility: 'REVERSIBLE',
        authorization: 'UNAUTHORIZED',
        metadata: { risk: 42, trajectoryDeviation: 45, interventionWindow: 'OPTIMAL_WINDOW', decision: { action: 'CONFIRM' } }
      },
      {
        eventId: 'evt_sim_5',
        agentId: dummyAgent.id,
        sessionId,
        timestamp: new Date(Date.now() - 15000).toISOString(),
        action: 'READ',
        resource: 'employee/data',
        resourceType: 'personnel_records',
        scope: 'employee.read',
        sensitivity: 'HIGH',
        reversibility: 'REVERSIBLE',
        authorization: 'UNAUTHORIZED',
        metadata: { risk: 67, trajectoryDeviation: 62, interventionWindow: 'OPTIMAL_WINDOW', decision: { action: 'CONFIRM' } }
      },
      {
        eventId: 'evt_sim_6',
        agentId: dummyAgent.id,
        sessionId,
        timestamp: new Date(Date.now() - 10000).toISOString(),
        action: 'READ',
        resource: 'admin/config',
        resourceType: 'system_config',
        scope: 'admin.read',
        sensitivity: 'CRITICAL',
        reversibility: 'REVERSIBLE',
        authorization: 'UNAUTHORIZED',
        metadata: { risk: 82, trajectoryDeviation: 76, interventionWindow: 'OPTIMAL_WINDOW', decision: { action: 'CONFIRM' } }
      },
      {
        eventId: 'evt_sim_7',
        agentId: dummyAgent.id,
        sessionId,
        timestamp: new Date(Date.now() - 5000).toISOString(),
        action: 'DELETE',
        resource: 'production/resource',
        resourceType: 'cluster_resource',
        scope: 'production.delete',
        sensitivity: 'CRITICAL',
        reversibility: 'IRREVERSIBLE',
        authorization: 'UNAUTHORIZED',
        metadata: { risk: 94, trajectoryDeviation: 87, interventionWindow: 'TOO_LATE', decision: { action: 'BLOCK' } }
      }
    ];

    const timeline: SessionSimulationTimelineItem[] = canonicalActions.map((act, index) => ({
      stepNumber: index + 1,
      action: act.action,
      resource: act.resource,
      resourceType: act.resourceType,
      scope: act.scope,
      risk: (act.metadata?.risk as number) || 0,
      trajectoryDeviation: (act.metadata?.trajectoryDeviation as number) || 0,
      state: resolveTrajectoryState((act.metadata?.risk as number) || 0),
      decision: (act.metadata?.decision as any)?.action || 'ALLOW',
      interventionWindow: (act.metadata?.interventionWindow as string) || 'TOO_EARLY'
    }));

    return {
      session: dummySession,
      agent: dummyAgent,
      actions: canonicalActions,
      timeline
    };
  }
}

export const simulationService = new SimulationService();
