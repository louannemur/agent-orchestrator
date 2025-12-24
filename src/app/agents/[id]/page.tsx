"use client";

import { Activity, AlertCircle, Bot } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AgentHeader, AgentLogs, AgentStats } from "@/components/agents";
import { MainLayout } from "@/components/layout";
import {
  useAgent,
  useAgentActions,
  useAgentLogs,
  type LogType,
} from "@/hooks";

// ============================================================================
// Agent Detail Page
// ============================================================================

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  // State
  const [logTypeFilter, setLogTypeFilter] = useState<LogType | "all">("all");
  const [logSearchQuery, setLogSearchQuery] = useState("");

  // Hooks
  const { agent, isLoading, error, refetch } = useAgent(agentId);
  const { stopAgent, pauseAgent, resumeAgent, isActing } = useAgentActions();

  const {
    logs,
    isLoading: logsLoading,
    hasMore,
    loadMore,
  } = useAgentLogs({
    agentId,
    isWorking: agent?.status === "WORKING",
    typeFilter: logTypeFilter,
    searchQuery: logSearchQuery,
  });

  // Handlers
  const handlePause = async () => {
    await pauseAgent(agentId);
    refetch();
  };

  const handleResume = async () => {
    await resumeAgent(agentId);
    refetch();
  };

  const handleStop = async () => {
    await stopAgent(agentId);
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <MainLayout title="Agent Details">
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-zinc-400">
            <Activity className="h-5 w-5 animate-pulse" />
            <span>Loading agent...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (error || !agent) {
    return (
      <MainLayout title="Agent Details">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold text-zinc-100">
            {error === "Agent not found" ? "Agent Not Found" : "Error Loading Agent"}
          </h2>
          <p className="mt-2 text-zinc-400">
            {error || "The agent you're looking for doesn't exist."}
          </p>
          <a
            href="/agents"
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Agents
          </a>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={agent.name}>
      <div className="space-y-6">
        {/* Header */}
        <AgentHeader
          agent={agent}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          isActing={isActing}
        />

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Log Viewer (2/3) */}
          <div className="relative lg:col-span-2">
            <AgentLogs
              logs={logs}
              isLoading={logsLoading}
              hasMore={hasMore}
              onLoadMore={loadMore}
              typeFilter={logTypeFilter}
              searchQuery={logSearchQuery}
              onTypeFilterChange={setLogTypeFilter}
              onSearchChange={setLogSearchQuery}
            />
          </div>

          {/* Right: Stats Panel (1/3) */}
          <div className="lg:col-span-1">
            <AgentStats agent={agent} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
