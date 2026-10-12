import {
  ActionEvent,
  TrajectoryFeatures,
  TrajectoryDeviationComponents,
  ActionSensitivity
} from '@sentinel/shared';
import { AgentBaselineConfig } from './baseline.js';

export interface DeviationWeights {
  scopeExpansion: number;        // default: 0.20
  resourceNovelty: number;       // default: 0.15
  sequenceDeviation: number;     // default: 0.15
  sensitivityEscalation: number; // default: 0.15
  crossBoundaryAccess: number;   // default: 0.15
  destructiveBehavior: number;   // default: 0.10
  authorizationFailures: number; // default: 0.05
  velocityChange: number;        // default: 0.05
}

export const DEFAULT_DEVIATION_WEIGHTS: DeviationWeights = {
  scopeExpansion: 0.20,
  resourceNovelty: 0.15,
  sequenceDeviation: 0.15,
  sensitivityEscalation: 0.15,
  crossBoundaryAccess: 0.15,
  destructiveBehavior: 0.10,
  authorizationFailures: 0.05,
  velocityChange: 0.05
};

const SENSITIVITY_SCORES: Record<ActionSensitivity, number> = {
  LOW: 10,
  MEDIUM: 35,
  HIGH: 75,
  CRITICAL: 100
};

/**
 * Calculates the 10 transparent explainable trajectory features for a session action sequence.
 */
export function extractTrajectoryFeatures(
  currentAction: ActionEvent,
  actionHistory: ActionEvent[],
  baseline: AgentBaselineConfig
): TrajectoryFeatures {
  const allActions = [...actionHistory, currentAction];
  const totalCount = allActions.length;

  // 1. Resource Novelty (0 - 100)
  // Check if resource or its prefix was seen previously in this session
  const previousResources = new Set(actionHistory.map((a) => a.resource.toLowerCase()));
  const isNovelResource = !previousResources.has(currentAction.resource.toLowerCase());
  const novelResourceCount = allActions.filter(
    (a, idx) => !allActions.slice(0, idx).some((prev) => prev.resource.toLowerCase() === a.resource.toLowerCase())
  ).length;
  const resourceNovelty = isNovelResource
    ? Math.min(100, Math.round((novelResourceCount / totalCount) * 100))
    : Math.min(100, Math.round(((novelResourceCount - 1) / totalCount) * 50));

  // 2. Scope Expansion (0 - 100)
  // Checks if the scope requested is outside the agent's baseline expected scopes
  const isScopeOutsideBaseline = !baseline.expectedScopes.some(
    (exp) => exp.toLowerCase() === currentAction.scope.toLowerCase()
  );
  const outOfBaselineScopes = new Set(
    allActions
      .map((a) => a.scope)
      .filter((s) => !baseline.expectedScopes.some((exp) => exp.toLowerCase() === s.toLowerCase()))
  );
  let scopeExpansion = 0;
  if (isScopeOutsideBaseline) {
    scopeExpansion = Math.min(100, 40 + outOfBaselineScopes.size * 25);
  } else if (outOfBaselineScopes.size > 0) {
    scopeExpansion = Math.min(75, outOfBaselineScopes.size * 20);
  }

  // 3. Sensitivity Escalation (0 - 100)
  // Compares current action sensitivity to baseline expectation
  const currentSensitivityScore = SENSITIVITY_SCORES[currentAction.sensitivity] || 10;
  const maxBaselineScore = SENSITIVITY_SCORES[baseline.maxExpectedSensitivity] || 35;
  const sensitivityDelta = Math.max(0, currentSensitivityScore - maxBaselineScore);
  const sensitivityEscalation = Math.min(
    100,
    Math.round((sensitivityDelta / (100 - maxBaselineScore || 1)) * 100)
  );

  // 4. Action-Type Change (0 - 100)
  const isUnexpectedAction = !baseline.expectedActions.some(
    (act) => act.toUpperCase() === currentAction.action.toUpperCase()
  );
  let actionTypeChange = isUnexpectedAction ? 70 : 0;
  if (currentAction.action === 'PRIVILEGE_ESCALATION') {
    actionTypeChange = 100;
  } else if (currentAction.action === 'DELETE') {
    actionTypeChange = isUnexpectedAction ? 90 : 30;
  }

  // 5. Authorization Failures (0 - 100)
  const unauthorizedCount = allActions.filter((a) => a.authorization === 'UNAUTHORIZED').length;
  const authorizationFailures = Math.min(100, Math.round((unauthorizedCount / totalCount) * 100));

  // 6. Action Velocity (0 - 100)
  let actionVelocity = 10;
  if (allActions.length >= 2) {
    const firstTime = new Date(allActions[0].timestamp).getTime();
    const lastTime = new Date(currentAction.timestamp).getTime();
    const durationMinutes = Math.max(0.1, (lastTime - firstTime) / 60000);
    const ratePerMinute = totalCount / durationMinutes;
    actionVelocity = Math.min(100, Math.round((ratePerMinute / baseline.maxAcceptableVelocityPerMinute) * 50));
  }
  const spamSignals = currentAction.metadata?.spamSignals as import('@sentinel/shared').SpamSignals | undefined;
  if (spamSignals?.burstDetected) {
    actionVelocity = Math.max(actionVelocity, 80);
  }

  // 7. Resource Diversity (0 - 100)
  const uniqueTypes = new Set(allActions.map((a) => a.resourceType.toLowerCase())).size;
  const resourceDiversity = Math.min(100, Math.round((uniqueTypes / Math.max(1, baseline.expectedResourceTypes.length)) * 50));

  // 8. Cross-Boundary Access (0 - 100)
  const currentResourceLower = currentAction.resource.toLowerCase();
  const touchesRestrictedFamily = baseline.restrictedResourceFamilies.some((fam) =>
    currentResourceLower.includes(fam.toLowerCase())
  );
  const touchesRestrictedType = !baseline.expectedResourceTypes.some((t) =>
    currentAction.resourceType.toLowerCase().includes(t.toLowerCase())
  );
  let crossBoundaryAccess = 0;
  if (touchesRestrictedFamily) {
    crossBoundaryAccess = 90;
  } else if (touchesRestrictedType) {
    crossBoundaryAccess = 45;
  }

  // 9. Destructive-Action Presence (0 - 100)
  let destructiveActionPresence = 0;
  if (currentAction.action === 'DELETE') {
    destructiveActionPresence = currentAction.reversibility === 'IRREVERSIBLE' ? 100 : 75;
  } else if (currentAction.reversibility === 'IRREVERSIBLE') {
    destructiveActionPresence = 60;
  } else if (currentAction.reversibility === 'PARTIALLY_REVERSIBLE') {
    destructiveActionPresence = 25;
  }

  // 10. Sequence Deviation (0 - 100)
  // Compares the observed verb transitions with canonical expectations
  let sequenceDeviation = 0;
  if (actionHistory.length === 0) {
    // Starting with a destructive or executive action is unexpected
    if (['DELETE', 'PRIVILEGE_ESCALATION', 'EXPORT'].includes(currentAction.action)) {
      sequenceDeviation = 80;
    }
  } else {
    const prevAction = actionHistory[actionHistory.length - 1];
    if (prevAction.action === 'READ' && currentAction.action === 'DELETE') {
      sequenceDeviation = 70;
    } else if (currentAction.action === 'PRIVILEGE_ESCALATION') {
      sequenceDeviation = 95;
    }
  }

  return {
    resourceNovelty,
    scopeExpansion,
    sensitivityEscalation,
    actionTypeChange,
    authorizationFailures,
    actionVelocity,
    resourceDiversity,
    crossBoundaryAccess,
    destructiveActionPresence,
    sequenceDeviation
  };
}

