/**
 * Spam & Abuse Prevention Domain Types for Sentinel 2.0
 */

export const SPAM_GUARD_VERSION = '2.0.0';

export interface SpamSignals {
  burstDetected: boolean;
  requestRate: number;      // requests in current window
  threshold: number;        // configured rate limit max
  duplicateDetected: boolean;
  duplicateCount: number;
  rateLimitExceeded: boolean;
  windowMs: number;
  status: 'NORMAL' | 'WARNING' | 'THROTTLED' | 'BLOCKED';
  fingerprint?: string;
}

export interface SpamCheckResult {
  allowed: boolean;
  throttled: boolean;
  reason?: string;
  fingerprint?: string;
  signals: SpamSignals;
}
