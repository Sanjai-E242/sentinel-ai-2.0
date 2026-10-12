import { apiClient } from './client';
import { ActionEvent, IngestActionInput, IngestActionResult } from '@sentinel/shared';

interface ActionsListResponse {
  events: ActionEvent[];
}

interface ActionResponse {
  event: ActionEvent;
}

export const actionsApi = {
  async list(sessionId?: string, agentId?: string): Promise<ActionEvent[]> {
    const params = new URLSearchParams();
    if (sessionId) params.append('sessionId', sessionId);
    if (agentId) params.append('agentId', agentId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<ActionsListResponse>(`/v1/actions${qs}`);
    return res.events || (res as any).data?.events || [];
  },

  async getById(id: string): Promise<ActionEvent> {
    const res = await apiClient.get<ActionResponse>(`/v1/actions/${id}`);
    return res.event || (res as any).data?.event;
  },

  async ingest(input: IngestActionInput): Promise<IngestActionResult> {
    const res = await apiClient.post<IngestActionResult>('/v1/actions', input);
    return {
      event: res.event || (res as any).data?.event,
      decision: res.decision || (res as any).data?.decision
    };
  }
};
