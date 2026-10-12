import fs from 'fs';
import path from 'path';
import { Agent } from '@sentinel/shared';
import { config, StorageDriver } from '../../config/index.js';
import { supabaseClient } from '../../database/client.js';
import { handleDatabaseError } from '../../database/errors.js';
import { getLocalDataDir } from '../../database/localStore.js';

export interface AgentRepository {
  findById(id: string): Promise<Agent | null>;
  findAll(): Promise<Agent[]>;
  create(agent: Agent): Promise<Agent>;
  update(agent: Agent): Promise<Agent>;
  clear?(): Promise<void>; // for test isolation
}

/**
 * In-Memory Agent Repository (used for deterministic unit tests)
 */
export class InMemoryAgentRepository implements AgentRepository {
  private agents: Map<string, Agent> = new Map();

  async findById(id: string): Promise<Agent | null> {
    const agent = this.agents.get(id);
    return agent ? { ...agent } : null;
  }

  async findAll(): Promise<Agent[]> {
    return Array.from(this.agents.values()).map((agent) => ({ ...agent }));
  }

  async create(agent: Agent): Promise<Agent> {
    const copy = { ...agent };
    this.agents.set(agent.id, copy);
    return { ...copy };
  }

  async update(agent: Agent): Promise<Agent> {
    const copy = { ...agent };
    this.agents.set(agent.id, copy);
    return { ...copy };
  }

  async clear(): Promise<void> {
    this.agents.clear();
  }
}

/**
 * File-backed Local Agent Repository (survives restarts when Supabase credentials are not set)
 */
export class LocalAgentRepository implements AgentRepository {
  private filePath: string;
  private agents: Map<string, Agent> = new Map();

  constructor() {
    const dataDir = getLocalDataDir();
    this.filePath = path.join(dataDir, 'sentinel-agents.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: Agent[] = JSON.parse(raw);
        this.agents = new Map(list.map((a) => [a.id, a]));
      }
    } catch {
      this.agents = new Map();
    }
  }

  private saveToDisk(): void {
    try {
      const list = Array.from(this.agents.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[LocalAgentRepository] Failed to write to disk:', (err as Error).message);
    }
  }

  async findById(id: string): Promise<Agent | null> {
    this.loadFromDisk();
    const agent = this.agents.get(id);
    return agent ? { ...agent } : null;
  }

  async findAll(): Promise<Agent[]> {
    this.loadFromDisk();
    return Array.from(this.agents.values()).map((agent) => ({ ...agent }));
  }

  async create(agent: Agent): Promise<Agent> {
    const copy = { ...agent };
    this.agents.set(agent.id, copy);
    this.saveToDisk();
    return { ...copy };
  }

  async update(agent: Agent): Promise<Agent> {
    const copy = { ...agent };
    this.agents.set(agent.id, copy);
    this.saveToDisk();
    return { ...copy };
  }

  async clear(): Promise<void> {
    this.agents.clear();
    this.saveToDisk();
  }
}

/**
 * Supabase PostgreSQL Agent Repository
 */
export class SupabaseAgentRepository implements AgentRepository {
  async findById(id: string): Promise<Agent | null> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await client
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      handleDatabaseError(error, 'agents.findById');
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      status: data.status,
      scopes: data.scopes || [],
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async findAll(): Promise<Agent[]> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await client
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      handleDatabaseError(error, 'agents.findAll');
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      scopes: row.scopes || [],
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async create(agent: Agent): Promise<Agent> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const row = {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      scopes: agent.scopes,
      metadata: agent.metadata || {},
      created_at: agent.createdAt,
      updated_at: agent.updatedAt || agent.createdAt
    };

    const { data, error } = await client
      .from('agents')
      .insert(row)
      .select()
      .single();

    if (error) {
      handleDatabaseError(error, 'agents.create');
    }

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      status: data.status,
      scopes: data.scopes || [],
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async update(agent: Agent): Promise<Agent> {
    const client = supabaseClient.getClient();
    if (!client) {
      throw new Error('Supabase client unavailable');
    }

    const row = {
      name: agent.name,
      type: agent.type,
      status: agent.status,
      scopes: agent.scopes,
      metadata: agent.metadata || {},
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from('agents')
      .update(row)
      .eq('id', agent.id)
      .select()
      .single();

    if (error) {
      handleDatabaseError(error, 'agents.update');
    }

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      status: data.status,
      scopes: data.scopes || [],
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
}

export function createAgentRepository(driver: StorageDriver = config.storageDriver): AgentRepository {
  switch (driver) {
    case 'supabase':
      return new SupabaseAgentRepository();
    case 'local':
      return new LocalAgentRepository();
    case 'memory':
    default:
      return new InMemoryAgentRepository();
  }
}

export const agentRepository = createAgentRepository();
