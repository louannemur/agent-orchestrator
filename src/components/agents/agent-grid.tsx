"use client";

import {
  ArrowDownAZ,
  Bot,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";

import type { AgentData, AgentStatusType, SortOption } from "@/hooks/useAgents";

import { AgentCard } from "./agent-card";

// ============================================================================
// Types
// ============================================================================

interface AgentGridProps {
  agents: AgentData[];
  isLoading: boolean;
  statusFilter: AgentStatusType | "all";
  searchQuery: string;
  sortBy: SortOption;
  onStatusFilterChange: (status: AgentStatusType | "all") => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
  onPause?: (agentId: string) => void;
  onResume?: (agentId: string) => void;
  onStop?: (agentId: string) => void;
  isActing?: boolean;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    setPage: (page: number) => void;
  };
  totalCount: number;
}

// ============================================================================
// Status Options
// ============================================================================

const statusOptions: { value: AgentStatusType | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "WORKING", label: "Working" },
  { value: "IDLE", label: "Idle" },
  { value: "PAUSED", label: "Paused" },
  { value: "FAILED", label: "Failed" },
  { value: "STUCK", label: "Stuck" },
];

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: "newest", label: "Newest First", icon: <Clock className="h-4 w-4" /> },
  { value: "oldest", label: "Oldest First", icon: <Clock className="h-4 w-4 rotate-180" /> },
  { value: "status", label: "By Status", icon: <Filter className="h-4 w-4" /> },
  { value: "name", label: "By Name", icon: <ArrowDownAZ className="h-4 w-4" /> },
];

// ============================================================================
// Filter Bar Component
// ============================================================================

function FilterBar({
  statusFilter,
  searchQuery,
  sortBy,
  onStatusFilterChange,
  onSearchChange,
  onSortChange,
}: {
  statusFilter: AgentStatusType | "all";
  searchQuery: string;
  sortBy: SortOption;
  onStatusFilterChange: (status: AgentStatusType | "all") => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
}) {
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Search and Filter */}
      <div className="flex flex-1 items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-8 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(e.target.value as AgentStatusType | "all")
          }
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Sort */}
      <div className="relative">
        <button
          onClick={() => setShowSortDropdown(!showSortDropdown)}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
        >
          {sortOptions.find((o) => o.value === sortBy)?.icon}
          <span className="hidden sm:inline">
            {sortOptions.find((o) => o.value === sortBy)?.label}
          </span>
        </button>

        {showSortDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowSortDropdown(false)}
            />
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-lg">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setShowSortDropdown(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    sortBy === option.value
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Pagination Component
// ============================================================================

function Pagination({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button
        onClick={() => setPage(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }

          return (
            <button
              key={pageNum}
              onClick={() => setPage(pageNum)}
              className={`h-8 w-8 rounded-lg text-sm font-medium ${
                page === pageNum
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setPage(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 text-center">
      <Bot className="h-12 w-12 text-zinc-700" />
      <h3 className="mt-4 text-lg font-medium text-zinc-300">
        {hasFilters ? "No agents match filters" : "No agents yet"}
      </h3>
      <p className="mt-2 text-sm text-zinc-500">
        {hasFilters
          ? "Try adjusting your search or filters"
          : "Spawn an agent to get started"}
      </p>
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="mt-4 text-sm text-blue-500 hover:text-blue-400"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Loading State Component
// ============================================================================

function LoadingState() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
        >
          <div className="mb-3 h-5 w-16 rounded-full bg-zinc-800" />
          <div className="mb-2 h-4 w-3/4 rounded bg-zinc-800" />
          <div className="mb-4 h-3 w-1/2 rounded bg-zinc-800" />
          <div className="flex justify-between">
            <div className="h-3 w-16 rounded bg-zinc-800" />
            <div className="h-3 w-12 rounded bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Agent Grid Component
// ============================================================================

export function AgentGrid({
  agents,
  isLoading,
  statusFilter,
  searchQuery,
  sortBy,
  onStatusFilterChange,
  onSearchChange,
  onSortChange,
  onPause,
  onResume,
  onStop,
  isActing,
  pagination,
  totalCount,
}: AgentGridProps) {
  const hasFilters = statusFilter !== "all" || searchQuery.trim() !== "";

  const handleClearFilters = () => {
    onStatusFilterChange("all");
    onSearchChange("");
  };

  return (
    <div>
      {/* Filter Bar */}
      <FilterBar
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        sortBy={sortBy}
        onStatusFilterChange={onStatusFilterChange}
        onSearchChange={onSearchChange}
        onSortChange={onSortChange}
      />

      {/* Results Count */}
      {!isLoading && agents.length > 0 && (
        <p className="mb-4 text-sm text-zinc-500">
          Showing {agents.length} of {totalCount} agents
        </p>
      )}

      {/* Loading State */}
      {isLoading && <LoadingState />}

      {/* Empty State */}
      {!isLoading && agents.length === 0 && (
        <EmptyState hasFilters={hasFilters} onClearFilters={handleClearFilters} />
      )}

      {/* Agent Grid */}
      {!isLoading && agents.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
              isActing={isActing}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        setPage={pagination.setPage}
      />
    </div>
  );
}
