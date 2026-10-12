/**
 * Sentinel 2.0 — Phase 7: Gemini Agent Adapter Types
 */

import { ActionType, ActionSensitivity, ActionReversibility, PolicyDecisionAction } from '@sentinel/shared';

export type GeminiToolName =
  | 'READ_PROJECT_DOCS'
  | 'READ_SOURCE_CODE'
  | 'WRITE_REPORT'
  | 'READ_FINANCE_DATA'
  | 'READ_EMPLOYEE_DATA'
  | 'ACCESS_ADMIN_CONFIG'
  | 'DOWNLOAD_SENSITIVE_DATA'
  | 'DELETE_RESOURCE';

export interface GovernedToolDefinition {
  name: GeminiToolName;
  functionName: string;
  description: string;
  action: ActionType;
  resource: string;
  resourceType: string;
  scope: string;
  sensitivity: ActionSensitivity;
  reversibility: ActionReversibility;
  parameters: Record<string, unknown>;
}

export interface SentinelActionEventPayload {
  agent_id: string;
  session_id: string;
  agentId?: string;
  sessionId?: string;
  action: ActionType;
  resource: string;
  resource_type: string;
  resourceType?: string;
  scope: string;
  sensitivity: ActionSensitivity;
  reversibility: ActionReversibility;
  authorization?: string;
  metadata?: Record<string, unknown>;
}

export type HumanReviewDecision = 'ALLOW_ONCE' | 'DENY' | 'REVOKE_SESSION';

export interface StructuredStepLog {
  step: number;
  agentId: string;
  sessionId: string;
  tool: GeminiToolName;
  action: ActionType;
  resource: string;
  scope: string;
  sentinelDecision: PolicyDecisionAction;
  decisionReasons: string[];
  risk: number;
  trajectoryDeviation: number;
  interventionWindow?: string;
  interventionUrgency?: string;
  predictedRisk?: number;
  humanReviewRequired: boolean;
  humanDecision?: HumanReviewDecision;
  executionAllowed: boolean;
  timestamp: string;
}

export interface AdapterConfig {
  sentinelBaseUrl?: string;
  agentName?: string;
  grantedScopes?: string[];
  autoApproveConfirm?: boolean;
  reviewerId?: string;
  reviewReason?: string;
  isDemoMode?: boolean;
}

export interface AgentRunSummary {
  agentId: string;
  agentName: string;
  sessionId: string;
  mode: 'LIVE_GEMINI' | 'DEMO_MODE';
  modelName: string;
  totalSteps: number;
  steps: StructuredStepLog[];
  completedAt: string;
  finalDecision: PolicyDecisionAction;
  executionHalted: boolean;
  haltReason?: string;
}
