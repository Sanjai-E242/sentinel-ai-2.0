import { TrajectoryState, RiskVelocity, RiskAcceleration } from './trajectory.js';

/**
 * Agent runtime session tracking
 */
export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'REVOKED';

// Backwards-compatible alias for Phase 0 code
export type SessionStatusType = SessionStatus;

export interface Session {
  id: string;
  agentId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  currentRisk: number;
  trajectoryDeviation: number;
  actionCount?: number;
  riskDelta?: number;
  riskVelocity?: RiskVelocity;
  riskAcceleration?: RiskAcceleration;
  trajectoryState?: TrajectoryState;
  metadata?: Record<string, unknown>;
}

export interface CreateSessionInput {
  agentId: string;
  metadata?: Record<string, unknown>;
}
