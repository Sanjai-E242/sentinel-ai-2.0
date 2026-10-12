export interface HealthPayload {
  status: 'ok';
  service: 'sentinel-api';
  version?: string;
  uptime?: number;
  timestamp?: string;
}

export class HealthService {
  public static getHealth(): { status: 'ok'; service: 'sentinel-api' } {
    return {
      status: 'ok',
      service: 'sentinel-api'
    };
  }

  public static getDetailedHealth() {
    return {
      status: 'ok' as const,
      service: 'sentinel-api' as const,
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}
