import { apiClient } from './client';
import {
  SessionTrajectoryResponse,
  SessionRiskTelemetryResponse
} from '@sentinel/shared';

export interface ScenarioListItem {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  expectedFinalState: string;
  demonstrates: string;
}

export const trajectoryApi = {
  /**
   * Fetches full trajectory analytics, features, components, and replay data
   */
  async getTrajectory(sessionId: string): Promise<SessionTrajectoryResponse> {
    return apiClient.get<SessionTrajectoryResponse>(`/v1/sessions/${sessionId}/trajectory`);
  },

  /**
   * Fetches compact risk telemetry for quick polling
   */
  async getRiskTelemetry(sessionId: string): Promise<SessionRiskTelemetryResponse> {
    return apiClient.get<SessionRiskTelemetryResponse>(`/v1/sessions/${sessionId}/risk`);
  },

  /**
   * Lists available deterministic test scenarios
   */
  async listScenarios(): Promise<ScenarioListItem[]> {
    const res = await apiClient.get<{ scenarios: ScenarioListItem[] }>('/v1/scenarios');
    return res.scenarios || [];
  },

  /**
   * Runs a scenario and returns complete step-by-step results
   */
  async runScenario(scenarioId: string): Promise<any> {
    return apiClient.post(`/v1/scenarios/${scenarioId}/run`, {});
  }
};
