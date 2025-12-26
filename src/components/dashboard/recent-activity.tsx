"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  StopCircle,
  XCircle,
  Zap,
} from "lucide-react";
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
    icon: React.ReactNode;
    color: string;
  }
> = {
  agent_started: {
    icon: <PlayCircle className="h-4 w-4" />,
    color: "text-blue-500",
  },
  agent_stopped: {
    icon: <StopCircle className="h-4 w-4" />,
    color: "text-neutral-500",
  },
  task_completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-emerald-500",
  },
  task_failed: {
    icon: <XCircle className="h-4 w-4" />,
    color: "text-red-500",
  },
  exception_created: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-amber-500",
  },
};

// ============================================================================
// Relative Time Helper
// ============================================================================

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================================
// Activity Item Component
// ============================================================================

function ActivityItem({ activity }: { activity: RecentActivity }) {
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
    <div className="flex items-start gap-3 py-2.5">
      <span className={config.color}>{config.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-neutral-300">{activity.description}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
          <Clock className="h-3 w-3" />
          {getRelativeTime(activity.timestamp)}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:bg-neutral-900 -mx-3 px-3 rounded">
        {content}
      </Link>
    );
  }

  return content;
}

// ============================================================================
// Recent Activity Component
// ============================================================================

export function RecentActivityList({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-black p-5">
        <h3 className="text-sm font-medium text-white">Recent Activity</h3>
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <Zap className="h-8 w-8 text-neutral-700" />
          <p className="mt-3 text-sm text-neutral-500">No recent activity</p>
          <p className="mt-1 text-xs text-neutral-600">
            Activity will appear here as agents work
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-black p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Recent Activity</h3>
        <span className="text-xs text-neutral-500">{activities.length} events</span>
      </div>

      <div className="max-h-[400px] space-y-0 overflow-y-auto">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}
