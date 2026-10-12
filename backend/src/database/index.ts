/**
 * Sentinel 2.0 Database Layer Foundation
 *
 * NOTE: Supabase PostgreSQL integration is slated for a dedicated future phase.
 * This stub defines the architectural interface and configuration boundary.
 */

export interface DatabaseConnectionConfig {
  url?: string;
  serviceKey?: string;
}

export class DatabaseClient {
  private static instance: DatabaseClient | null = null;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  public async initialize(_config?: DatabaseConnectionConfig): Promise<void> {
    // Database connection initialization reserved for Phase 2 (Supabase integration)
    this.isConnected = false;
  }

  public getStatus(): { connected: boolean; provider: string } {
    return {
      connected: this.isConnected,
      provider: 'supabase-postgresql (pending initialization)'
    };
  }
}

export const dbClient = DatabaseClient.getInstance();
