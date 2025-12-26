"use client";

import { Terminal } from "lucide-react";
import Link from "next/link";

import type { RecentActivity } from "@/hooks/useDashboardStats";

// ============================================================================
// Types
// ============================================================================

interface RecentActivityProps {
  activities: RecentActivity[];
}

// ============================================================================
// Activity Config
// ============================================================================

const activityConfig: Record<
  RecentActivity["type"],
  {
    label: string;
    color: string;
  }
> = {
  agent_started: {
    label: "INFO",
    color: "text-blue-400",
  },
  agent_stopped: {
    label: "INFO",
    color: "text-neutral-400",
  },
  task_completed: {
    label: "SUCCESS",
    color: "text-emerald-400",
  },
  task_failed: {
    label: "ERROR",
    color: "text-red-400",
  },
  exception_created: {
    label: "WARNING",
    color: "text-amber-400",
  },
};

// ============================================================================
// Time Formatter
// ============================================================================

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ============================================================================
// Log Entry Component
// ============================================================================

function LogEntry({ activity }: { activity: RecentActivity }) {
  const config = activityConfig[activity.type];

  const getHref = () => {
    if (!activity.entityId || !activity.entityType) return null;

    switch (activity.entityType) {
      case "agent":
        return `/agents/${activity.entityId}`;
      case "task":
        return `/tasks/${activity.entityId}`;
      case "exception":
        return `/exceptions/${activity.entityId}`;
      default:
        return null;
    }
  };

  const href = getHref();

  const content = (
    <div className="flex items-start gap-4 py-2 font-mono text-xs">
      <span className="shrink-0 text-neutral-600">{formatTime(activity.timestamp)}</span>
      <span className={`shrink-0 font-medium ${config.color}`}>[{config.label}]</span>
      <span className="text-neutral-300">{activity.description}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:bg-neutral-800/50 -mx-4 px-4">
        {content}
      </Link>
    );
  }

  return content;
}

// ============================================================================
// System Logs Component
// ============================================================================

export function RecentActivityList({ activities }: RecentActivityProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
        <Terminal className="h-4 w-4 text-neutral-500" />
        <span className="text-sm font-medium text-white">System Logs</span>
      </div>

      {/* Logs */}
      <div className="max-h-[300px] overflow-y-auto px-4">
        {activities.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-neutral-500">No recent activity</p>
            <p className="mt-1 text-xs text-neutral-600">
              Logs will appear here as agents work
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/50">
            {activities.map((activity) => (
              <LogEntry key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>

      {/* Footer - Cursor */}
      <div className="border-t border-neutral-800 px-4 py-2">
        <span className="font-mono text-xs text-neutral-600">_</span>
      </div>
    </div>
  );
}
