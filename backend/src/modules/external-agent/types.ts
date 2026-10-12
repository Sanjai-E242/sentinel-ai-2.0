/**
 * Sentinel 2.0 — External AI Agent Provider Gateway Types
 *
 * Provider-agnostic abstraction for autonomous agents governed by Sentinel.
 * The core security engine does NOT know whether the agent is Gemini, OpenAI, Claude, or a Mock.
 */

import {
  ActionType,
  ActionSensitivity,
  ActionReversibility,
  PolicyDecisionAction
} from '@sentinel/shared';

export type GeminiScenarioId =
  | 'GEMINI_CUSTOMER_SUPPORT'
  | 'GEMINI_NORMAL'
  | 'GEMINI_SCOPE_CREEP'
  | 'GEMINI_SENSITIVE_ACCESS'
  | 'GEMINI_PRIVILEGE_ESCALATION'
  | 'GEMINI_DESTRUCTIVE_ATTEMPT'
  | 'GEMINI_FALSE_POSITIVE'
  | 'GEMINI_FINANCIAL_AUDIT'
  | 'CUSTOMER_SUPPORT'
  | 'CUSTOMER_TOOL_CONTROL'
  | 'NORMAL_RESEARCH'
  | 'SCOPE_CREEP'
  | 'PRIVILEGE_ESCALATION'
  | 'DESTRUCTIVE_ATTEMPT'
  | 'FALSE_POSITIVE_CASE'
  | 'FINANCIAL_AUDIT';

export interface ProposedAction {
  action: ActionType;
  resource: string;
  resourceType: string;
  scope: string;
  sensitivity: ActionSensitivity;
  reversibility: ActionReversibility;
  reason: string;
  rawModelOutput?: string;
  tool?: string;
  toolParams?: Record<string, unknown>;
  toolExecutionState?: 'SUCCESS' | 'WAITING_FOR_HUMAN_APPROVAL' | 'BLOCKED_NOT_EXECUTED' | 'DENIED_NOT_EXECUTED';
  toolResult?: unknown;
}

export interface AgentTaskContext {
  agentId: string;
  sessionId: string;
  taskPrompt: string;
  stepIndex: number;
  scenarioId?: GeminiScenarioId;
  actionHistory: Array<{
    step: number;
    action: ProposedAction;
    decision: PolicyDecisionAction;
    decisionReasons: string[];
    risk: number;
    trajectoryDeviation: number;
    humanDecision?: string;
  }>;
}

/**
 * Provider-agnostic interface for any external AI model
 */
export interface ExternalAgentProvider {
  readonly id: string;
  readonly name: string;
  readonly isConfigured: boolean;
  readonly modelName: string;

  initialize(config?: Record<string, unknown>): Promise<void>;
  generateNextAction(context: AgentTaskContext): Promise<ProposedAction>;
}

export interface ProviderStatus {
  providerId: string;
  providerName: string;
  modelName: string;
  isConfigured: boolean;
  statusText: string;
  activeSessionsCount: number;
  supportedScenarios: GeminiScenarioId[];
}

export interface ControlledStepResult {
  stepNumber: number;
  timestamp: string;
  proposedAction: ProposedAction;
  decision: PolicyDecisionAction;
  decisionReasons: string[];
  risk: number;
  previousRisk?: number;
  riskDelta?: number;
  trajectoryDeviation: number;
  riskAcceleration: string;
  predictedNextRisk: number;
  interventionWindow: string;
  interventionUrgency: string;
  humanReviewRequired: boolean;
  humanDecision?: 'ALLOW_ONCE' | 'DENY' | 'REVOKE_SESSION';
  pendingInterventionId?: string;
  simpleNarration: {
    what: string;
    why: string;
    risk: string;
    actionRecommendation: string;
  };
  tool?: string;
  toolExecutionState?: 'SUCCESS' | 'WAITING_FOR_HUMAN_APPROVAL' | 'BLOCKED_NOT_EXECUTED' | 'DENIED_NOT_EXECUTED';
  toolResult?: unknown;
  preventionProof?: string;
  executed: boolean;
  halted: boolean;
  spamSignals?: import('@sentinel/shared').SpamSignals;
}

export interface ControlledSessionRunResult {
  agent: { id: string; name: string; type: string; scopes: string[] };
  session: { id: string; status: string; startedAt: string; endedAt?: string };
  providerName: string;
  modelName: string;
  scenarioId?: GeminiScenarioId;
  totalSteps: number;
  steps: ControlledStepResult[];
  finalDecision: PolicyDecisionAction;
  status: 'COMPLETED' | 'PAUSED' | 'BLOCKED';
  haltReason?: string;
}
