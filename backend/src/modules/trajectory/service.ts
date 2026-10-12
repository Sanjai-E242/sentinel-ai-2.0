import {
  Agent,
  Session,
  ActionEvent,
  SessionTrajectoryResponse,
  SessionRiskTelemetryResponse,
  TrajectoryReplayItem
} from '@sentinel/shared';
import { getBaselineForAgent } from './baseline.js';
import { extractTrajectoryFeatures, calculateTrajectoryDeviation } from './features.js';
import { calculateBaseActionRisk, evaluateSessionRisk, resolveTrajectoryState } from '../risk/engine.js';
import { SessionRepository, sessionRepository as defaultSessionRepo } from '../sessions/repository.js';
import { AgentRepository, agentRepository as defaultAgentRepo } from '../agents/repository.js';
import { ActionEventRepository, actionEventRepository as defaultActionRepo } from '../actions/repository.js';
import { NotFoundError } from '../../middleware/errorHandler.js';

export interface TrajectoryEvaluationResult {
  actionRisk: number;
  trajectoryDeviation: number;
  currentRisk: number;
  riskDelta: number;
  riskVelocity: import('@sentinel/shared').RiskVelocity;
  riskAcceleration: import('@sentinel/shared').RiskAcceleration;
  state: import('@sentinel/shared').TrajectoryState;
  features: import('@sentinel/shared').TrajectoryFeatures;
  components: import('@sentinel/shared').TrajectoryDeviationComponents;
  plainReasons: string[];
  simpleText: string;
}

export class TrajectoryService {
  constructor(
    private sessionRepo: SessionRepository = defaultSessionRepo,
    private agentRepo: AgentRepository = defaultAgentRepo,
    private actionRepo: ActionEventRepository = defaultActionRepo
  ) {}

  public setRepositories(
    sessionRepo: SessionRepository,
    agentRepo: AgentRepository,
    actionRepo: ActionEventRepository
  ): void {
    this.sessionRepo = sessionRepo;
    this.agentRepo = agentRepo;
    this.actionRepo = actionRepo;
  }

  /**
   * Evaluates trajectory features and cumulative risk for an incoming action
   */
  public evaluateActionTrajectory(params: {
    action: ActionEvent;
    actionHistory: ActionEvent[];
    agent: Agent;
    session: Session;
  }): TrajectoryEvaluationResult {
    const { action, actionHistory, agent, session } = params;

    // 1. Resolve behavioral baseline for agent
    const baseline = getBaselineForAgent(agent);

    // 2. Extract 10 explainable trajectory features
    const features = extractTrajectoryFeatures(action, actionHistory, baseline);

    // 3. Calculate weighted trajectory deviation & component breakdown
    const deviationResult = calculateTrajectoryDeviation(features);

    // 4. Calculate raw action risk
    const actionRisk = calculateBaseActionRisk(action);

    // 5. Evaluate session cumulative risk, delta, velocity, acceleration, and state
    const previousRisk = session.currentRisk || 0;
    const previousRiskDelta = session.riskDelta || 0;

    const riskResult = evaluateSessionRisk({
      action,
      actionRisk,
      trajectoryDeviation: deviationResult.trajectoryDeviation,
      previousRisk,
      previousRiskDelta,
      actionHistoryLength: actionHistory.length
    });

    return {
      actionRisk,
      trajectoryDeviation: deviationResult.trajectoryDeviation,
      currentRisk: riskResult.currentRisk,
      riskDelta: riskResult.riskDelta,
      riskVelocity: riskResult.riskVelocity,
      riskAcceleration: riskResult.riskAcceleration,
      state: riskResult.state,
      features,
      components: deviationResult.components,
      plainReasons: deviationResult.plainReasons,
      simpleText: deviationResult.simpleText
    };
  }

