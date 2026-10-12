/**
 * Sentinel 2.0 — Phase 7: Sentinel REST API HTTP Client
 *
 * Communicates ONLY via the public Sentinel 2.0 REST API over HTTP.
 * No internal backend modules or direct database connections are used.
 */

import { SentinelActionEventPayload, HumanReviewDecision } from './types.js';

export interface SentinelClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface RegisterAgentResponse {
  id: string;
  name: string;
  type: string;
  scopes: string[];
  status: string;
}

export interface CreateSessionResponse {
  id: string;
  agentId: string;
  status: string;
  startedAt: string;
}

export interface IngestActionResponse {
  event: {
    eventId: string;
    agentId: string;
    sessionId: string;
    action: string;
    resource: string;
    scope: string;
    authorization: string;
    metadata?: {
      risk?: number;
      trajectoryDeviation?: number;
      interventionWindow?: string;
      interventionUrgency?: string;
      predictedRisk?: number;
      pendingInterventionId?: string;
      [key: string]: unknown;
    };
  };
  decision: {
    action: 'ALLOW' | 'MONITOR' | 'WARN' | 'CONFIRM' | 'BLOCK';
    reason: string[];
  };
}

export interface PendingInterventionItem {
  id: string;
  sessionId: string;
  agentId: string;
  actionId: string;
  status: string;
  urgency: string;
  interventionWindow: string;
  recommendation: string;
}

export class SentinelClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: SentinelClientOptions = {}) {
    const rawUrl = options.baseUrl || process.env.SENTINEL_URL || 'http://localhost:4000/api/v1';
    // Ensure baseUrl doesn't end with slash
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs || 10000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const body = await response.json();
      if (!response.ok) {
        const errorMsg = body.error?.message || body.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      return body as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Checks health of Sentinel API Gateway
   */
  async checkHealth(): Promise<boolean> {
    try {
      const rootUrl = this.baseUrl.replace(/\/v1$/, '');
      const res = await fetch(`${rootUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Registers a new External AI Agent in Sentinel
   */
  async registerAgent(payload: { name: string; type: string; scopes: string[] }): Promise<RegisterAgentResponse> {
    const res = await this.request<{ agent?: RegisterAgentResponse; data?: { agent: RegisterAgentResponse } }>('/agents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const agent = res.agent || res.data?.agent;
    if (!agent) throw new Error('Agent registration returned empty payload');
    return agent;
  }

  /**
   * Starts a new runtime session for an agent
   */
  async createSession(agentId: string): Promise<CreateSessionResponse> {
    const res = await this.request<{ session?: CreateSessionResponse; data?: { session: CreateSessionResponse } }>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ agentId })
    });
    const session = res.session || res.data?.session;
    if (!session) throw new Error('Session creation returned empty payload');
    return session;
  }

  /**
   * Ingests a governed action into Sentinel runtime
   */
  async ingestAction(actionPayload: SentinelActionEventPayload): Promise<IngestActionResponse> {
    const res = await this.request<{
      event?: IngestActionResponse['event'];
      decision?: IngestActionResponse['decision'];
      data?: {
        event: IngestActionResponse['event'];
        decision: IngestActionResponse['decision'];
      };
    }>('/actions', {
      method: 'POST',
      body: JSON.stringify(actionPayload)
    });

    const event = res.event || res.data?.event;
    const decision = res.decision || res.data?.decision;

    if (!event || !decision) {
      throw new Error('Action ingestion response missing event or decision');
    }

    return { event, decision };
  }

  /**
   * Queries pending human review interventions
   */
  async getPendingInterventions(): Promise<PendingInterventionItem[]> {
    const res = await this.request<{ data?: PendingInterventionItem[]; interventions?: PendingInterventionItem[] }>(
      '/interventions?status=PENDING'
    );
    return res.data || res.interventions || [];
  }

  /**
   * Submits human review decision for a pending intervention
   */
  async submitInterventionDecision(
    interventionId: string,
    decision: HumanReviewDecision,
    reviewerId = 'human-security-operator',
    reason = 'Human operator approved one-time runtime exception'
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/interventions/${interventionId}/decision`, {
      method: 'POST',
      body: JSON.stringify({
        decision,
        reviewerId,
        reason
      })
    });
  }

  /**
   * Ends an active session
   */
  async endSession(sessionId: string): Promise<void> {
    await this.request(`/sessions/${sessionId}/end`, {
      method: 'POST'
    });
  }
}
