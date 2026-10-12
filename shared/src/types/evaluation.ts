/**
 * Prototype evaluation metrics domain types for Sentinel 2.0
 */

export interface ScenarioRunRecord {
  runId: string;
  scenarioId: string;
  scenarioName: string;
  actionCount: number;
  finalRisk: number;
  finalState: string;
  interventionWindow?: string;
  timestamp: string;
}

export interface EvaluationMetrics {
  totalScenarioRuns: number;
  normalActionsAllowed: number;
  suspiciousTrajectoriesDetected: number;
  dangerousActionsBlocked: number;
  interventionsTriggered: number;
  humanOverrides: number;
  falseInterventions: number;
  averageInterventionLeadTime: number; // Average action steps between optimal intervention point and destructive threshold
  scenarioRunHistory: ScenarioRunRecord[];
  isPrototypeSimulation: true;
}
