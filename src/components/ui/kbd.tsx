"use client";

import { memo, ReactNode, useCallback, useEffect, useState } from "react";

// ============================================================================
// Keyboard Key Display Component
// ============================================================================

interface KbdProps {
  children: ReactNode;
  className?: string;
}

/**
 * Renders a styled keyboard key indicator.
 * Use for displaying keyboard shortcuts to users.
 */
export const Kbd = memo(function Kbd({ children, className = "" }: KbdProps) {
  return (
    <kbd
      className={`inline-flex min-w-[1.5rem] items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-400 ${className}`}
    >
      {children}
    </kbd>
  );
});

// ============================================================================
// Keyboard Shortcut Display
// ============================================================================

interface ShortcutProps {
  keys: string[];
  description?: string;
  className?: string;
}

/**
 * Displays a keyboard shortcut with multiple keys.
 * Keys are displayed with proper separators.
 */
export const Shortcut = memo(function Shortcut({
  keys,
  description,
  className = "",
}: ShortcutProps) {
  // Detect platform for meta key display
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  const formatKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      mod: isMac ? "⌘" : "Ctrl",
      meta: isMac ? "⌘" : "⊞",
      ctrl: "Ctrl",
      alt: isMac ? "⌥" : "Alt",
      shift: "⇧",
      enter: "↵",
      escape: "Esc",
      space: "Space",
      backspace: "⌫",
      delete: "Del",
      up: "↑",
      down: "↓",
      left: "←",
      right: "→",
    };

    return keyMap[key.toLowerCase()] || key.toUpperCase();
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {keys.map((key, index) => (
        <span key={index} className="inline-flex items-center">
          <Kbd>{formatKey(key)}</Kbd>
          {index < keys.length - 1 && (
            <span className="mx-0.5 text-zinc-600">+</span>
          )}
        </span>
      ))}
      {description && (
        <span className="ml-2 text-xs text-zinc-500">{description}</span>
      )}
    </span>
  );
});

// ============================================================================
// Keyboard Shortcut Hook
// ============================================================================

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  callback: () => void;
  enabled?: boolean;
}

/**
 * Hook to register keyboard shortcuts.
 * Automatically handles modifier keys and cleans up listeners.
 */
export function useKeyboardShortcut(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const keyMatch =
          event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : true;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const metaMatch = shortcut.meta ? event.metaKey : true;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
          event.preventDefault();
          shortcut.callback();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// ============================================================================
// Keyboard Shortcuts Help
// ============================================================================

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface KeyboardShortcutsHelpProps {
  shortcuts: ShortcutItem[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal displaying available keyboard shortcuts.
 */
export const KeyboardShortcutsHelp = memo(function KeyboardShortcutsHelp({
  shortcuts,
  isOpen,
  onClose,
}: KeyboardShortcutsHelpProps) {
  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">
          Keyboard Shortcuts
        </h2>

        <div className="space-y-2">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2"
            >
              <span className="text-sm text-zinc-300">
                {shortcut.description}
              </span>
              <Shortcut keys={shortcut.keys} />
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
});

// ============================================================================
// Default App Shortcuts
// ============================================================================

export const APP_SHORTCUTS: ShortcutItem[] = [
  { keys: ["R"], description: "Refresh data" },
  { keys: ["N"], description: "New task" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
  { keys: ["G", "H"], description: "Go to dashboard" },
  { keys: ["G", "A"], description: "Go to agents" },
  { keys: ["G", "T"], description: "Go to tasks" },
  { keys: ["G", "E"], description: "Go to exceptions" },
  { keys: ["Escape"], description: "Close dialog / Clear selection" },
];
