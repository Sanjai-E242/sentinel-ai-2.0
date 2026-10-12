import { apiClient } from './client';
import { Session, CreateSessionInput } from '@sentinel/shared';

interface SessionResponse {
  session: Session;
}

interface SessionsListResponse {
  sessions: Session[];
}

export const sessionsApi = {
  async list(agentId?: string): Promise<Session[]> {
    const endpoint = agentId ? `/v1/sessions?agentId=${encodeURIComponent(agentId)}` : '/v1/sessions';
    const res = await apiClient.get<SessionsListResponse>(endpoint);
    return res.sessions || (res as any).data?.sessions || [];
  },

  async getById(id: string): Promise<Session> {
    const res = await apiClient.get<SessionResponse>(`/v1/sessions/${id}`);
    return res.session || (res as any).data?.session;
  },

  async create(input: CreateSessionInput): Promise<Session> {
    const res = await apiClient.post<SessionResponse>('/v1/sessions', input);
    return res.session || (res as any).data?.session;
  },

  async end(id: string): Promise<Session> {
    const res = await apiClient.post<SessionResponse>(`/v1/sessions/${id}/end`);
    return res.session || (res as any).data?.session;
  }
};
