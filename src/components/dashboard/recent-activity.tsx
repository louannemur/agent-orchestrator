"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  Sparkles,
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
    icon: <PlayCircle className="h-3.5 w-3.5" />,
    color: "text-accent-400",
    bgColor: "bg-accent-500/10 border border-accent-500/20",
  },
  agent_stopped: {
    icon: <StopCircle className="h-3.5 w-3.5" />,
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10 border border-zinc-500/20",
  },
  task_completed: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border border-emerald-500/20",
  },
  task_failed: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10 border border-red-500/20",
  },
  exception_created: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border border-amber-500/20",
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
    <div className="group/item flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 hover:bg-white/[0.04]">
      <div className={`mt-0.5 rounded-lg p-1.5 ${config.bgColor}`}>
        <span className={config.color}>{config.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-zinc-300 transition-colors group-hover/item:text-white">
          {activity.description}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500">
          <Clock className="h-2.5 w-2.5" />
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
      <div className="group relative overflow-hidden rounded-2xl bg-white/[0.02] p-6 transition-all duration-300 hover:bg-white/[0.04]">
        <div className="absolute inset-0 rounded-2xl border border-white/[0.06] transition-colors duration-300 group-hover:border-white/[0.1]" />

        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Recent Activity
            </h3>
          </div>

          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-xl bg-white/[0.04] p-3">
              <Sparkles className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="mt-4 text-[13px] text-zinc-500">No recent activity</p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Activity will appear here as agents work on tasks
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/[0.02] p-6 transition-all duration-300 hover:bg-white/[0.04]">
      <div className="absolute inset-0 rounded-2xl border border-white/[0.06] transition-colors duration-300 group-hover:border-white/[0.1]" />

      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Recent Activity
          </h3>
          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-500">
            {activities.length} events
          </span>
        </div>

        <div className="-mx-3 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="space-y-0.5">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
