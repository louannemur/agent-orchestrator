"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { AgentGrid, SpawnAgentDialog } from "@/components/agents";
import { MainLayout } from "@/components/layout";
import {
  useAgentActions,
  useAgents,
  useNotifications,
  useSpawnAgent,
  type AgentStatusType,
  type SortOption,
} from "@/hooks";

// ============================================================================
// Agents Page
// ============================================================================

export default function AgentsPage() {
  // Filter and sort state
  const [statusFilter, setStatusFilter] = useState<AgentStatusType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // Dialog state
  const [isSpawnDialogOpen, setIsSpawnDialogOpen] = useState(false);

  // Hooks
  const {
    agents,
    filteredAgents,
    isLoading,
    error,
    refetch,
    pagination,
  } = useAgents({
    statusFilter,
    searchQuery,
    sortBy,
  });

  const { spawn, isSpawning } = useSpawnAgent();
  const { stopAgent, pauseAgent, resumeAgent, isActing } = useAgentActions();

  // Enable notifications for agent changes
  useNotifications({ agents });

  // Handlers
  const handleSpawn = async (taskId: string, workingDir: string) => {
    const success = await spawn(taskId, workingDir);
    if (success) {
      refetch();
    }
    return success;
  };

  const handlePause = async (agentId: string) => {
    await pauseAgent(agentId);
    refetch();
  };

  const handleResume = async (agentId: string) => {
    await resumeAgent(agentId);
    refetch();
  };

  const handleStop = async (agentId: string) => {
    await stopAgent(agentId);
    refetch();
  };

  return (
    <MainLayout title="Agents">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-zinc-100">
              Agent Management
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Monitor and control AI agents working on tasks
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Spawn Agent Button */}
            <button
              onClick={() => setIsSpawnDialogOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Spawn Agent
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Agent Grid */}
        <AgentGrid
          agents={filteredAgents}
          isLoading={isLoading}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
          sortBy={sortBy}
          onStatusFilterChange={setStatusFilter}
          onSearchChange={setSearchQuery}
          onSortChange={setSortBy}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          isActing={isActing}
          pagination={pagination}
          totalCount={agents.length}
        />
      </div>

      {/* Spawn Agent Dialog */}
      <SpawnAgentDialog
        isOpen={isSpawnDialogOpen}
        onClose={() => setIsSpawnDialogOpen(false)}
        onSpawn={handleSpawn}
        isSpawning={isSpawning}
      />
    </MainLayout>
  );
}
