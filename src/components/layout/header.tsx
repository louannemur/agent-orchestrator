"use client";

import { ListTodo, Menu, Settings, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConnectionStatus } from "@/components/ui/connection-status";

// ============================================================================
// Types
// ============================================================================

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

interface QuickStats {
  activeAgents: number;
  queuedTasks: number;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL = 10000;

// ============================================================================
// Header Component
// ============================================================================

export function Header({ title, onMenuClick, showMenuButton }: HeaderProps) {
  const [stats, setStats] = useState<QuickStats>({ activeAgents: 0, queuedTasks: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setIsPolling(true);

      const response = await fetch("/api/dashboard/stats");

      if (!mountedRef.current) return;

      if (response.ok) {
        const { data } = await response.json();
        setStats({
          activeAgents: data.agents?.working ?? 0,
          queuedTasks: data.tasks?.queued ?? 0,
        });
        setLastUpdated(new Date());
      }
    } catch {
      // Silently fail
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsPolling(false);
      }
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";
      if (isVisibleRef.current) {
        fetchStats();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchStats]);

  useEffect(() => {
    mountedRef.current = true;
    fetchStats();

    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        fetchStats();
      }
    }, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchStats]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-800 bg-black px-6">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-white lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-sm font-medium text-white">{title}</h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-6">
        {/* Quick Stats */}
        {!isLoading && (
          <div className="hidden items-center gap-6 text-sm sm:flex">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-neutral-500" />
              <span className="text-neutral-500">Active</span>
              <span className="font-medium text-white">{stats.activeAgents}</span>
            </div>
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-neutral-500" />
              <span className="text-neutral-500">Queued</span>
              <span className="font-medium text-white">{stats.queuedTasks}</span>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <ConnectionStatus lastUpdated={lastUpdated} isPolling={isPolling} />

        {/* Settings Button */}
        <button
          className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-white"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
