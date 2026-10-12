import { ActionType } from './action.js';
import { PolicyDecisionAction } from './decision.js';

/**
 * Trajectory states representing behavioral drift over time
 */
export type TrajectoryState =
  | 'NORMAL'     // 0 - 30
  | 'WATCH'      // 31 - 50
  | 'DRIFTING'   // 51 - 70
  | 'ESCALATING' // 71 - 85
  | 'CRITICAL';  // 86 - 100

export type RiskVelocity = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
export type RiskAcceleration = 'FALLING' | 'STABLE' | 'RISING' | 'SURGING';

/**
 * 10 Explainable Trajectory Features (normalized 0 - 100)
 */
export interface TrajectoryFeatures {
  resourceNovelty: number;           // 0 - 100: Degree of access to newly encountered resources
  scopeExpansion: number;            // 0 - 100: Growth rate of requested permissions vs baseline
  sensitivityEscalation: number;     // 0 - 100: Trend towards higher data sensitivity
  actionTypeChange: number;          // 0 - 100: Frequency of unusual action verbs
  authorizationFailures: number;     // 0 - 100: Ratio of unauthorized scope attempts
  actionVelocity: number;            // 0 - 100: Rate of actions per second/minute
  resourceDiversity: number;         // 0 - 100: Spread across different resource hierarchies
  crossBoundaryAccess: number;       // 0 - 100: Crossing from permitted to isolated domains
  destructiveActionPresence: number; // 0 - 100: Frequency of irreversible DELETE/UPDATE
  sequenceDeviation: number;         // 0 - 100: Divergence from canonical workflow sequence
}

/**
 * Weighted breakdown of trajectory deviation components
 */
export interface TrajectoryDeviationComponents {
  scopeExpansion: number;
  resourceNovelty: number;
  sequenceDeviation: number;
  sensitivityEscalation: number;
  authorizationFailures: number;
  velocityChange: number;
  crossBoundaryAccess: number;
  destructiveBehavior: number;
}

/**
 * Chronological item for trajectory playback and history replay
 */
export interface TrajectoryReplayItem {
  eventId: string;
  timestamp: string;
  action: ActionType;
  resource: string;
  resourceType: string;
  risk: number;
  trajectoryDeviation: number;
  state: TrajectoryState;
  decision: PolicyDecisionAction;
  reasons?: string[];
}

/**
 * Complete trajectory response for GET /api/v1/sessions/:id/trajectory
 */
export interface SessionTrajectoryResponse {
  sessionId: string;
  agentId: string;
  actionCount: number;
  currentRisk: number;
  trajectoryDeviation: number;
  riskDelta: number;
  riskVelocity: RiskVelocity;
  riskAcceleration: RiskAcceleration;
  state: TrajectoryState;
  features: TrajectoryFeatures;
  components: TrajectoryDeviationComponents;
  actions: TrajectoryReplayItem[];
  explanation: {
    simpleText: string;
    plainReasons: string[];
  };
}

/**
 * Compact risk telemetry response for GET /api/v1/sessions/:id/risk
 */
export interface SessionRiskTelemetryResponse {
  sessionId: string;
  agentId: string;
  currentRisk: number;
  trajectoryDeviation: number;
  riskDelta: number;
  riskVelocity: RiskVelocity;
  riskAcceleration: RiskAcceleration;
  state: TrajectoryState;
  actionCount: number;
  lastUpdated: string;
}

// Backwards compatibility alias for Phase 0/1
export type TrajectoryPhase =
  | 'NORMAL_ACTIONS'
  | 'UNUSUAL_ACTIONS'
  | 'SCOPE_EXPANSION'
  | 'SENSITIVE_RESOURCE_ACCESS'
  | 'PRIVILEGE_ESCALATION'
  | 'POTENTIALLY_DESTRUCTIVE';

export interface TrajectoryAssessment {
  id: string;
  sessionId: string;
  currentPhase: TrajectoryPhase;
  deviationScore: number;
  historicalBaselineMatch: number;
  scopeExpansionDetected: boolean;
  unauthorizedAccessAttempted: boolean;
  timestamp: string;
  summary: string;
}
