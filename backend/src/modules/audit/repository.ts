import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AuditLogEntry } from '@sentinel/shared';
import { config, StorageDriver } from '../../config/index.js';
import { supabaseClient } from '../../database/client.js';
import { handleDatabaseError } from '../../database/errors.js';
import { getLocalDataDir } from '../../database/localStore.js';

export interface AuditLogFilter {
  sessionId?: string;
  eventType?: string;
  entityId?: string;
  limit?: number;
}

export interface AuditLogRepository {
  append(entry: AuditLogEntry): Promise<AuditLogEntry>;
  findAll(filter?: AuditLogFilter): Promise<AuditLogEntry[]>;
  clear?(): Promise<void>;
}

/**
 * In-Memory Audit Repository (used in tests and fallback)
 */
export class InMemoryAuditLogRepository implements AuditLogRepository {
  private logs: AuditLogEntry[] = [];

  async append(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const copy = { ...entry };
    this.logs.push(copy);
    return { ...copy };
  }

  async findAll(filter?: AuditLogFilter): Promise<AuditLogEntry[]> {
    let result = [...this.logs];
    if (filter?.sessionId) {
      result = result.filter((l) => l.sessionId === filter.sessionId);
    }
    if (filter?.eventType) {
      result = result.filter((l) => l.eventType === filter.eventType);
    }
    if (filter?.entityId) {
      result = result.filter((l) => l.entityId === filter.entityId);
    }
    // Return newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }
    return result.map((l) => ({ ...l }));
  }

  async clear(): Promise<void> {
    this.logs = [];
  }
}

/**
 * File-backed Local Audit Repository (survives process restarts when Supabase credentials are not set)
 */
export class LocalAuditLogRepository implements AuditLogRepository {
  private filePath: string;
  private logs: AuditLogEntry[] = [];

  constructor() {
    const dataDir = getLocalDataDir();
    this.filePath = path.join(dataDir, 'sentinel-audit.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.logs = JSON.parse(raw);
      }
    } catch {
      this.logs = [];
    }
  }

  private saveToDisk(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[LocalAuditLogRepository] Failed to write to disk:', (err as Error).message);
    }
  }

  async append(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const copy = { ...entry };
    this.logs.push(copy);
    this.saveToDisk();
    return { ...copy };
  }

  async findAll(filter?: AuditLogFilter): Promise<AuditLogEntry[]> {
    this.loadFromDisk();
    let result = [...this.logs];
    if (filter?.sessionId) {
      result = result.filter((l) => l.sessionId === filter.sessionId);
    }
    if (filter?.eventType) {
      result = result.filter((l) => l.eventType === filter.eventType);
    }
    if (filter?.entityId) {
      result = result.filter((l) => l.entityId === filter.entityId);
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }
    return result.map((l) => ({ ...l }));
  }

  async clear(): Promise<void> {
    this.logs = [];
    this.saveToDisk();
  }
}

/**
 * Supabase PostgreSQL Audit Repository
 */
export class SupabaseAuditLogRepository implements AuditLogRepository {
  async append(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable for audit logging');
    }

    const row = {
      id: entry.id,
      event_type: entry.eventType,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      session_id: entry.sessionId || null,
      actor: entry.actor,
      payload: entry.payload || {},
      created_at: entry.createdAt
    };

    const { error } = await client.from('audit_logs').insert(row);
    if (error) {
      handleDatabaseError(error, 'audit_logs.insert');
    }

    return { ...entry };
  }

  async findAll(filter?: AuditLogFilter): Promise<AuditLogEntry[]> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable for audit log retrieval');
    }

    let query = client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter?.sessionId) {
      query = query.eq('session_id', filter.sessionId);
    }
    if (filter?.eventType) {
      query = query.eq('event_type', filter.eventType);
    }
    if (filter?.entityId) {
      query = query.eq('entity_id', filter.entityId);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error) {
      handleDatabaseError(error, 'audit_logs.select');
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      sessionId: row.session_id || undefined,
      actor: row.actor,
      payload: row.payload || {},
      createdAt: row.created_at
    }));
  }
}

export function createAuditLogRepository(driver: StorageDriver = config.storageDriver): AuditLogRepository {
  switch (driver) {
    case 'supabase':
      return new SupabaseAuditLogRepository();
    case 'local':
      return new LocalAuditLogRepository();
    case 'memory':
    default:
      return new InMemoryAuditLogRepository();
  }
}

export const auditLogRepository: AuditLogRepository = createAuditLogRepository();
