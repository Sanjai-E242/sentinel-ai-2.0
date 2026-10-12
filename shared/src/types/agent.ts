/**
 * Agent definition and runtime state
 */
export type AgentStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

// Backwards-compatible alias for Phase 0 code
export type AgentStatusType = AgentStatus;

export interface AgentScope {
  id?: string;
  name: string;
  description?: string;
  resourcePattern?: string;
  actionsAllowed?: string[];
}

export interface Agent {
  id: string;
  name: string;
  type: string; // e.g. 'external-ai-agent'
  status: AgentStatus;
  scopes: string[];
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAgentInput {
  name: string;
  type?: string;
  scopes: string[];
  metadata?: Record<string, unknown>;
}