/**
 * Calculates weighted trajectory deviation score (0 - 100) and explainable component breakdown
 */
export function calculateTrajectoryDeviation(
  features: TrajectoryFeatures,
  weights: DeviationWeights = DEFAULT_DEVIATION_WEIGHTS
): {
  trajectoryDeviation: number;
  components: TrajectoryDeviationComponents;
  plainReasons: string[];
  simpleText: string;
} {
  const components: TrajectoryDeviationComponents = {
    scopeExpansion: Math.round(features.scopeExpansion * weights.scopeExpansion),
    resourceNovelty: Math.round(features.resourceNovelty * weights.resourceNovelty),
    sequenceDeviation: Math.round(features.sequenceDeviation * weights.sequenceDeviation),
    sensitivityEscalation: Math.round(features.sensitivityEscalation * weights.sensitivityEscalation),
    crossBoundaryAccess: Math.round(features.crossBoundaryAccess * weights.crossBoundaryAccess),
    destructiveBehavior: Math.round(features.destructiveActionPresence * weights.destructiveBehavior),
    authorizationFailures: Math.round(features.authorizationFailures * weights.authorizationFailures),
    velocityChange: Math.round(features.actionVelocity * weights.velocityChange)
  };

  const rawSum = Object.values(components).reduce((acc, val) => acc + val, 0);
  const trajectoryDeviation = Math.min(100, Math.max(0, rawSum));

  // Generate plain English explanations for Simple Mode
  const plainReasons: string[] = [];
  if (features.crossBoundaryAccess > 50) {
    plainReasons.push('attempting to access sensitive or restricted system domains');
  }
  if (features.scopeExpansion > 50) {
    plainReasons.push('requesting permissions beyond the initial task baseline');
  }
  if (features.sensitivityEscalation > 40) {
    plainReasons.push('accessing higher sensitivity information than expected');
  }
  if (features.destructiveActionPresence > 50) {
    plainReasons.push('executing irreversible or destructive data modifications');
  }
  if (features.resourceNovelty > 60) {
    plainReasons.push('accessing newly encountered resources outside the workflow');
  }
  if (features.authorizationFailures > 25) {
    plainReasons.push('multiple unauthorized access attempts detected');
  }
  if (features.sequenceDeviation > 50) {
    plainReasons.push('diverging from the normal sequential order of operations');
  }

  let simpleText = 'Agent behavior is consistent with its expected task baseline.';
  if (trajectoryDeviation > 75) {
    simpleText = 'Agent behavior is severely deviating from its expected task baseline.';
  } else if (trajectoryDeviation > 50) {
    simpleText = 'Agent is gradually moving beyond its intended operational boundaries.';
  } else if (trajectoryDeviation > 30) {
    simpleText = 'Agent activity shows mild deviations from typical baseline patterns.';
  }

  return {
    trajectoryDeviation,
    components,
    plainReasons,
    simpleText
  };
}
