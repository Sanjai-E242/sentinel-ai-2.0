/**
 * Health check response structure
 * Standardized across backend and consumers
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version?: string;
  timestamp?: string;
  uptime?: number;
}
