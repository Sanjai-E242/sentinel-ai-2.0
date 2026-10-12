import { useState, useEffect, useCallback } from 'react';
import { PersistenceStatus } from '@sentinel/shared';
import { persistenceApi } from '../api/persistence.api';

export function usePersistence(pollIntervalMs = 30000) {
  const [persistence, setPersistence] = useState<PersistenceStatus>({
    provider: 'local-storage',
    connected: true,
    status: 'fallback',
    details: 'Detecting storage driver...'
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await persistenceApi.getStatus();
      setPersistence(data);
    } catch {
      setPersistence({
        provider: 'local-storage',
        connected: false,
        status: 'unavailable',
        details: 'Persistence service unavailable'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchStatus, pollIntervalMs]);

  return { ...persistence, isLoading, refetch: fetchStatus };
}
