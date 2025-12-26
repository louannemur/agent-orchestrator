"use client";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ListTodo,
  Plug,
  Zap,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ============================================================================
// Navigation Items
// ============================================================================

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Overview",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    href: "/agents",
    label: "Agents",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    href: "/tasks",
    label: "Queue",
    icon: <ListTodo className="h-4 w-4" />,
  },
  {
    href: "/exceptions",
    label: "Exceptions",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  {
    href: "/connect",
    label: "Integrations",
    icon: <Plug className="h-4 w-4" />,
  },
];

// ============================================================================
// Sidebar Component
// ============================================================================

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-neutral-800 bg-neutral-950 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-white">
          <Zap className="h-3.5 w-3.5 text-black" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-white">
            ORCHESTRATOR
          </span>
        )}
      </div>

      {/* Section Label */}
      {!collapsed && (
        <div className="px-4 pb-2 pt-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Platform
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-neutral-800/80 text-white"
                    : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white"
                } ${collapsed ? "justify-center px-2" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      {!collapsed && (
        <div className="border-t border-neutral-800 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-xs font-medium text-neutral-400">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">Admin</p>
              <p className="truncate text-xs text-neutral-500">workspace</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="border-t border-neutral-800 p-2">
        <button
          onClick={onToggle}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-800/50 hover:text-white ${
            collapsed ? "justify-center px-2" : ""
          }`}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
