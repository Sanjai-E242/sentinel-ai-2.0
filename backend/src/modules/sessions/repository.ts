import fs from 'fs';
import path from 'path';
import { Session } from '@sentinel/shared';
import { config, StorageDriver } from '../../config/index.js';
import { supabaseClient } from '../../database/client.js';
import { handleDatabaseError } from '../../database/errors.js';
import { getLocalDataDir } from '../../database/localStore.js';

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  findByAgentId(agentId: string): Promise<Session[]>;
  findAll(): Promise<Session[]>;
  create(session: Session): Promise<Session>;
  update(session: Session): Promise<Session>;
  clear?(): Promise<void>;
}

/**
 * In-Memory Session Repository (used for deterministic unit tests)
 */
export class InMemorySessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();

  async findById(id: string): Promise<Session | null> {
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  async findByAgentId(agentId: string): Promise<Session[]> {
    return Array.from(this.sessions.values())
      .filter((s) => s.agentId === agentId)
      .map((s) => ({ ...s }));
  }

  async findAll(): Promise<Session[]> {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }

  async create(session: Session): Promise<Session> {
    const copy = { ...session };
    this.sessions.set(session.id, copy);
    return { ...copy };
  }

  async update(session: Session): Promise<Session> {
    const copy = { ...session };
    this.sessions.set(session.id, copy);
    return { ...copy };
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }
}

/**
 * File-backed Local Session Repository (survives restarts when Supabase credentials are not set)
 */
export class LocalSessionRepository implements SessionRepository {
  private filePath: string;
  private sessions: Map<string, Session> = new Map();

  constructor() {
    const dataDir = getLocalDataDir();
    this.filePath = path.join(dataDir, 'sentinel-sessions.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: Session[] = JSON.parse(raw);
        this.sessions = new Map(list.map((s) => [s.id, s]));
      }
    } catch {
      this.sessions = new Map();
    }
  }

  private saveToDisk(): void {
    try {
      const list = Array.from(this.sessions.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[LocalSessionRepository] Failed to write to disk:', (err as Error).message);
    }
  }

  async findById(id: string): Promise<Session | null> {
    this.loadFromDisk();
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  async findByAgentId(agentId: string): Promise<Session[]> {
    this.loadFromDisk();
    return Array.from(this.sessions.values())
      .filter((s) => s.agentId === agentId)
      .map((s) => ({ ...s }));
  }

  async findAll(): Promise<Session[]> {
    this.loadFromDisk();
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }

  async create(session: Session): Promise<Session> {
    const copy = { ...session };
    this.sessions.set(session.id, copy);
    this.saveToDisk();
    return { ...copy };
  }

  async update(session: Session): Promise<Session> {
    const copy = { ...session };
    this.sessions.set(session.id, copy);
    this.saveToDisk();
    return { ...copy };
  }

  async clear(): Promise<void> {
    this.sessions.clear();
    this.saveToDisk();
  }
}

/**
 * Supabase PostgreSQL Session Repository
 */
export class SupabaseSessionRepository implements SessionRepository {
  private mapRowToSession(data: any): Session {
    const metadata = data.metadata || {};
    return {
      id: data.id,
      agentId: data.agent_id,
      status: data.status,
      startedAt: data.started_at,
      endedAt: data.ended_at || undefined,
      currentRisk: Number(data.current_risk) || 0,
      trajectoryDeviation: Number(data.trajectory_deviation) || 0,
      actionCount: Number(data.action_count) || 0,
      riskDelta: data.risk_delta !== undefined ? Number(data.risk_delta) : (metadata.riskDelta ?? 0),
      riskVelocity: data.risk_velocity || metadata.riskVelocity || 'LOW',
      riskAcceleration: data.risk_acceleration || metadata.riskAcceleration || 'STABLE',
      trajectoryState: data.trajectory_state || metadata.trajectoryState || 'NORMAL',
      metadata
    };
  }

  async findById(id: string): Promise<Session | null> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await client
      .from('sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      handleDatabaseError(error, 'sessions.findById');
    }

    if (!data) return null;
    return this.mapRowToSession(data);
  }

  async findByAgentId(agentId: string): Promise<Session[]> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await client
      .from('sessions')
      .select('*')
      .eq('agent_id', agentId)
      .order('started_at', { ascending: false });

    if (error) {
      handleDatabaseError(error, 'sessions.findByAgentId');
    }

    return (data || []).map((row: any) => this.mapRowToSession(row));
  }

  async findAll(): Promise<Session[]> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await client
      .from('sessions')
      .select('*')
      .order('started_at', { ascending: false });

    if (error) {
      handleDatabaseError(error, 'sessions.findAll');
    }

    return (data || []).map((row: any) => this.mapRowToSession(row));
  }

  async create(session: Session): Promise<Session> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const metadata = {
      ...(session.metadata || {}),
      riskDelta: session.riskDelta ?? 0,
      riskVelocity: session.riskVelocity ?? 'LOW',
      riskAcceleration: session.riskAcceleration ?? 'STABLE',
      trajectoryState: session.trajectoryState ?? 'NORMAL'
    };

    const row = {
      id: session.id,
      agent_id: session.agentId,
      status: session.status,
      started_at: session.startedAt,
      ended_at: session.endedAt || null,
      current_risk: session.currentRisk,
      trajectory_deviation: session.trajectoryDeviation,
      action_count: session.actionCount || 0,
      metadata
    };

    const { data, error } = await client
      .from('sessions')
      .insert(row)
      .select()
      .single();

    if (error) {
      handleDatabaseError(error, 'sessions.create');
    }

    return this.mapRowToSession(data);
  }

  async update(session: Session): Promise<Session> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const metadata = {
      ...(session.metadata || {}),
      riskDelta: session.riskDelta ?? 0,
      riskVelocity: session.riskVelocity ?? 'LOW',
      riskAcceleration: session.riskAcceleration ?? 'STABLE',
      trajectoryState: session.trajectoryState ?? 'NORMAL'
    };

    const row = {
      status: session.status,
      ended_at: session.endedAt || null,
      current_risk: session.currentRisk,
      trajectory_deviation: session.trajectoryDeviation,
      action_count: session.actionCount || 0,
      metadata
    };

    const { data, error } = await client
      .from('sessions')
      .update(row)
      .eq('id', session.id)
      .select()
      .single();

    if (error) {
      handleDatabaseError(error, 'sessions.update');
    }

    return this.mapRowToSession(data);
  }
}

export function createSessionRepository(driver: StorageDriver = config.storageDriver): SessionRepository {
  switch (driver) {
    case 'supabase':
      return new SupabaseSessionRepository();
    case 'local':
      return new LocalSessionRepository();
    case 'memory':
    default:
      return new InMemorySessionRepository();
  }
}

export const sessionRepository = createSessionRepository();