  /**
   * Retrieves complete trajectory telemetry and replay sequence for a session
   */
  public async getSessionTrajectory(sessionId: string): Promise<SessionTrajectoryResponse> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session '${sessionId}' not found`, 'SESSION_NOT_FOUND');
    }

    const agent = await this.agentRepo.findById(session.agentId);
    const actions = await this.actionRepo.findBySessionId(sessionId);

    // Sort actions chronologically
    actions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const baseline = getBaselineForAgent(agent || undefined);

    // If session has actions, compute features based on latest action sequence
    let features = extractTrajectoryFeatures(
      actions[actions.length - 1] || {
        eventId: 'none',
        agentId: session.agentId,
        sessionId,
        timestamp: session.startedAt,
        action: 'READ',
        resource: 'none',
        resourceType: 'none',
        scope: 'none',
        sensitivity: 'LOW',
        reversibility: 'REVERSIBLE',
        authorization: 'UNKNOWN'
      },
      actions.slice(0, -1),
      baseline
    );

    const deviationResult = calculateTrajectoryDeviation(features);

    // Build chronological replay items with point-in-time risk progression
    let runningRisk = 0;
    const replayItems: TrajectoryReplayItem[] = [];

    for (let i = 0; i < actions.length; i++) {
      const act = actions[i];
      const past = actions.slice(0, i);
      const feat = extractTrajectoryFeatures(act, past, baseline);
      const dev = calculateTrajectoryDeviation(feat);
      const rawRisk = calculateBaseActionRisk(act);
      const evaluated = evaluateSessionRisk({
        action: act,
        actionRisk: rawRisk,
        trajectoryDeviation: dev.trajectoryDeviation,
        previousRisk: runningRisk,
        actionHistoryLength: i
      });
      runningRisk = evaluated.currentRisk;

      // Extract policy decision from action metadata or default
      const decisionAction = (act.metadata?.decision as any)?.action || (act.authorization === 'UNAUTHORIZED' ? 'CONFIRM' : 'ALLOW');

      replayItems.push({
        eventId: act.eventId,
        timestamp: act.timestamp,
        action: act.action,
        resource: act.resource,
        resourceType: act.resourceType,
        risk: evaluated.currentRisk,
        trajectoryDeviation: dev.trajectoryDeviation,
        state: evaluated.state,
        decision: decisionAction,
        reasons: dev.plainReasons
      });
    }

    const currentRisk = session.currentRisk ?? (replayItems.length > 0 ? replayItems[replayItems.length - 1].risk : 0);
    const trajectoryDeviation = session.trajectoryDeviation ?? (replayItems.length > 0 ? replayItems[replayItems.length - 1].trajectoryDeviation : 0);
    const state = session.trajectoryState || resolveTrajectoryState(currentRisk);

    return {
      sessionId: session.id,
      agentId: session.agentId,
      actionCount: session.actionCount || actions.length,
      currentRisk,
      trajectoryDeviation,
      riskDelta: session.riskDelta ?? 0,
      riskVelocity: session.riskVelocity ?? (currentRisk > 60 ? 'HIGH' : currentRisk > 30 ? 'MEDIUM' : 'LOW'),
      riskAcceleration: session.riskAcceleration ?? 'STABLE',
      state,
      features,
      components: deviationResult.components,
      actions: replayItems,
      explanation: {
        simpleText: deviationResult.simpleText,
        plainReasons: deviationResult.plainReasons
      }
    };
  }

  /**
   * Compact risk telemetry response for dashboard polling
   */
  public async getSessionRiskTelemetry(sessionId: string): Promise<SessionRiskTelemetryResponse> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session '${sessionId}' not found`, 'SESSION_NOT_FOUND');
    }

    const currentRisk = session.currentRisk || 0;
    const trajectoryDeviation = session.trajectoryDeviation || 0;
    const state = session.trajectoryState || resolveTrajectoryState(currentRisk);

    return {
      sessionId: session.id,
      agentId: session.agentId,
      currentRisk,
      trajectoryDeviation,
      riskDelta: session.riskDelta || 0,
      riskVelocity: session.riskVelocity || (currentRisk > 60 ? 'HIGH' : currentRisk > 30 ? 'MEDIUM' : 'LOW'),
      riskAcceleration: session.riskAcceleration || 'STABLE',
      state,
      actionCount: session.actionCount || 0,
      lastUpdated: session.endedAt || session.startedAt
    };
  }
}

export const trajectoryService = new TrajectoryService();
