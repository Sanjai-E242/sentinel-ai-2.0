import { healthApi } from '../api/health.api';
import { HealthResponse } from '@sentinel/shared';

export interface HealthState {
  isOnline: boolean;
  statusText: string;
  data: HealthResponse | null;
  error: string | null;
  latencyMs?: number;
}

export class HealthService {
  public static async getStatus(): Promise<HealthState> {
    const start = performance.now();
    try {
      const data = await healthApi.checkHealth();
      const latencyMs = Math.round(performance.now() - start);
      return {
        isOnline: data.status === 'ok',
        statusText: data.status === 'ok' ? 'System Operational' : 'Degraded',
        data,
        error: null,
        latencyMs
      };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        isOnline: false,
        statusText: 'Disconnected',
        data: null,
        error: (err as Error)?.message || 'Failed to connect to Sentinel API runtime',
        latencyMs
      };
    }
  }
}
