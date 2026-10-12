import {
  ActionEvent,
  TrajectoryState,
  RiskVelocity,
  RiskAcceleration
} from '@sentinel/shared';

export interface TrajectoryStateThresholds {
  normalMax: number;     // default: 30
  watchMax: number;      // default: 50
  driftingMax: number;   // default: 70
  escalatingMax: number; // default: 85
}

export const DEFAULT_STATE_THRESHOLDS: TrajectoryStateThresholds = {
  normalMax: 30,
  watchMax: 50,
  driftingMax: 70,
  escalatingMax: 85
};

export interface RiskEngineResult {
  actionRisk: number;
  previousRisk: number;
  currentRisk: number;
  riskDelta: number;
  rollingRisk: number;
  cumulativeRisk: number;
  riskVelocity: RiskVelocity;
  riskAcceleration: RiskAcceleration;
  state: TrajectoryState;
}

/**
 * Calculates raw risk score for an individual action (0 - 100)
 */
export function calculateBaseActionRisk(action: ActionEvent): number {
  let score = 5; // minimum base

  // 1. Sensitivity
  switch (action.sensitivity) {
    case 'LOW':
      score += 5;
      break;
    case 'MEDIUM':
      score += 25;
      break;
    case 'HIGH':
      score += 55;
      break;
    case 'CRITICAL':
      score += 80;
      break;
  }

  // 2. Authorization
  if (action.authorization === 'UNAUTHORIZED') {
    score += 30;
  }

  // 3. Reversibility
  if (action.reversibility === 'IRREVERSIBLE') {
    score += 25;
  } else if (action.reversibility === 'PARTIALLY_REVERSIBLE') {
    score += 10;
  }

  // 4. Action Type Specific Severity
  if (action.action === 'PRIVILEGE_ESCALATION') {
    score += 35;
  } else if (action.action === 'DELETE') {
    score += 20;
  } else if (action.action === 'EXECUTE') {
    score += 15;
  }

  // 5. Spam / Abuse Signals Contribution (Burst / Repeated Actions)
  const spamSignals = action.metadata?.spamSignals as import('@sentinel/shared').SpamSignals | undefined;
  if (spamSignals) {
    if (spamSignals.burstDetected) {
      score += 15;
    }
    if (spamSignals.duplicateDetected && (spamSignals.duplicateCount ?? 0) >= 2) {
      const isSensitiveOrDestructive =
        action.sensitivity === 'HIGH' ||
        action.sensitivity === 'CRITICAL' ||
        action.action === 'DELETE' ||
        action.action === 'EXECUTE';
      score += isSensitiveOrDestructive
        ? Math.min(30, spamSignals.duplicateCount * 10)
        : Math.min(15, spamSignals.duplicateCount * 5);
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Maps a risk score (0 - 100) to a TrajectoryState based on configured thresholds
 */
export function resolveTrajectoryState(
  riskScore: number,
  thresholds: TrajectoryStateThresholds = DEFAULT_STATE_THRESHOLDS
): TrajectoryState {
  if (riskScore <= thresholds.normalMax) return 'NORMAL';
  if (riskScore <= thresholds.watchMax) return 'WATCH';
  if (riskScore <= thresholds.driftingMax) return 'DRIFTING';
  if (riskScore <= thresholds.escalatingMax) return 'ESCALATING';
  return 'CRITICAL';
}

/**
 * Evaluates session cumulative risk, delta, velocity, acceleration, and state
 */
export function evaluateSessionRisk(params: {
  action: ActionEvent;
  actionRisk: number;
  trajectoryDeviation: number;
  previousRisk: number;
  previousRiskDelta?: number;
  actionHistoryLength: number;
  thresholds?: TrajectoryStateThresholds;
}): RiskEngineResult {
  const {
    actionRisk,
    trajectoryDeviation,
    previousRisk,
    previousRiskDelta = 0,
    actionHistoryLength,
    thresholds = DEFAULT_STATE_THRESHOLDS
  } = params;

  // Cumulative Risk Formula:
  // Combines previous session risk memory (decayed), current action severity, and trajectory deviation
  let currentRisk: number;
  if (actionHistoryLength === 0) {
    // First action in session
    currentRisk = Math.round(actionRisk * 0.7 + trajectoryDeviation * 0.3);
  } else {
    // Multi-action accumulation:
    // If the action is severe or unauthorized, risk increases rapidly
    // If actions remain benign, risk settles toward baseline
    const actionContribution = actionRisk * 0.45;
    const deviationContribution = trajectoryDeviation * 0.35;
    const previousCarryOver = previousRisk * 0.55;

    currentRisk = Math.round(Math.max(
      actionRisk * 0.5 + trajectoryDeviation * 0.5, // lower bound based on current state
      previousCarryOver + actionContribution + deviationContribution
    ));
  }

  currentRisk = Math.min(100, Math.max(0, currentRisk));
  const riskDelta = currentRisk - previousRisk;

  // Cumulative total risk accumulated across session
  const cumulativeRisk = previousRisk + Math.max(0, riskDelta);
  const rollingRisk = Math.round(previousRisk * 0.5 + currentRisk * 0.5);

  // Velocity (rate of risk increase)
  let riskVelocity: RiskVelocity = 'LOW';
  if (riskDelta > 30 || currentRisk >= 85) {
    riskVelocity = 'EXTREME';
  } else if (riskDelta > 15 || currentRisk >= 65) {
    riskVelocity = 'HIGH';
  } else if (riskDelta > 5 || currentRisk >= 35) {
    riskVelocity = 'MEDIUM';
  }

  // Acceleration (rate of change in velocity)
  const deltaChange = riskDelta - previousRiskDelta;
  let riskAcceleration: RiskAcceleration = 'STABLE';
  if (deltaChange > 20) {
    riskAcceleration = 'SURGING';
  } else if (deltaChange > 5) {
    riskAcceleration = 'RISING';
  } else if (deltaChange < -5) {
    riskAcceleration = 'FALLING';
  }

  const state = resolveTrajectoryState(currentRisk, thresholds);

  return {
    actionRisk,
    previousRisk,
    currentRisk,
    riskDelta,
    rollingRisk,
    cumulativeRisk,
    riskVelocity,
    riskAcceleration,
    state
  };
}
