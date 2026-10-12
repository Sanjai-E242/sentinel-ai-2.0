import { apiClient } from './client';
import { PersistenceStatus } from '@sentinel/shared';

export const persistenceApi = {
  async getStatus(): Promise<PersistenceStatus> {
    return apiClient.get<PersistenceStatus>('/v1/system/persistence');
  }
};
