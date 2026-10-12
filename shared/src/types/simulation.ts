import { ActionEvent } from './action.js';
import { TrajectoryState } from './trajectory.js';

export type OutcomeCategory = 'EARLY_INTERVENTION' | 'OPTIMAL_INTERVENTION' | 'LATE_INTERVENTION';

export type SimulationScenarioType = 'early' | 'optimal' | 'late' | 'all';

export interface SimulatedInterventionResult {
  scenarioName: string;
  outcomeCategory: OutcomeCategory;
  scenarioType: 'early' | 'optimal' | 'late';
  interventionAction: ActionEvent;
  interventionIndex: number; // 1-indexed step number
  riskAtIntervention: number;
  trajectoryDeviationAtIntervention: number;
  actionsExecutedBeforeIntervention: ActionEvent[];
  actionsPreventedAfterIntervention: ActionEvent[];
  finalSimulatedState: TrajectoryState;
  explanation: string;
  workflowImpact: {
    frictionLevel: 'HIGH' | 'LOW' | 'MEDIUM';
    riskContained: boolean;
    unnecessaryInterruption: boolean;
    missedEarlyWarning: boolean;
    nextActionPreventedDescription?: string;
  };
}

export interface SessionSimulationTimelineItem {
  stepNumber: number;
  action: string;
  resource: string;
  resourceType: string;
  scope: string;
  risk: number;
  trajectoryDeviation: number;
  state: TrajectoryState;
  decision: string;
  interventionWindow?: string;
}

export interface SessionSimulationComparison {
  sessionId: string;
  agentId: string;
  agentName?: string;
  taskPrompt?: string;
  trajectoryTotalSteps: number;
  trajectoryTimeline: SessionSimulationTimelineItem[];
  optimalInterventionIndex: number;
  earlyInterventionIndex: number;
  lateInterventionIndex: number;
  simulations: {
    early: SimulatedInterventionResult;
    optimal: SimulatedInterventionResult;
    late: SimulatedInterventionResult;
  };
  comparisonSummary: {
    optimalStep: number;
    earlyStep: number;
    lateStep: number;
    optimalRationale: string;
    frictionComparison: string;
    safetyComparison: string;
    recommendedWindow: 'OPTIMAL_WINDOW';
  };
}
