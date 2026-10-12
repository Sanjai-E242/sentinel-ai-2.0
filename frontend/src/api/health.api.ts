import { apiClient } from './client';
import { HealthResponse } from '@sentinel/shared';

export const healthApi = {
  /**
   * Fetches health status from backend GET /api/health
   */
  async checkHealth(): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>('/health');
  }
};
