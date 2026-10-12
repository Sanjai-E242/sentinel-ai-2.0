import { apiClient } from './client';
import { AuditLogEntry } from '@sentinel/shared';

export interface AuditFilterParams {
  sessionId?: string;
  eventType?: string;
  entityId?: string;
  limit?: number;
}

export const auditApi = {
  async fetchLogs(filter?: AuditFilterParams): Promise<AuditLogEntry[]> {
    const params = new URLSearchParams();
    if (filter?.sessionId) params.append('sessionId', filter.sessionId);
    if (filter?.eventType) params.append('eventType', filter.eventType);
    if (filter?.entityId) params.append('entityId', filter.entityId);
    if (filter?.limit) params.append('limit', filter.limit.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/v1/audit?${queryString}` : '/v1/audit';

    const response = await apiClient.get<{ logs: AuditLogEntry[] }>(endpoint);
    return response.logs || [];
  }
};
