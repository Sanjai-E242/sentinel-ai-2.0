import { apiClient } from './client.js';
import {
  SessionSimulationComparison,
  SimulatedInterventionResult
} from '@sentinel/shared';

export interface SingleSimulationResponse {
  simulation: SimulatedInterventionResult;
  comparison: SessionSimulationComparison;
}

export const simulationsApi = {
  /**
   * Retrieves full 3-path counterfactual simulation comparison for a session
   */
  async getComparison(sessionId: string): Promise<SessionSimulationComparison> {
    const res = await apiClient.get<SessionSimulationComparison | { data: SessionSimulationComparison }>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/simulate-intervention`
    );
    return (res as any).data || res;
  },

  /**
   * Simulates a specific intervention scenario ('early' | 'optimal' | 'late')
   */
  async simulateScenario(
    sessionId: string,
    scenario: 'early' | 'optimal' | 'late'
  ): Promise<SingleSimulationResponse> {
    const res = await apiClient.post<SingleSimulationResponse>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/simulate-intervention`,
      { scenario }
    );
    return res;
  }
};
