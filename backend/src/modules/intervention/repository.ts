import fs from 'fs';
import path from 'path';
import { PendingInterventionRecord } from '@sentinel/shared';
import { supabaseClient } from '../../database/client.js';
import { getLocalDataDir } from '../../database/localStore.js';
import { config } from '../../config/index.js';

export interface InterventionRepository {
  create(record: PendingInterventionRecord): Promise<PendingInterventionRecord>;
  findById(id: string): Promise<PendingInterventionRecord | null>;
  findBySessionId(sessionId: string): Promise<PendingInterventionRecord[]>;
  findLatestBySessionId(sessionId: string): Promise<PendingInterventionRecord | null>;
  findPending(): Promise<PendingInterventionRecord[]>;
  findAll(): Promise<PendingInterventionRecord[]>;
  update(record: PendingInterventionRecord): Promise<PendingInterventionRecord>;
  clear?(): Promise<void>;
}

/**
 * In-Memory Intervention Repository for isolated tests
 */
export class InMemoryInterventionRepository implements InterventionRepository {
  private records: Map<string, PendingInterventionRecord> = new Map();

  async create(record: PendingInterventionRecord): Promise<PendingInterventionRecord> {
    this.records.set(record.id, { ...record });
    return { ...record };
  }

  async findById(id: string): Promise<PendingInterventionRecord | null> {
    const item = this.records.get(id);
    return item ? { ...item } : null;
  }

  async findBySessionId(sessionId: string): Promise<PendingInterventionRecord[]> {
    return Array.from(this.records.values())
      .filter((r: PendingInterventionRecord) => r.sessionId === sessionId)
      .sort((a: PendingInterventionRecord, b: PendingInterventionRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  async findLatestBySessionId(sessionId: string): Promise<PendingInterventionRecord | null> {
    const list = await this.findBySessionId(sessionId);
    return list.length > 0 ? list[0] : null;
  }

  async findPending(): Promise<PendingInterventionRecord[]> {
    return Array.from(this.records.values())
      .filter((r: PendingInterventionRecord) => r.status === 'PENDING')
      .sort((a: PendingInterventionRecord, b: PendingInterventionRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  async findAll(): Promise<PendingInterventionRecord[]> {
    return Array.from(this.records.values()).sort(
      (a: PendingInterventionRecord, b: PendingInterventionRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async update(record: PendingInterventionRecord): Promise<PendingInterventionRecord> {
    this.records.set(record.id, { ...record });
    return { ...record };
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

/**
 * Persistent Intervention Repository with Local Disk Fallback & Supabase
 */
export class PersistentInterventionRepository implements InterventionRepository {
  private filePath: string;
  private records: Map<string, PendingInterventionRecord> = new Map();

  constructor() {
    const dataDir = getLocalDataDir();
    this.filePath = path.join(dataDir, 'sentinel-interventions.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: PendingInterventionRecord[] = JSON.parse(raw);
        this.records = new Map(list.map((r) => [r.id, r]));
      }
    } catch {
      this.records = new Map();
    }
  }

  private saveToDisk(): void {
    try {
      const list = Array.from(this.records.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[PersistentInterventionRepository] Failed to write to disk:', (err as Error).message);
    }
  }

  async create(record: PendingInterventionRecord): Promise<PendingInterventionRecord> {
    const client = supabaseClient.getClient();
    if (config.supabase.isConfigured && client) {
      try {
        await client.from('interventions').insert({
          id: record.id,
          session_id: record.sessionId,
          action_event_id: record.actionEventId,
          intervention_window: record.interventionWindow,
          urgency: record.urgency,
          recommendation: record.recommendation,
          current_risk: record.currentRisk,
          predicted_risk: record.predictedRisk,
          intervention_cost: 'MEDIUM',
          explanation: record.explanation,
          status: record.status,
          metadata: {
            agentId: record.agentId,
            agentName: record.agentName,
            action: record.action,
            resource: record.resource,
            reasons: record.reasons,
            forecast: record.forecast,
            counterfactual: record.counterfactual
          },
          created_at: record.createdAt
        });
      } catch {
        // Fall back to local disk
      }
    }

    this.records.set(record.id, { ...record });
    this.saveToDisk();
    return { ...record };
  }

  async findById(id: string): Promise<PendingInterventionRecord | null> {
    this.loadFromDisk();
    const item = this.records.get(id);
    return item ? { ...item } : null;
  }

  async findBySessionId(sessionId: string): Promise<PendingInterventionRecord[]> {
    this.loadFromDisk();
    return Array.from(this.records.values())
      .filter((r: PendingInterventionRecord) => r.sessionId === sessionId)
      .sort((a: PendingInterventionRecord, b: PendingInterventionRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  async findLatestBySessionId(sessionId: string): Promise<PendingInterventionRecord | null> {
    const list = await this.findBySessionId(sessionId);
    return list.length > 0 ? list[0] : null;
  }

  async findPending(): Promise<PendingInterventionRecord[]> {
    this.loadFromDisk();
    return Array.from(this.records.values())
      .filter((r: PendingInterventionRecord) => r.status === 'PENDING')
      .sort((a: PendingInterventionRecord, b: PendingInterventionRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  async findAll(): Promise<PendingInterventionRecord[]> {
    this.loadFromDisk();
    return Array.from(this.records.values()).sort(
      (a: PendingInterventionRecord, b: PendingInterventionRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async update(record: PendingInterventionRecord): Promise<PendingInterventionRecord> {
    const client = supabaseClient.getClient();
    if (config.supabase.isConfigured && client) {
      try {
        await client
          .from('interventions')
          .update({
            status: record.status,
            metadata: {
              resolvedAt: record.resolvedAt,
              resolvedBy: record.resolvedBy,
              resolutionDecision: record.resolutionDecision,
              resolutionNotes: record.resolutionNotes
            }
          })
          .eq('id', record.id);
      } catch {
        // Continue to local disk update
      }
    }

    this.records.set(record.id, { ...record });
    this.saveToDisk();
    return { ...record };
  }

  async clear(): Promise<void> {
    this.records.clear();
    this.saveToDisk();
  }
}

const isTestEnv = process.env.NODE_ENV === 'test' || !process.env.NODE_ENV;
export const interventionRepository: InterventionRepository = isTestEnv
  ? new InMemoryInterventionRepository()
  : new PersistentInterventionRepository();
