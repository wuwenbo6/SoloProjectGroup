'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions {
  interval?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  onData: (data: T) => void,
  options: UsePollingOptions = {}
) {
  const { interval = 5000, enabled = true, onError } = options;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  const poll = useCallback(async () => {
    if (!isActiveRef.current) {
      return;
    }

    try {
      const data = await fetchFn();
      onData(data);
    } catch (error) {
      onError?.(error as Error);
    }

    if (isActiveRef.current) {
      timerRef.current = setTimeout(poll, interval);
    }
  }, [fetchFn, onData, interval, onError]);

  const start = useCallback(() => {
    if (isActiveRef.current) {
      return;
    }
    isActiveRef.current = true;
    poll();
  }, [poll]);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }

    return () => {
      stop();
    };
  }, [enabled, start, stop]);

  return { start, stop };
}

export default usePolling;
