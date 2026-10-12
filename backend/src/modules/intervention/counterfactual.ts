import {
  CounterfactualAnalysis,
  CounterfactualPath,
  InterventionWindow
} from '@sentinel/shared';

export interface CounterfactualParams {
  currentRisk: number;
  predictedRisk: number;
  trajectoryDeviation: number;
  interventionWindow: InterventionWindow;
  action: string;
  isReversible: boolean;
}

/**
 * Counterfactual Analysis Engine
 * Generates transparent three-path simulations (EARLY vs. RECOMMENDED vs. LATE)
 * to demonstrate why intervening at the OPTIMAL_WINDOW outperforms premature blocking or delayed reaction.
 */
export function generateCounterfactualAnalysis(params: CounterfactualParams): CounterfactualAnalysis {
  const { currentRisk, predictedRisk, trajectoryDeviation, interventionWindow, isReversible } = params;

  // Path 1: EARLY INTERVENTION (Intervening at Step 1 or baseline)
  const early: CounterfactualPath = {
    path: 'EARLY',
    estimatedRiskPrevented: 'MODERATE',
    interventionCost: 'HIGH',
    workflowDisruption: 'HIGH',
    potentialImpact: 'LOW',
    explanation: 'Premature intervention halts benign exploration, generating user friction and high false-positive overhead.'
  };

  // Path 2: RECOMMENDED INTERVENTION (Optimal Window)
  const recommended: CounterfactualPath = {
    path: 'RECOMMENDED',
    estimatedRiskPrevented: currentRisk >= 60 ? 'HIGH' : 'MODERATE',
    interventionCost: isReversible ? 'LOW' : 'MEDIUM',
    workflowDisruption: isReversible ? 'LOW' : 'MEDIUM',
    potentialImpact: 'LOW',
    explanation: 'Intervening at the optimal inflection window prevents high-velocity escalation while allowing legitimate precursor actions to complete.'
  };

  // Path 3: LATE INTERVENTION (Waiting until destruction/breach)
  const late: CounterfactualPath = {
    path: 'LATE',
    estimatedRiskPrevented: 'LOW',
    interventionCost: 'HIGH',
    workflowDisruption: 'HIGH',
    potentialImpact: 'SEVERE',
    explanation: 'Delaying intervention until critical irreversible action results in high blast-radius damage and unrecoverable state mutations.'
  };

  // Optimal Rationale based on current window
  let optimalRationale = '';
  if (interventionWindow === 'OPTIMAL_WINDOW') {
    optimalRationale = 'Current state represents the Pareto-optimal intervention point: risk acceleration is intercepted before irreversible mutations occur.';
  } else if (interventionWindow === 'TOO_EARLY') {
    optimalRationale = 'Trajectory remains within acceptable exploratory parameters; intervention now would produce unnecessary workflow friction.';
  } else {
    optimalRationale = 'Trajectory has breached critical safety bounds; immediate containment is required as safety margins have collapsed.';
  }

  return {
    early,
    recommended,
    late,
    optimalRationale
  };
}
