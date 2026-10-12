import crypto from 'crypto';
import { AuditService, auditService as defaultAudit } from '../audit/service.js';
import { SpamGuardConfig, CheckSpamInput, SpamCheckResult, SpamSignals } from './types.js';

export function computeRequestFingerprint(input: {
  agentId: string;
  sessionId: string;
  action?: string;
  resource?: string;
  tool?: string;
  toolParams?: Record<string, unknown>;
}): string {
  const parts: string[] = [
    (input.agentId || 'unknown-agent').trim(),
    (input.sessionId || 'unknown-session').trim(),
    (input.action || input.tool || 'ACTION').trim().toUpperCase(),
    (input.resource || input.tool || 'resource').trim().toLowerCase()
  ];

  if (input.tool) {
    parts.push(input.tool.trim());
  }

  if (input.toolParams && typeof input.toolParams === 'object') {
    // Deterministically serialize safe scalar keys without storing sensitive raw blobs
    const sortedKeys = Object.keys(input.toolParams).sort();
    const safePairs = sortedKeys.map((k) => {
      const v = input.toolParams![k];
      const safeVal = typeof v === 'object' && v !== null ? '[complex]' : String(v);
      return `${k}=${safeVal}`;
    });
    parts.push(safePairs.join('&'));
  }

  return crypto.createHash('sha256').update(parts.join('::')).digest('hex');
}

