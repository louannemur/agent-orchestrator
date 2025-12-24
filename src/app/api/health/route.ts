import { NextResponse } from "next/server";

import { db } from "@/lib/db";

// ============================================================================
// Types
// ============================================================================

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version: string;
  checks: {
    database: "ok" | "error";
  };
  uptime?: number;
}

// ============================================================================
// GET /api/health
// ============================================================================

const startTime = Date.now();

export async function GET() {
  const timestamp = new Date().toISOString();

  // Check database connection
  let databaseStatus: "ok" | "error" = "ok";

  try {
    // Simple query to verify database connection
    await db.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "error";
  }

  const overallStatus: "ok" | "degraded" | "error" =
    databaseStatus === "error" ? "error" : "ok";

  const health: HealthStatus = {
    status: overallStatus,
    timestamp,
    version: "1.0.0",
    checks: {
      database: databaseStatus,
    },
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  const statusCode = overallStatus === "ok" ? 200 : 503;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
