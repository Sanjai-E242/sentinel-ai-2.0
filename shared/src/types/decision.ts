/**
 * Decision Engine outputs
 */
export type PolicyDecisionAction =
  | 'ALLOW'
  | 'MONITOR'
  | 'WARN'
  | 'CONFIRM'
  | 'BLOCK';

// Backwards-compatibility alias
export type DecisionType = PolicyDecisionAction | 'WARNING';

export interface DecisionReason {
  code: string;
  message: string;
  sourceEngine: 'authorization' | 'trajectory' | 'risk' | 'intervention' | 'policy';
}

export interface PolicyDecision {
  action: PolicyDecisionAction;
  reason: string[];
}

export interface Decision {
  id?: string;
  actionId?: string;
  eventId?: string;
  decision: DecisionType;
  reasons?: DecisionReason[];
  reason?: string[];
  action?: PolicyDecisionAction;
  requiresHumanReview?: boolean;
  timestamp?: string;
  auditSignature?: string;
}

export interface IngestActionResult {
  event: import('./action.js').ActionEvent;
  decision: PolicyDecision;
}
