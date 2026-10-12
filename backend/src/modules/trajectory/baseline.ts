import { Agent, ActionSensitivity } from '@sentinel/shared';

export interface AgentBaselineConfig {
  agentType?: string;
  expectedScopes: string[];
  expectedResourceTypes: string[];
  expectedActions: string[];
  maxExpectedSensitivity: ActionSensitivity;
  canonicalSequence: string[];
  expectedResourceFamilies: string[];
  restrictedResourceFamilies: string[];
  maxAcceptableVelocityPerMinute: number;
}

export const DEFAULT_RESEARCH_BASELINE: AgentBaselineConfig = {
  agentType: 'research-agent',
  expectedScopes: [
    'project.read',
    'project.write',
    'source.read',
    'code:read',
    'code:write',
    'docs:read',
    'docs:write',
    'data:read'
  ],
  expectedResourceTypes: [
    'document',
    'report',
    'source_code',
    'resource',
    'notes',
    'codebase',
    'file'
  ],
  expectedActions: ['READ', 'WRITE', 'DOWNLOAD', 'EXTERNAL_REQUEST'],
  maxExpectedSensitivity: 'MEDIUM',
  canonicalSequence: ['READ', 'READ', 'WRITE'],
  expectedResourceFamilies: [
    'project',
    'doc',
    'source',
    'repo',
    'notes',
    'readme',
    'report',
    'code',
    'src'
  ],
  restrictedResourceFamilies: [
    'finance',
    'salary',
    'payroll',
    'ledger',
    'admin',
    'root',
    'secret',
    'key',
    'database',
    'prod',
    'billing'
  ],
  maxAcceptableVelocityPerMinute: 60
};

/**
 * Resolves baseline for an agent. Allows custom overrides in agent.metadata.baseline if specified.
 */
export function getBaselineForAgent(agent?: Agent): AgentBaselineConfig {
  if (agent?.metadata?.baseline && typeof agent.metadata.baseline === 'object') {
    return {
      ...DEFAULT_RESEARCH_BASELINE,
      ...(agent.metadata.baseline as Partial<AgentBaselineConfig>)
    };
  }

  // If agent has registered scopes, include them in expectedScopes automatically
  if (agent && Array.isArray(agent.scopes) && agent.scopes.length > 0) {
    const combinedScopes = Array.from(new Set([...DEFAULT_RESEARCH_BASELINE.expectedScopes, ...agent.scopes]));
    return {
      ...DEFAULT_RESEARCH_BASELINE,
      expectedScopes: combinedScopes
    };
  }

  return DEFAULT_RESEARCH_BASELINE;
}
