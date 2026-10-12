import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

export class SupabaseDatabaseClient {
  private static instance: SupabaseDatabaseClient | null = null;
  private client: SupabaseClient | null = null;
  private isConnected = false;

  private constructor() {
    this.initClient();
  }

  public static getInstance(): SupabaseDatabaseClient {
    if (!SupabaseDatabaseClient.instance) {
      SupabaseDatabaseClient.instance = new SupabaseDatabaseClient();
    }
    return SupabaseDatabaseClient.instance;
  }

  private initClient(): void {
    if (config.supabase.isConfigured && config.supabase.url && config.supabase.serviceRoleKey) {
      try {
        this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
      } catch (err) {
        console.error('[SupabaseClient] Initialization error:', (err as Error).message);
        this.client = null;
      }
    }
  }

  public getClient(): SupabaseClient | null {
    if (!this.client && config.supabase.isConfigured) {
      this.initClient();
    }
    return this.client;
  }

  public async checkHealth(): Promise<{ connected: boolean; message: string; latencyMs?: number }> {
    if (!this.client) {
      return {
        connected: false,
        message: config.supabase.url ? 'Supabase client not initialized' : 'Supabase credentials not configured'
      };
    }

    const start = Date.now();
    try {
      // Ping database by querying 1 row from agents or public schema
      const { error } = await this.client
        .from('agents')
        .select('id')
        .limit(1);

      const latencyMs = Date.now() - start;

      if (error) {
        this.isConnected = false;
        return {
          connected: false,
          message: `Database query error: ${error.message} (Code: ${error.code})`,
          latencyMs
        };
      }

      this.isConnected = true;
      return {
        connected: true,
        message: 'Supabase PostgreSQL connection operational',
        latencyMs
      };
    } catch (err: unknown) {
      this.isConnected = false;
      return {
        connected: false,
        message: (err as Error).message || 'Connection failure to Supabase endpoint',
        latencyMs: Date.now() - start
      };
    }
  }

  public getStatus() {
    return {
      isConfigured: config.supabase.isConfigured,
      isConnected: this.isConnected,
      url: config.supabase.url ? config.supabase.url.replace(/^https:\/\/(.*)@/, 'https://***@') : undefined
    };
  }
}

export const supabaseClient = SupabaseDatabaseClient.getInstance();
