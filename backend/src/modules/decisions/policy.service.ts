import {
  ActionEvent,
  PolicyDecision,
  PolicyDecisionAction,
  InterventionAnalysis
} from '@sentinel/shared';

export interface PolicyEvaluationContext {
  event: ActionEvent;
  agentName?: string;
  interventionAnalysis?: InterventionAnalysis;
}

export class PolicyDecisionService {
  /**
   * Deterministic Phase 1 Policy Engine
   * Evaluates authorization, sensitivity, reversibility, and action type
   * to determine ALLOW, MONITOR, WARN, CONFIRM, or BLOCK.
   */
  public evaluate(context: PolicyEvaluationContext): PolicyDecision {
    const { event } = context;
    const isAuthorized = event.authorization === 'AUTHORIZED';
    const isReversible = event.reversibility === 'REVERSIBLE';
    const isPrivilegeEscalation = event.action === 'PRIVILEGE_ESCALATION';
    const isDelete = event.action === 'DELETE';

    // 1. Unauthorized privilege escalation -> BLOCK
    if (isPrivilegeEscalation && !isAuthorized) {
      return {
        action: 'BLOCK',
        reason: [
          'Privilege escalation attempted without authorized scope',
          'Agent lacked required administrative permission',
          'Potential security breach prevented'
        ]
      };
    }

    // 2. Unauthorized DELETE -> BLOCK
    if (isDelete && !isAuthorized) {
      return {
        action: 'BLOCK',
        reason: [
          'Destructive DELETE action attempted without authorization',
          'Action scope was not granted to this agent',
          'Destructive unauthorized action blocked'
        ]
      };
    }

    // 3. General Unauthorized checks
    if (!isAuthorized) {
      // Unauthorized + irreversible/destructive -> BLOCK
      if (!isReversible || event.sensitivity === 'CRITICAL') {
        return {
          action: 'BLOCK',
          reason: [
            'Action is unauthorized',
            'Action is irreversible or destructive',
            'Sentinel blocked this action because it could be unsafe'
          ]
        };
      }

      // Unauthorized + reversible -> CONFIRM
      return {
        action: 'CONFIRM',
        reason: [
          'Action is unauthorized',
          'Action is reversible',
          'The agent wants your permission before continuing'
        ]
      };
    }

    // 4. Authorized checks
    if (event.sensitivity === 'HIGH' || event.sensitivity === 'CRITICAL') {
      return {
        action: 'WARN',
        reason: [
          'Agent is active',
          'Requested scope is authorized',
          `Resource sensitivity is ${event.sensitivity.toLowerCase()}`,
          'Anomalous or high-sensitivity operation flagged for elevated observation'
        ]
      };
    }

    if (event.sensitivity === 'MEDIUM') {
      return {
        action: 'MONITOR',
        reason: [
          'Agent is active',
          'Requested scope is authorized',
          'Resource sensitivity is medium',
          'Action allowed with enhanced telemetry and behavioral observation'
        ]
      };
    }

    // Authorized + LOW sensitivity + reversible -> ALLOW
    if (isReversible) {
      return {
        action: 'ALLOW',
        reason: [
          'Agent is active',
          'Requested scope is authorized',
          'Resource sensitivity is low',
          'Action is reversible'
        ]
      };
    }

    // Authorized + LOW sensitivity + partially/irreversible -> MONITOR
    return {
      action: 'MONITOR',
      reason: [
        'Agent is active',
        'Requested scope is authorized',
        'Action is non-reversible but meets low sensitivity constraints'
      ]
    };
  }
}

export const policyDecisionService = new PolicyDecisionService();
