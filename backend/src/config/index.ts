import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

export type StorageDriver = 'supabase' | 'local' | 'memory';

export interface AppConfig {
  env: string;
  port: number;
  corsOrigin: string | string[];
  apiPrefix: string;
  isProduction: boolean;
  supabase: {
    url?: string;
    serviceRoleKey?: string;
    isConfigured: boolean;
  };
  storageDriver: StorageDriver;
  spam: {
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    burstWindowMs: number;
    burstMaxRequests: number;
    duplicateWindowMs: number;
  };
}

const env = process.env.NODE_ENV || 'development';
const port = parseInt(process.env.PORT || '4000', 10);
const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const corsOrigin = rawCorsOrigin.includes(',')
  ? rawCorsOrigin.split(',').map((o) => o.trim())
  : rawCorsOrigin;

const supabaseUrl = process.env.SUPABASE_URL;
const rawSupabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabaseServiceRoleKey = rawSupabaseKey?.startsWith('=') ? rawSupabaseKey.slice(1).trim() : rawSupabaseKey?.trim();

// Check if credentials are valid non-placeholder values
const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseServiceRoleKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseServiceRoleKey.includes('your_supabase')
);

// Determine driver: 'memory' in test mode, or explicit setting, or auto-detect based on config
let storageDriver: StorageDriver = 'local';
if (env === 'test') {
  storageDriver = 'memory';
} else if (process.env.STORAGE_DRIVER === 'supabase' || process.env.STORAGE_DRIVER === 'local' || process.env.STORAGE_DRIVER === 'memory') {
  storageDriver = process.env.STORAGE_DRIVER;
} else if (isSupabaseConfigured) {
  storageDriver = 'supabase';
}

export const config: AppConfig = {
  env,
  port,
  corsOrigin,
  apiPrefix: '/api',
  isProduction: env === 'production',
  supabase: {
    url: supabaseUrl,
    serviceRoleKey: supabaseServiceRoleKey,
    isConfigured: isSupabaseConfigured
  },
  storageDriver,
  spam: {
    rateLimitWindowMs: Number(process.env.SPAM_RATE_LIMIT_WINDOW_MS) || 60000,
    rateLimitMaxRequests: Number(process.env.SPAM_RATE_LIMIT_MAX_REQUESTS) || 100,
    burstWindowMs: Number(process.env.SPAM_BURST_WINDOW_MS) || 5000,
    burstMaxRequests: Number(process.env.SPAM_BURST_MAX_REQUESTS) || 15,
    duplicateWindowMs: Number(process.env.SPAM_DUPLICATE_WINDOW_MS) || 30000
  }
};
