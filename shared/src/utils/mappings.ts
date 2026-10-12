import { DecisionType } from '../types/decision.js';
import { InterventionWindowStage } from '../types/intervention.js';
import { RiskLevel } from '../types/risk.js';
import {
  DECISION_VOCABULARY,
  INTERVENTION_STAGE_VOCABULARY,
  RISK_LEVEL_META,
  SimpleModeStatus
} from '../constants/vocabulary.js';

/**
 * Maps a technical DecisionType to its human-friendly Simple Mode label
 */
export function mapDecisionToSimpleStatus(decision: DecisionType): SimpleModeStatus {
  switch (decision) {
    case 'ALLOW':
      return 'SAFE';
    case 'MONITOR':
      return 'WATCHING';
    case 'WARNING':
    case 'WARN':
      return 'ATTENTION';
    case 'CONFIRM':
      return 'APPROVAL_NEEDED';
    case 'BLOCK':
      return 'STOPPED';
    default:
      return 'WATCHING';
  }
}

/**
 * Formats a plain-language explanation for non-technical users in Simple Mode
 */
export function getSimpleModeExplanation(key: string, value?: unknown): string {
  switch (key) {
    case 'trajectory_deviation':
      return 'This agent is behaving differently from its usual activity.';
    case 'risk_acceleration':
      return 'The agent\'s risk is increasing quickly.';
    case 'scope_expansion':
      return 'The agent is trying to access something outside its normal job.';
    case 'CONFIRM':
      return 'The agent wants your permission before continuing.';
    case 'BLOCK':
      return 'Sentinel stopped this action because it could be unsafe.';
    case 'ALLOW':
      return 'Action checked and permitted safely.';
    case 'MONITOR':
      return 'Sentinel is keeping a close watch on this agent.';
    default:
      return typeof value === 'string' ? value : 'Agent status is being actively monitored.';
  }
}

/**
 * Translates risk score (0-100) to RiskLevel category
 */
export function calculateRiskLevel(score: number): RiskLevel {
  if (score < 15) return 'NONE';
  if (score < 40) return 'LOW';
  if (score < 70) return 'MEDIUM';
  if (score < 90) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Returns complete presentation metadata for a decision
 */
export function getDecisionMeta(decision: DecisionType) {
  return DECISION_VOCABULARY[decision] || DECISION_VOCABULARY.MONITOR;
}

/**
 * Returns intervention stage metadata
 */
export function getInterventionStageMeta(stage: InterventionWindowStage) {
  return INTERVENTION_STAGE_VOCABULARY[stage] || INTERVENTION_STAGE_VOCABULARY.MONITOR;
}

/**
 * Returns risk level metadata
 */
export function getRiskLevelMeta(level: RiskLevel) {
  return RISK_LEVEL_META[level] || RISK_LEVEL_META.NONE;
}

/**
 * Explains trajectory deviation in either Simple Mode or Expert Mode
 */
export function formatTrajectoryDeviation(deviation: number, isSimple: boolean): string {
  if (isSimple) {
    if (deviation === 0) return 'Behavior is currently normal.';
    if (deviation < 30) return 'Mild behavior deviation observed.';
    return 'This agent is behaving differently from its usual activity.';
  }
  return `Trajectory deviation: ${deviation}/100`;
}

/**
 * Formats a decision explanation according to Simple vs Expert mode
 */
export function formatDecisionExplanation(
  action: DecisionType,
  reasons: string[] = [],
  isSimple = true
): string {
  if (isSimple) {
    switch (action) {
      case 'ALLOW':
        return "Sentinel allowed this action because it matches the agent's permissions.";
      case 'MONITOR':
        return 'Sentinel is keeping a close watch on this agent.';
      case 'WARN':
      case 'WARNING':
        return 'The agent is behaving differently or accessing sensitive resources.';
      case 'CONFIRM':
        return 'The agent wants your permission before continuing.';
      case 'BLOCK':
        return 'Sentinel stopped this action because it could be unsafe.';
      default:
        return 'Sentinel evaluated this action.';
    }
  }

  const reasonText = reasons.length > 0 ? reasons.join(', ') : 'Policy evaluated';
  return `${action} — ${reasonText}`;
}
