"use client";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ListTodo,
  Plug,
  Zap,
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
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    href: "/agents",
    label: "Agents",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: <ListTodo className="h-4 w-4" />,
  },
  {
    href: "/exceptions",
    label: "Exceptions",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  {
    href: "/connect",
    label: "Connect",
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
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-neutral-800 bg-black transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-neutral-800 px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white">
            <Zap className="h-4 w-4 text-black" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-white">
              Orchestrator
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <div className="space-y-1">
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
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
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

      {/* Collapse Toggle */}
      <div className="border-t border-neutral-800 p-2">
        <button
          onClick={onToggle}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-white ${
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
