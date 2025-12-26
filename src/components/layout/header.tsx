"use client";

import { Menu, RefreshCw } from "lucide-react";
import { useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

// ============================================================================
// Header Component
// ============================================================================

export function Header({ title, onMenuClick, showMenuButton }: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 500));
    setIsRefreshing(false);
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6">
      {/* Left side - Breadcrumb */}
      <div className="flex items-center gap-2">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="mr-2 rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <span className="text-sm text-neutral-500">Dashboard</span>
        <span className="text-sm text-neutral-600">/</span>
        <span className="text-sm font-medium text-white">{title}</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Live Indicator */}
        <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-neutral-300">LIVE</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
    </header>
  );
}
