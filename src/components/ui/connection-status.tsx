"use client";

import { AlertTriangle, CheckCircle, Radio } from "lucide-react";
import { useEffect, useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface ConnectionStatusProps {
  lastUpdated: Date | null;
  isPolling?: boolean;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ============================================================================
// Connection Status Component
// ============================================================================

export function ConnectionStatus({
  lastUpdated,
  isPolling = false,
  className = "",
}: ConnectionStatusProps) {
  const [now, setNow] = useState(new Date());

  // Update "now" every second to keep relative time accurate
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate staleness
  const isStale = lastUpdated
    ? now.getTime() - lastUpdated.getTime() > 30000 // 30 seconds
    : true;

  const isFresh = lastUpdated
    ? now.getTime() - lastUpdated.getTime() < 5000 // 5 seconds
    : false;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
        isStale
          ? "bg-amber-500/10 text-amber-400"
          : isFresh
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-zinc-800 text-zinc-400"
      } ${className}`}
    >
      {/* Status Icon */}
      {isPolling ? (
        <Radio className="h-3.5 w-3.5 animate-pulse" />
      ) : isStale ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : (
        <CheckCircle className="h-3.5 w-3.5" />
      )}

      {/* Status Text */}
      <span>
        {isPolling
          ? "Syncing..."
          : lastUpdated
            ? formatRelativeTime(lastUpdated)
            : "Not connected"}
      </span>

      {/* Pulse indicator when polling */}
      {isPolling && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Compact Connection Status (for header)
// ============================================================================

export function ConnectionStatusCompact({
  lastUpdated,
  isPolling = false,
  className = "",
}: ConnectionStatusProps) {
  const [now, setNow] = useState(new Date());

  // Update "now" every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate staleness
  const isStale = lastUpdated
    ? now.getTime() - lastUpdated.getTime() > 30000
    : true;

  return (
    <div
      className={`group relative flex items-center ${className}`}
      title={
        lastUpdated
          ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
          : "Not connected"
      }
    >
      {/* Indicator dot */}
      <span className="relative flex h-2.5 w-2.5">
        {isPolling && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              isStale ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            isStale ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
      </span>

      {/* Tooltip on hover */}
      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {isPolling
          ? "Syncing..."
          : lastUpdated
            ? `Updated ${formatRelativeTime(lastUpdated)}`
            : "Not connected"}
        {isStale && !isPolling && " (stale)"}
      </div>
    </div>
  );
}
