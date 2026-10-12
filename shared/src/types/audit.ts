/**
 * Audit Trail Domain Types for Sentinel 2.0
 * Append-only security audit log definitions
 */

export type AuditEventType =
  | 'AGENT_CREATED'
  | 'AGENT_SUSPENDED'
  | 'AGENT_REVOKED'
  | 'SESSION_STARTED'
  | 'SESSION_COMPLETED'
  | 'ACTION_INGESTED'
  | 'ACTION_ALLOWED'
  | 'ACTION_MONITORED'
  | 'ACTION_WARNED'
  | 'ACTION_CONFIRM_REQUIRED'
  | 'ACTION_BLOCKED'
  | 'INTERVENTION_TRIGGERED'
  | 'HUMAN_REVIEW_RESOLVED'
  | 'TOOL_EXECUTION_COMPLETED'
  | 'TOOL_EXECUTION_MONITORED'
  | 'TOOL_EXECUTION_HELD'
  | 'TOOL_EXECUTION_BLOCKED'
  | 'TOOL_EXECUTED_AFTER_APPROVAL'
  | 'TOOL_EXECUTION_DENIED'
  | 'RATE_LIMIT_TRIGGERED'
  | 'BURST_DETECTED'
  | 'DUPLICATE_DETECTED'
  | 'REQUEST_THROTTLED';

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  entityType: 'agent' | 'session' | 'action' | 'system' | 'intervention' | 'tool';
  entityId: string;
  sessionId?: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreateAuditLogInput {
  eventType: AuditEventType;
  entityType: 'agent' | 'session' | 'action' | 'system' | 'intervention' | 'tool';
  entityId: string;
  sessionId?: string;
  actor?: string;
  payload?: Record<string, unknown>;
}

export interface PersistenceStatus {
  provider: 'supabase' | 'local-storage' | 'memory';
  connected: boolean;
  status: 'connected' | 'degraded' | 'fallback' | 'unavailable';
  details?: string;
}