interface DuplicateRecord {
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export class SpamGuardService {
  private config: SpamGuardConfig;
  private requestTimestamps = new Map<string, number[]>();
  private duplicateRecords = new Map<string, DuplicateRecord>();
  private audit: AuditService;

  constructor(audit: AuditService = defaultAudit, configOverrides?: Partial<SpamGuardConfig>) {
    this.audit = audit;
    this.config = this.resolveConfig(configOverrides);
  }

  public setAuditService(audit: AuditService): void {
    this.audit = audit;
  }

  public configure(overrides: Partial<SpamGuardConfig>): void {
    this.config = { ...this.config, ...overrides };
  }

  public getConfig(): SpamGuardConfig {
    return { ...this.config };
  }

  public reset(): void {
    this.requestTimestamps.clear();
    this.duplicateRecords.clear();
  }

  private resolveConfig(overrides?: Partial<SpamGuardConfig>): SpamGuardConfig {
    const rateLimitWindowMs = Number(process.env.SPAM_RATE_LIMIT_WINDOW_MS) || 60000;
    const rateLimitMaxRequests = Number(process.env.SPAM_RATE_LIMIT_MAX_REQUESTS) || 100;
    const burstWindowMs = Number(process.env.SPAM_BURST_WINDOW_MS) || 5000;
    const burstMaxRequests = Number(process.env.SPAM_BURST_MAX_REQUESTS) || 15;
    const duplicateWindowMs = Number(process.env.SPAM_DUPLICATE_WINDOW_MS) || 30000;

    return {
      rateLimitWindowMs,
      rateLimitMaxRequests,
      burstWindowMs,
      burstMaxRequests,
      duplicateWindowMs,
      ...overrides
    };
  }

  /**
   * Pre-check incoming action/tool request against rate limits, burst thresholds, and duplicate action patterns.
   * Fails closed: if an internal unexpected error occurs, returns throttled=true and allowed=false.
   */
  public async check(input: CheckSpamInput): Promise<SpamCheckResult> {
    try {
      const now = input.timestamp || Date.now();
      const agentId = input.agentId?.trim() || 'unknown-agent';
      const sessionId = input.sessionId?.trim() || 'unknown-session';
      const rateLimitKey = `${agentId}:${sessionId}`;

      // 1. Sliding window rate limit & burst tracking
      let timestamps = this.requestTimestamps.get(rateLimitKey);
      if (!timestamps) {
        timestamps = [];
        this.requestTimestamps.set(rateLimitKey, timestamps);
      }

      // Filter timestamps within rate limit window
      const rateLimitCutoff = now - this.config.rateLimitWindowMs;
      timestamps = timestamps.filter((t) => t > rateLimitCutoff);
      timestamps.push(now);
      this.requestTimestamps.set(rateLimitKey, timestamps);

      const requestRate = timestamps.length;
      const rateLimitExceeded = requestRate > this.config.rateLimitMaxRequests;

      // Burst tracking: short rolling window
      const burstCutoff = now - this.config.burstWindowMs;
      const burstCount = timestamps.filter((t) => t > burstCutoff).length;
      const burstDetected = burstCount > this.config.burstMaxRequests;

      // 2. Duplicate / Replay Detection
      const fingerprint = computeRequestFingerprint({
        agentId,
        sessionId,
        action: input.action,
        resource: input.resource,
        tool: input.tool,
        toolParams: input.toolParams
      });

      let duplicateRecord = this.duplicateRecords.get(fingerprint);
      let duplicateDetected = false;
      let duplicateCount = 1;

      if (duplicateRecord && now - duplicateRecord.lastSeen <= this.config.duplicateWindowMs) {
        duplicateRecord.count += 1;
        duplicateRecord.lastSeen = now;
        duplicateCount = duplicateRecord.count;
        duplicateDetected = duplicateCount >= 2;
      } else {
        duplicateRecord = { count: 1, firstSeen: now, lastSeen: now };
        this.duplicateRecords.set(fingerprint, duplicateRecord);
      }

      // 3. Status determination
      let status: 'NORMAL' | 'WARNING' | 'THROTTLED' | 'BLOCKED' = 'NORMAL';
      if (rateLimitExceeded) {
        status = 'THROTTLED';
      } else if (burstDetected || (duplicateDetected && duplicateCount > 2)) {
        status = 'WARNING';
      }

      const signals: SpamSignals = {
        burstDetected,
        requestRate,
        threshold: this.config.rateLimitMaxRequests,
        duplicateDetected,
        duplicateCount,
        rateLimitExceeded,
        windowMs: this.config.rateLimitWindowMs,
        status,
        fingerprint
      };

      // 4. Audit Logging for anomalies
      if (rateLimitExceeded) {
        try {
          await this.audit.logEvent({
            eventType: 'RATE_LIMIT_TRIGGERED',
            entityType: 'action',
            entityId: fingerprint.slice(0, 16),
            sessionId,
            actor: agentId,
            payload: {
              requestRate,
              threshold: this.config.rateLimitMaxRequests,
              windowMs: this.config.rateLimitWindowMs,
              action: input.action,
              resource: input.resource
            }
          });

          await this.audit.logEvent({
            eventType: 'REQUEST_THROTTLED',
            entityType: 'action',
            entityId: fingerprint.slice(0, 16),
            sessionId,
            actor: agentId,
            payload: {
              requestRate,
              threshold: this.config.rateLimitMaxRequests,
              action: input.action,
              resource: input.resource
            }
          });
        } catch (auditErr) {
          console.warn('[SPAM_GUARD] Failed to log rate limit audit event:', (auditErr as Error).message);
        }

        return {
          allowed: false,
          throttled: true,
          reason: `Rate limit of ${this.config.rateLimitMaxRequests} requests per ${this.config.rateLimitWindowMs / 1000}s exceeded`,
          fingerprint,
          signals
        };
      }

      if (burstDetected) {
        try {
          await this.audit.logEvent({
            eventType: 'BURST_DETECTED',
            entityType: 'action',
            entityId: fingerprint.slice(0, 16),
            sessionId,
            actor: agentId,
            payload: {
              burstCount,
              burstThreshold: this.config.burstMaxRequests,
              burstWindowMs: this.config.burstWindowMs,
              action: input.action,
              resource: input.resource
            }
          });
        } catch (auditErr) {
          console.warn('[SPAM_GUARD] Failed to log burst audit event:', (auditErr as Error).message);
        }
      }

      if (duplicateDetected) {
        try {
          await this.audit.logEvent({
            eventType: 'DUPLICATE_DETECTED',
            entityType: 'action',
            entityId: fingerprint.slice(0, 16),
            sessionId,
            actor: agentId,
            payload: {
              duplicateCount,
              duplicateWindowMs: this.config.duplicateWindowMs,
              action: input.action,
              resource: input.resource
            }
          });
        } catch (auditErr) {
          console.warn('[SPAM_GUARD] Failed to log duplicate audit event:', (auditErr as Error).message);
        }
      }

      // Memory maintenance: prune old duplicate records periodically
      if (this.duplicateRecords.size > 2000) {
        const pruneCutoff = now - this.config.duplicateWindowMs * 2;
        for (const [k, v] of this.duplicateRecords.entries()) {
          if (v.lastSeen < pruneCutoff) {
            this.duplicateRecords.delete(k);
          }
        }
      }

      return {
        allowed: true,
        throttled: false,
        fingerprint,
        signals
      };
    } catch (err) {
      // SAFE FAILURE: Never allow an internal spam guard error to bypass security. Fail closed.
      console.error('[SPAM_GUARD] Unexpected internal failure in spam guard (failing closed):', err);
      return {
        allowed: false,
        throttled: true,
        reason: 'Security check failed closed due to an internal error',
        signals: {
          burstDetected: false,
          requestRate: 0,
          threshold: this.config.rateLimitMaxRequests,
          duplicateDetected: false,
          duplicateCount: 0,
          rateLimitExceeded: true,
          windowMs: this.config.rateLimitWindowMs,
          status: 'BLOCKED'
        }
      };
    }
  }
}

export const spamGuardService = new SpamGuardService();
