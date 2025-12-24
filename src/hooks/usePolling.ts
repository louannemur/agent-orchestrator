"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>;
  interval: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UsePollingResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isPolling: boolean;
  refetch: () => Promise<void>;
}

// ============================================================================
// Polling Context for Global State
// ============================================================================

let globalLastUpdated: Date | null = null;
let globalIsPolling = false;
const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function getPollingState() {
  return {
    lastUpdated: globalLastUpdated,
    isPolling: globalIsPolling,
  };
}

export function subscribeToPollingState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateGlobalState(lastUpdated: Date | null, isPolling: boolean) {
  globalLastUpdated = lastUpdated;
  globalIsPolling = isPolling;
  notifyListeners();
}

// ============================================================================
// Hook
// ============================================================================

export function usePolling<T>({
  fetcher,
  interval,
  enabled = true,
  onSuccess,
  onError,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setIsPolling(true);
      updateGlobalState(globalLastUpdated, true);

      const result = await fetcher();

      if (!mountedRef.current) return;

      setData(result);
      setError(null);
      const now = new Date();
      setLastUpdated(now);
      updateGlobalState(now, false);
      onSuccess?.(result);
    } catch (err) {
      if (!mountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      updateGlobalState(globalLastUpdated, false);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsPolling(false);
      }
      isFetchingRef.current = false;
    }
  }, [fetcher, onSuccess, onError]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      // If becoming visible and enabled, fetch immediately
      if (isVisibleRef.current && enabled) {
        fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, fetchData]);

  // Setup polling
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    if (enabled) {
      fetchData();
    }

    // Setup interval
    if (enabled && interval > 0) {
      intervalRef.current = setInterval(() => {
        // Only poll when tab is visible
        if (isVisibleRef.current) {
          fetchData();
        }
      }, interval);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    isPolling,
    refetch,
  };
}

// ============================================================================
// Hook for subscribing to global polling state
// ============================================================================

export function usePollingStatus() {
  const [state, setState] = useState(getPollingState);

  useEffect(() => {
    return subscribeToPollingState(() => {
      setState(getPollingState());
    });
  }, []);

  return state;
}
