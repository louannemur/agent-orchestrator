"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  PlayCircle,
  StopCircle,
  XCircle,
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
    bgColor: string;
  }
> = {
  agent_started: {
    icon: <PlayCircle className="h-4 w-4" />,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  agent_stopped: {
    icon: <StopCircle className="h-4 w-4" />,
    color: "text-zinc-500",
    bgColor: "bg-zinc-500/10",
  },
  task_completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  task_failed: {
    icon: <XCircle className="h-4 w-4" />,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  exception_created: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
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
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-800/50">
      <div className={`mt-0.5 rounded-md p-1.5 ${config.bgColor}`}>
        <span className={config.color}>{config.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-200">{activity.description}</p>
        <p className="flex items-center gap-1 text-xs text-zinc-500">
          <Clock className="h-3 w-3" />
          {getRelativeTime(activity.timestamp)}
        </p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================================================
// Recent Activity Component
// ============================================================================

export function RecentActivityList({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-100">Recent Activity</h3>
        </div>

        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bot className="h-10 w-10 text-zinc-700" />
          <p className="mt-3 text-sm text-zinc-500">No recent activity</p>
          <p className="mt-1 text-xs text-zinc-600">
            Activity will appear here as agents work on tasks
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-100">Recent Activity</h3>
        <span className="text-xs text-zinc-500">{activities.length} events</span>
      </div>

      <div className="-mx-3 max-h-[400px] overflow-y-auto">
        <div className="space-y-0.5">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      </div>
    </div>
  );
}
