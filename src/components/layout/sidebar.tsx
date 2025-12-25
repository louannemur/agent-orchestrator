"use client";

import {
  AlertTriangle,
  Bot,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ListTodo,
  Plug,
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
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    href: "/agents",
    label: "Agents",
    icon: <Bot className="h-5 w-5" />,
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: <ListTodo className="h-5 w-5" />,
  },
  {
    href: "/exceptions",
    label: "Exceptions",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    href: "/connect",
    label: "Connect Runner",
    icon: <Plug className="h-5 w-5" />,
  },
];

// ============================================================================
// Sidebar Component
// ============================================================================

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-zinc-800 px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Bot className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-zinc-100">
              Agent Orchestrator
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600/10 text-blue-500"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <span className={isActive ? "text-blue-500" : "text-zinc-500"}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-zinc-800 p-2">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
