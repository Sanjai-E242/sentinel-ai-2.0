import {
  ActionReversibility,
  InterventionCost,
  InterventionCostLevel
} from '@sentinel/shared';

export interface CostEvaluationParams {
  action: string;
  reversibility: ActionReversibility;
  sensitivity: string;
  currentRisk: number;
  predictedRisk: number;
  trajectoryDeviation: number;
  isAuthorized: boolean;
}

/**
 * Intervention Cost vs. Delay Risk Trade-off Model
 * Evaluates whether intervening now is justified by comparing workflow disruption against the risk of waiting.
 */
export function evaluateInterventionCost(params: CostEvaluationParams): InterventionCost {
  const {
    reversibility,
    sensitivity,
    currentRisk,
    predictedRisk,
    trajectoryDeviation,
    isAuthorized
  } = params;

  // 1. Calculate Immediate Cost Score (0 - 100)
  // Reversible read/inspection actions have low interruption cost.
  // Stopping long-running writes or requiring human review carries moderate-to-high workflow friction.
  let immediateCostScore = 20;

  if (reversibility === 'IRREVERSIBLE') {
    immediateCostScore = 75; // Blocking an irreversible action disrupts the agent fundamentally, but is usually justified
  } else if (reversibility === 'PARTIALLY_REVERSIBLE') {
    immediateCostScore = 45;
  } else {
    immediateCostScore = 15; // Reversible action
  }

  // If sensitivity is low and authorized, cost of stopping is relatively high (unnecessary disruption)
  if (sensitivity === 'LOW' && isAuthorized && currentRisk < 40) {
    immediateCostScore += 20; // High disruption cost because agent is doing benign work
  }

  // 2. Calculate Delay Risk Score (0 - 100)
  // Risk of waiting further: combines predicted next-step risk, deviation, and irreversibility
  let delayRiskScore = Math.round(predictedRisk * 0.6 + trajectoryDeviation * 0.3);

  if (reversibility === 'IRREVERSIBLE') {
    delayRiskScore = Math.min(100, delayRiskScore + 30);
  }
  if (!isAuthorized) {
    delayRiskScore = Math.min(100, delayRiskScore + 15);
  }
  if (sensitivity === 'CRITICAL') {
    delayRiskScore = Math.min(100, delayRiskScore + 20);
  }

  delayRiskScore = Math.min(100, Math.max(0, delayRiskScore));
  immediateCostScore = Math.min(100, Math.max(0, immediateCostScore));

  const netSafetyGain = delayRiskScore - immediateCostScore;

  // Categorize level
  let level: InterventionCostLevel = 'MEDIUM';
  let workflowDisruption: 'MINIMAL' | 'MODERATE' | 'HIGH' = 'MODERATE';

  if (immediateCostScore <= 30) {
    level = 'LOW';
    workflowDisruption = 'MINIMAL';
  } else if (immediateCostScore >= 65) {
    level = 'HIGH';
    workflowDisruption = 'HIGH';
  }

  let reversibilityImpact = 'Action is completely reversible with zero downstream state mutation.';
  if (reversibility === 'IRREVERSIBLE') {
    reversibilityImpact = 'Action is irreversible; state cannot be restored once executed.';
  } else if (reversibility === 'PARTIALLY_REVERSIBLE') {
    reversibilityImpact = 'Action is partially reversible; compensating rollback transactions required.';
  }

  return {
    level,
    workflowDisruption,
    reversibilityImpact,
    delayRiskScore,
    immediateCostScore,
    netSafetyGain
  };
}
