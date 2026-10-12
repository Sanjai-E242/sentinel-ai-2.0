import { apiClient } from './client';
import { Agent, CreateAgentInput } from '@sentinel/shared';

interface AgentResponse {
  agent: Agent;
}

interface AgentsListResponse {
  agents: Agent[];
}

export const agentsApi = {
  async list(): Promise<Agent[]> {
    const res = await apiClient.get<AgentsListResponse>('/v1/agents');
    return res.agents || (res as any).data?.agents || [];
  },

  async getById(id: string): Promise<Agent> {
    const res = await apiClient.get<AgentResponse>(`/v1/agents/${id}`);
    return res.agent || (res as any).data?.agent;
  },

  async create(input: CreateAgentInput): Promise<Agent> {
    const res = await apiClient.post<AgentResponse>('/v1/agents', input);
    return res.agent || (res as any).data?.agent;
  }
};
