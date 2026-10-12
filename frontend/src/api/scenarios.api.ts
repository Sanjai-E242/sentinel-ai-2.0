import { apiClient } from './client';

export interface ScenarioListItem {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  expectedFinalState: string;
  demonstrates: string;
}

export interface ScenarioStepResult {
  stepLabel: string;
  action: string;
  resource: string;
  authorization: string;
  decision: string;
  risk: number;
  trajectoryDeviation: number;
  state: string;
  window?: string;
  urgency?: string;
  recommendation?: string;
}

export interface ScenarioRunResult {
  scenarioId: string;
  scenarioName: string;
  agentId: string;
  sessionId: string;
  session: Record<string, unknown>;
  results: ScenarioStepResult[];
  decisions: { stepLabel: string; action: string }[];
  finalTelemetry: {
    currentRisk: number;
    trajectoryDeviation: number;
    riskVelocity: string;
    riskAcceleration: string;
    state: string;
    actionCount: number;
    interventionWindow?: string;
    interventionUrgency?: string;
    recommendedAction?: string;
  };
  intervention?: {
    interventionWindow?: string;
    urgency?: string;
    recommendedAction?: string;
    explanation?: string;
    currentRisk?: number;
    predictedRisk?: number;
    trajectoryDeviation?: number;
    reasons?: string[];
    forecast?: {
      nextActionRisk?: number;
      actionPlus2Risk?: number;
      actionPlus3Risk?: number;
      horizonLabel?: string;
      confidence?: number;
    };
    counterfactual?: {
      early?: { riskAtDecision?: number; disruptionCost?: number; label?: string };
      recommended?: { riskAtDecision?: number; disruptionCost?: number; label?: string };
      late?: { riskAtDecision?: number; disruptionCost?: number; label?: string };
      optimalRationale?: string;
    };
  };
}

export const scenariosApi = {
  async list(): Promise<ScenarioListItem[]> {
    const res = await apiClient.get<{ scenarios: ScenarioListItem[] }>('/v1/scenarios');
    return res.scenarios || [];
  },

  async run(scenarioId: string): Promise<ScenarioRunResult> {
    return apiClient.post<ScenarioRunResult>(`/v1/scenarios/${scenarioId}/run`, {});
  }
};
