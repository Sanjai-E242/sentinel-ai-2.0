import { apiClient } from './client';

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
  averageInterventionLeadTime: number;
  scenarioRunHistory: ScenarioRunRecord[];
  isPrototypeSimulation: true;
}

export const evaluationApi = {
  async getMetrics(): Promise<EvaluationMetrics> {
    const res = await apiClient.get<{ data: EvaluationMetrics }>('/v1/evaluation');
    return res.data;
  }
};
