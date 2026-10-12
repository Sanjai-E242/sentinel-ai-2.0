import { RiskVelocity, RiskAcceleration, RiskForecast } from '@sentinel/shared';

export interface ForecastParams {
  currentRisk: number;
  riskDelta: number;
  riskVelocity: RiskVelocity;
  riskAcceleration: RiskAcceleration;
  trajectoryDeviation: number;
}

export interface ForecastConfig {
  accelerationMultiplier: Record<RiskAcceleration, number>;
  velocityMultiplier: Record<RiskVelocity, number>;
  deviationWeight: number;
  confidenceBase: number;
}

export const DEFAULT_FORECAST_CONFIG: ForecastConfig = {
  accelerationMultiplier: {
    SURGING: 1.6,
    RISING: 1.25,
    STABLE: 0.85,
    FALLING: 0.4
  },
  velocityMultiplier: {
    EXTREME: 1.5,
    HIGH: 1.2,
    MEDIUM: 0.9,
    LOW: 0.5
  },
  deviationWeight: 0.15,
  confidenceBase: 85
};

/**
 * Deterministic Trajectory-Based Risk Forecast Engine
 * Transparent multi-step forward horizon projection without opaque ML dependencies.
 */
export function calculateRiskForecast(
  params: ForecastParams,
  config: ForecastConfig = DEFAULT_FORECAST_CONFIG
): RiskForecast {
  const { currentRisk, riskDelta, riskVelocity, riskAcceleration, trajectoryDeviation } = params;

  const accelFactor = config.accelerationMultiplier[riskAcceleration] ?? 1.0;
  const velFactor = config.velocityMultiplier[riskVelocity] ?? 1.0;
  const devContribution = (trajectoryDeviation - 30) * config.deviationWeight;

  // Base forward gradient per step
  let stepGradient = 0;

  if (riskAcceleration === 'FALLING') {
    // If risk is settling down, apply deceleration
    stepGradient = Math.min(-2, riskDelta * accelFactor);
  } else if (riskAcceleration === 'STABLE') {
    // Stable trajectory with minor delta damping
    stepGradient = Math.round(riskDelta * 0.7 * velFactor + Math.max(0, devContribution * 0.5));
  } else {
    // Rising or surging acceleration
    const momentum = Math.max(4, Math.abs(riskDelta));
    stepGradient = Math.round(momentum * accelFactor * velFactor + Math.max(0, devContribution));
  }

  // Calculate projected steps with progressive horizons
  const nextActionRisk = Math.min(100, Math.max(0, Math.round(currentRisk + stepGradient)));
  const actionPlus2Risk = Math.min(100, Math.max(0, Math.round(nextActionRisk + stepGradient * 0.9)));
  const actionPlus3Risk = Math.min(100, Math.max(0, Math.round(actionPlus2Risk + stepGradient * 0.8)));

  // Determine horizon alert label
  let horizonLabel = 'TRAJECTORY_STABLE_WITHIN_NORMAL_BOUNDS';
  if (actionPlus2Risk >= 85 || nextActionRisk >= 85) {
    horizonLabel = 'CRITICAL_THRESHOLD_LIKELY_WITHIN_2_ACTIONS';
  } else if (actionPlus3Risk >= 85) {
    horizonLabel = 'CRITICAL_THRESHOLD_LIKELY_WITHIN_3_ACTIONS';
  } else if (actionPlus3Risk >= 70) {
    horizonLabel = 'ESCALATING_DRIFT_CONTINUING';
  } else if (actionPlus3Risk >= 40) {
    horizonLabel = 'MODERATE_WATCH_CONTINUING';
  }

  // Confidence is high for deterministic models when state is stable, reduced slightly during surging shifts
  const confidence = Math.max(50, Math.min(95, Math.round(
    config.confidenceBase - (riskAcceleration === 'SURGING' ? 15 : 0) + (riskVelocity === 'LOW' ? 5 : 0)
  )));

  return {
    nextActionRisk,
    actionPlus2Risk,
    actionPlus3Risk,
    horizonLabel,
    trajectorySlope: Number(stepGradient.toFixed(2)),
    confidence
  };
}
