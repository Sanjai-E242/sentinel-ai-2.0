import { apiClient } from './client';
import {
  PendingInterventionRecord,
  HumanDecisionPayload,
  SessionInterventionResponse,
  RiskForecast,
  CounterfactualAnalysis
} from '@sentinel/shared';

interface InterventionsListResponse {
  data?: PendingInterventionRecord[];
  interventions?: PendingInterventionRecord[];
}

export const interventionsApi = {
  /**
   * Lists pending human review interventions
   */
  async listPending(): Promise<PendingInterventionRecord[]> {
    const json = await apiClient.get<InterventionsListResponse>('/v1/interventions?status=PENDING');
    return json.data || json.interventions || [];
  },

  /**
   * Lists all interventions with optional status filter
   */
  async listAll(status?: string): Promise<PendingInterventionRecord[]> {
    const endpoint = status
      ? `/v1/interventions?status=${encodeURIComponent(status)}`
      : '/v1/interventions';
    const json = await apiClient.get<InterventionsListResponse>(endpoint);
    return json.data || json.interventions || [];
  },

  /**
   * Retrieves single intervention details by ID
   */
  async getById(id: string): Promise<PendingInterventionRecord> {
    const json = await apiClient.get<{ data?: PendingInterventionRecord } & PendingInterventionRecord>(
      `/v1/interventions/${encodeURIComponent(id)}`
    );
    return json.data || json;
  },

  /**
   * Submits a human decision (ALLOW_ONCE, DENY, REVOKE_SESSION)
   */
  async submitDecision(
    id: string,
    payload: HumanDecisionPayload
  ): Promise<PendingInterventionRecord> {
    const json = await apiClient.post<{ data?: PendingInterventionRecord } & PendingInterventionRecord>(
      `/v1/interventions/${encodeURIComponent(id)}/decision`,
      payload
    );
    return json.data || json;
  },

  /**
   * Gets intervention analysis for a session
   */
  async getSessionIntervention(sessionId: string): Promise<SessionInterventionResponse> {
    const json = await apiClient.get<{ data?: SessionInterventionResponse } & SessionInterventionResponse>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/intervention`
    );
    return json.data || json;
  },

  /**
   * Gets forward risk forecast for a session
   */
  async getSessionForecast(sessionId: string): Promise<RiskForecast> {
    const json = await apiClient.get<{ data?: RiskForecast } & RiskForecast>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/forecast`
    );
    return json.data || json;
  },

  /**
   * Gets 3-path counterfactual simulation for a session
   */
  async getSessionCounterfactual(sessionId: string): Promise<CounterfactualAnalysis> {
    const json = await apiClient.get<{ data?: CounterfactualAnalysis } & CounterfactualAnalysis>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/counterfactual`
    );
    return json.data || json;
  }
};
