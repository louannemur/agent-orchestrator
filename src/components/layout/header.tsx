"use client";

import { ListTodo, Menu, Settings, Sparkles } from "lucide-react";
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

const POLL_INTERVAL = 10000; // 10 seconds

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
    // Prevent concurrent fetches
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
      // Silently fail - connection status will show stale
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsPolling(false);
      }
      isFetchingRef.current = false;
    }
  }, []);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      // If becoming visible, fetch immediately
      if (isVisibleRef.current) {
        fetchStats();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchStats]);

  // Setup polling
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    fetchStats();

    // Setup interval
    intervalRef.current = setInterval(() => {
      // Only poll when tab is visible
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-surface-950/80 px-6 backdrop-blur-xl">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="rounded-lg p-2 text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-300 lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-medium text-white">{title}</h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Quick Stats */}
        {!isLoading && (
          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[13px]">
              <Sparkles className="h-3.5 w-3.5 text-accent-400" />
              <span className="text-zinc-500">Active</span>
              <span className="font-medium text-white">
                {stats.activeAgents}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[13px]">
              <ListTodo className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-zinc-500">Queued</span>
              <span className="font-medium text-white">
                {stats.queuedTasks}
              </span>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <ConnectionStatus lastUpdated={lastUpdated} isPolling={isPolling} />

        {/* Settings Button */}
        <button
          className="rounded-lg p-2 text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-300"
          title="Settings"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>
      </div>
    </header>
  );
}
