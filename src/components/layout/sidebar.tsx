"use client";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ListTodo,
  Plug,
  Sparkles,
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
    label: "Dashboard",
    icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
  },
  {
    href: "/agents",
    label: "Agents",
    icon: <Sparkles className="h-[18px] w-[18px]" />,
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: <ListTodo className="h-[18px] w-[18px]" />,
  },
  {
    href: "/exceptions",
    label: "Exceptions",
    icon: <AlertTriangle className="h-[18px] w-[18px]" />,
  },
  {
    href: "/connect",
    label: "Connect",
    icon: <Plug className="h-[18px] w-[18px]" />,
  },
];

// ============================================================================
// Sidebar Component
// ============================================================================

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-surface-950 transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 shadow-glow">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Orchestrator
            </span>
          )}
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-white/[0.04]" />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent-500" />
              )}

              <span
                className={
                  isActive ? "text-accent-400" : "text-zinc-500 group-hover:text-zinc-400"
                }
              >
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-zinc-500 transition-all duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
          title={collapsed ? "Expand" : "Collapse"}
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
