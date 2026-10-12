import { useState, useEffect, useCallback } from 'react';
import { HealthService, HealthState } from '../services/health.service';

export function useHealth(pollIntervalMs = 30000) {
  const [health, setHealth] = useState<HealthState>({
    isOnline: false,
    statusText: 'Checking...',
    data: null,
    error: null
  });
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    setIsLoading(true);
    const result = await HealthService.getStatus();
    setHealth(result);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, pollIntervalMs);
    return () => clearInterval(interval);
  }, [check, pollIntervalMs]);

  return { ...health, isLoading, refetch: check };
}
