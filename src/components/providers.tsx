"use client";

import type { ReactNode } from "react";

import { ToastProvider } from "@/contexts/toast-context";

// ============================================================================
// Providers Component
// ============================================================================

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <ToastProvider>{children}</ToastProvider>;
}
