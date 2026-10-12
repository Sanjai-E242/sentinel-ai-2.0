/**
 * Action event definitions emitted by external AI agents
 */
export type ActionType =
  | 'READ'
  | 'WRITE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXECUTE'
  | 'EXPORT'
  | 'DOWNLOAD'
  | 'PRIVILEGE_ESCALATION'
  | 'EXTERNAL_REQUEST';

// Backwards compatibility alias
export type ActionClassification = ActionType;

export type ActionSensitivity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ActionReversibility =
  | 'REVERSIBLE'
  | 'PARTIALLY_REVERSIBLE'
  | 'IRREVERSIBLE';

export type ActionAuthorization = 'AUTHORIZED' | 'UNAUTHORIZED' | 'UNKNOWN';

export interface ActionEvent {
  eventId: string;
  agentId: string;
  sessionId: string;
  timestamp: string;
  action: ActionType;
  resource: string;
  resourceType: string;
  scope: string;
  sensitivity: ActionSensitivity;
  reversibility: ActionReversibility;
  authorization: ActionAuthorization;
  metadata?: Record<string, unknown>;
}

export interface IngestActionInput {
  agentId: string;
  sessionId: string;
  action: ActionType;
  resource: string;
  resourceType: string;
  scope: string;
  sensitivity: ActionSensitivity;
  reversibility: ActionReversibility;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}
