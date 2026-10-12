import fs from 'fs';
import path from 'path';
import { ActionEvent } from '@sentinel/shared';
import { config, StorageDriver } from '../../config/index.js';
import { supabaseClient } from '../../database/client.js';
import { handleDatabaseError } from '../../database/errors.js';
import { getLocalDataDir } from '../../database/localStore.js';

export interface ActionEventRepository {
  findById(eventId: string): Promise<ActionEvent | null>;
  findBySessionId(sessionId: string): Promise<ActionEvent[]>;
  findByAgentId(agentId: string): Promise<ActionEvent[]>;
  findAll(): Promise<ActionEvent[]>;
  create(event: ActionEvent): Promise<ActionEvent>;
  clear?(): Promise<void>;
}

/**
 * In-Memory Action Event Repository (used for deterministic unit tests)
 */
export class InMemoryActionEventRepository implements ActionEventRepository {
  private events: Map<string, ActionEvent> = new Map();

  async findById(eventId: string): Promise<ActionEvent | null> {
    const event = this.events.get(eventId);
    return event ? { ...event } : null;
  }

  async findBySessionId(sessionId: string): Promise<ActionEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => e.sessionId === sessionId)
      .map((e) => ({ ...e }));
  }

  async findByAgentId(agentId: string): Promise<ActionEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => e.agentId === agentId)
      .map((e) => ({ ...e }));
  }

  async findAll(): Promise<ActionEvent[]> {
    return Array.from(this.events.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map((e) => ({ ...e }));
  }

  async create(event: ActionEvent): Promise<ActionEvent> {
    const copy = { ...event };
    this.events.set(event.eventId, copy);
    return { ...copy };
  }

  async clear(): Promise<void> {
    this.events.clear();
  }
}

/**
 * File-backed Local Action Event Repository (survives restarts when Supabase credentials are not set)
 */
export class LocalActionEventRepository implements ActionEventRepository {
  private filePath: string;
  private events: Map<string, ActionEvent> = new Map();

  constructor() {
    const dataDir = getLocalDataDir();
    this.filePath = path.join(dataDir, 'sentinel-actions.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: ActionEvent[] = JSON.parse(raw);
        this.events = new Map(list.map((e) => [e.eventId, e]));
      }
    } catch {
      this.events = new Map();
    }
  }

  private saveToDisk(): void {
    try {
      const list = Array.from(this.events.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[LocalActionEventRepository] Failed to write to disk:', (err as Error).message);
    }
  }

  async findById(eventId: string): Promise<ActionEvent | null> {
    this.loadFromDisk();
    const event = this.events.get(eventId);
    return event ? { ...event } : null;
  }

  async findBySessionId(sessionId: string): Promise<ActionEvent[]> {
    this.loadFromDisk();
    return Array.from(this.events.values())
      .filter((e) => e.sessionId === sessionId)
      .map((e) => ({ ...e }));
  }

  async findByAgentId(agentId: string): Promise<ActionEvent[]> {
    this.loadFromDisk();
    return Array.from(this.events.values())
      .filter((e) => e.agentId === agentId)
      .map((e) => ({ ...e }));
  }

  async findAll(): Promise<ActionEvent[]> {
    this.loadFromDisk();
    return Array.from(this.events.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map((e) => ({ ...e }));
  }

  async create(event: ActionEvent): Promise<ActionEvent> {
    const copy = { ...event };
    this.events.set(event.eventId, copy);
    this.saveToDisk();
    return { ...copy };
  }

  async clear(): Promise<void> {
    this.events.clear();
    this.saveToDisk();
  }
}

/**
 * Supabase PostgreSQL Action Event Repository
 */
export class SupabaseActionEventRepository implements ActionEventRepository {
  async findById(eventId: string): Promise<ActionEvent | null> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await client
      .from('action_events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (error) {
      handleDatabaseError(error, 'action_events.findById');
    }

    if (!data) return null;

    return {
      eventId: data.id,
      sessionId: data.session_id,
      agentId: data.agent_id,
      timestamp: data.timestamp,
      action: data.action,
      resource: data.resource,
      resourceType: data.resource_type,
      scope: data.scope,
      sensitivity: data.sensitivity,
      reversibility: data.reversibility,
      authorization: data.authorization,
      metadata: data.metadata || {}
    };
  }

  async findBySessionId(sessionId: string): Promise<ActionEvent[]> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await client
      .from('action_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false });

    if (error) {
      handleDatabaseError(error, 'action_events.findBySessionId');
    }

    return (data || []).map((row: any) => ({
      eventId: row.id,
      sessionId: row.session_id,
      agentId: row.agent_id,
      timestamp: row.timestamp,
      action: row.action,
      resource: row.resource,
      resourceType: row.resource_type,
      scope: row.scope,
      sensitivity: row.sensitivity,
      reversibility: row.reversibility,
      authorization: row.authorization,
      metadata: row.metadata || {}
    }));
  }

  async findByAgentId(agentId: string): Promise<ActionEvent[]> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await client
      .from('action_events')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false });

    if (error) {
      handleDatabaseError(error, 'action_events.findByAgentId');
    }

    return (data || []).map((row: any) => ({
      eventId: row.id,
      sessionId: row.session_id,
      agentId: row.agent_id,
      timestamp: row.timestamp,
      action: row.action,
      resource: row.resource,
      resourceType: row.resource_type,
      scope: row.scope,
      sensitivity: row.sensitivity,
      reversibility: row.reversibility,
      authorization: row.authorization,
      metadata: row.metadata || {}
    }));
  }

  async findAll(): Promise<ActionEvent[]> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await client
      .from('action_events')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      handleDatabaseError(error, 'action_events.findAll');
    }

    return (data || []).map((row: any) => ({
      eventId: row.id,
      sessionId: row.session_id,
      agentId: row.agent_id,
      timestamp: row.timestamp,
      action: row.action,
      resource: row.resource,
      resourceType: row.resource_type,
      scope: row.scope,
      sensitivity: row.sensitivity,
      reversibility: row.reversibility,
      authorization: row.authorization,
      metadata: row.metadata || {}
    }));
  }

  async create(event: ActionEvent): Promise<ActionEvent> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const row = {
      id: event.eventId,
      session_id: event.sessionId,
      agent_id: event.agentId,
      timestamp: event.timestamp,
      action: event.action,
      resource: event.resource,
      resource_type: event.resourceType,
      scope: event.scope,
      sensitivity: event.sensitivity,
      reversibility: event.reversibility,
      authorization: event.authorization,
      risk_score: 0,
      decision: 'PENDING',
      metadata: event.metadata || {}
    };

    const { data, error } = await client
      .from('action_events')
      .insert(row)
      .select()
      .single();

    if (error) {
      handleDatabaseError(error, 'action_events.create');
    }

    return {
      eventId: data.id,
      sessionId: data.session_id,
      agentId: data.agent_id,
      timestamp: data.timestamp,
      action: data.action,
      resource: data.resource,
      resourceType: data.resource_type,
      scope: data.scope,
      sensitivity: data.sensitivity,
      reversibility: data.reversibility,
      authorization: data.authorization,
      metadata: data.metadata || {}
    };
  }
}

export function createActionEventRepository(driver: StorageDriver = config.storageDriver): ActionEventRepository {
  switch (driver) {
    case 'supabase':
      return new SupabaseActionEventRepository();
    case 'local':
      return new LocalActionEventRepository();
    case 'memory':
    default:
      return new InMemoryActionEventRepository();
  }
}

export const actionEventRepository = createActionEventRepository();
