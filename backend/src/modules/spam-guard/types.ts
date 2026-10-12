import type { SpamSignals, SpamCheckResult } from '@sentinel/shared';

export interface SpamGuardConfig {
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  burstWindowMs: number;
  burstMaxRequests: number;
  duplicateWindowMs: number;
}

export interface CheckSpamInput {
  agentId: string;
  sessionId: string;
  action: string;
  resource: string;
  tool?: string;
  toolParams?: Record<string, unknown>;
  timestamp?: number;
}

export { SpamSignals, SpamCheckResult };
