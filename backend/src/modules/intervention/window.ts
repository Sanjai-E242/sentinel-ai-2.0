import {
  InterventionWindow,
  InterventionUrgency,
  InterventionRecommendation,
  RiskVelocity,
  RiskAcceleration,
  ActionReversibility,
  ActionSensitivity
} from '@sentinel/shared';

export interface WindowEvaluationParams {
  currentRisk: number;
  trajectoryDeviation: number;
  riskDelta: number;
  riskVelocity: RiskVelocity;
  riskAcceleration: RiskAcceleration;
  predictedRisk: number;
  action: string;
  sensitivity: ActionSensitivity;
  reversibility: ActionReversibility;
  isAuthorized: boolean;
  netSafetyGain: number;
}

export interface WindowEvaluationResult {
  window: InterventionWindow;
  urgency: InterventionUrgency;
  recommendedAction: InterventionRecommendation;
  explanation: string;
  reasons: string[];
}

/**
 * Core Sentinel Innovation: Optimal Intervention Window Identifier
 * Computes whether the current trajectory position is TOO_EARLY, OPTIMAL_WINDOW, or TOO_LATE.
 */
export function determineInterventionWindow(params: WindowEvaluationParams): WindowEvaluationResult {
  const {
    currentRisk,
    trajectoryDeviation,
    riskVelocity,
    riskAcceleration,
    predictedRisk,
    action,
    sensitivity,
    reversibility,
    isAuthorized,
    netSafetyGain
  } = params;

  const isIrreversible = reversibility === 'IRREVERSIBLE';
  const isDestructive = action === 'DELETE' || action === 'PRIVILEGE_ESCALATION';
  const isCriticalRisk = currentRisk >= 86 || predictedRisk >= 90;

  // 1. TOO_LATE: Critical risk already reached, or unauthorized irreversible/destructive action occurring
  if (
    (isCriticalRisk && isIrreversible) ||
    (isDestructive && !isAuthorized && currentRisk >= 75) ||
    (currentRisk >= 86 && (isDestructive || !isAuthorized))
  ) {
    const reasons = [
      'Critical risk threshold breached or unmitigated destructive execution underway',
      isIrreversible ? 'Action is irreversible with non-recoverable state modification' : 'Acute unauthorized sequence',
      'Further delay offers zero safety margin; mandatory enforcement required'
    ];

    return {
      window: 'TOO_LATE',
      urgency: 'CRITICAL',
      recommendedAction: 'BLOCK',
      explanation: 'Waiting longer would expose the system to unacceptable additional risk.',
      reasons
    };
  }

  // 2. OPTIMAL_WINDOW: Trajectory moving away from expected baseline, risk accelerating, but action remains reversible
  // This is the sweet spot where human review or active warning prevents crossing into catastrophic harm.
  const hasTrajectoryDrift = trajectoryDeviation >= 45 || currentRisk >= 48;
  const isAccelerating = riskAcceleration === 'RISING' || riskAcceleration === 'SURGING' || riskVelocity === 'HIGH' || riskVelocity === 'EXTREME';
  const approachingCritical = predictedRisk >= 65 || (currentRisk >= 60 && isAccelerating);
  const sensitiveOrUnauthorized = !isAuthorized || sensitivity === 'HIGH' || sensitivity === 'CRITICAL';

  if (
    (hasTrajectoryDrift && approachingCritical && !isIrreversible) ||
    (!isAuthorized && !isIrreversible && currentRisk >= 40) ||
    (currentRisk >= 50 && currentRisk <= 85 && netSafetyGain > 0)
  ) {
    const reasons: string[] = [];
    if (!isAuthorized) reasons.push('Action attempts access outside granted scope envelope');
    if (trajectoryDeviation >= 50) reasons.push(`Trajectory deviation (${trajectoryDeviation}/100) indicates significant drift from task baseline`);
    if (isAccelerating) reasons.push(`Risk acceleration is ${riskAcceleration} with ${riskVelocity} velocity`);
    if (approachingCritical) reasons.push(`Forecast indicates critical threshold likely within subsequent actions (projected: ${predictedRisk}/100)`);
    reasons.push('Current action remains reversible, providing safe opportunity for human confirmation or policy pause');

    // If unauthorized or high sensitivity, recommend CONFIRM; otherwise WARN
    const recommendedAction: InterventionRecommendation = (!isAuthorized || sensitivity === 'HIGH' || sensitivity === 'CRITICAL' || currentRisk >= 65)
      ? 'CONFIRM'
      : 'WARN';

    const urgency: InterventionUrgency = currentRisk >= 70 ? 'HIGH' : 'MEDIUM';

    return {
      window: 'OPTIMAL_WINDOW',
      urgency,
      recommendedAction,
      explanation: 'Risk is accelerating and the trajectory has moved substantially outside its baseline, but the current action remains reversible.',
      reasons
    };
  }

  // 3. TOO_EARLY: Baseline behavior, stable risk, minimal trajectory divergence
  const reasons = [
    'Trajectory remains consistent with expected task baseline',
    'Risk levels remain within normal or watch bounds',
    'Intervention now would interrupt a legitimate agent workflow without safety benefit'
  ];

  const recommendedAction: InterventionRecommendation = currentRisk >= 30 ? 'MONITOR' : 'ALLOW';

  return {
    window: 'TOO_EARLY',
    urgency: 'LOW',
    recommendedAction,
    explanation: 'Intervention now would interrupt a trajectory that is still within expected behavior.',
    reasons
  };
}
