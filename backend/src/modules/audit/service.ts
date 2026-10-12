import crypto from 'crypto';
import { AuditLogEntry, CreateAuditLogInput } from '@sentinel/shared';
import { AuditLogRepository, auditLogRepository, AuditLogFilter } from './repository.js';

export class AuditService {
  constructor(private repo: AuditLogRepository = auditLogRepository) {}

  public setRepository(repo: AuditLogRepository): void {
    this.repo = repo;
  }

  public async logEvent(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    const id = `aud_${crypto.randomBytes(8).toString('hex')}`;
    const entry: AuditLogEntry = {
      id,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      sessionId: input.sessionId,
      actor: input.actor || 'sentinel-control-plane',
      payload: input.payload || {},
      createdAt: new Date().toISOString()
    };

    try {
      return await this.repo.append(entry);
    } catch (err) {
      // Audit logging errors should be logged prominently but not silently crash the system
      console.error(`[AUDIT_FAILURE] Failed to persist audit event ${input.eventType}:`, (err as Error).message);
      return entry;
    }
  }

  public async listLogs(filter?: AuditLogFilter): Promise<AuditLogEntry[]> {
    return this.repo.findAll(filter);
  }
}

export const auditService = new AuditService();
