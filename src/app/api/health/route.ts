import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

// ============================================================================
// Types
// ============================================================================

interface CheckResult {
  status: "ok" | "error";
  latencyMs?: number;
  message?: string;
}

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version: string;
  environment: string;
  region?: string;
  checks: {
    database: CheckResult;
  };
  stats?: {
    uptime: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const startTime = Date.now();
const VERSION = process.env.npm_package_version || "1.0.0";
const ENVIRONMENT = process.env.NODE_ENV || "development";
const REGION = process.env.VERCEL_REGION;

// ============================================================================
// Health Check Functions
// ============================================================================

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();

  try {
    // Simple query to verify database connection
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;

    return {
      status: "ok",
      latencyMs,
    };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message:
        error instanceof Error
          ? error.message
          : "Database connection failed",
    };
  }
}

function getMemoryUsage(): NodeJS.MemoryUsage | undefined {
  try {
    return process.memoryUsage();
  } catch {
    return undefined;
  }
}

// ============================================================================
// GET /api/health
// ============================================================================

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const requestId = request.headers.get("x-request-id") || undefined;

  // Check for detailed health check (admin only)
  const includeDetails =
    request.nextUrl.searchParams.get("detailed") === "true";

  // Run health checks
  const databaseCheck = await checkDatabase();

  // Determine overall status
  const hasError = databaseCheck.status === "error";
  const overallStatus: "ok" | "degraded" | "error" = hasError ? "error" : "ok";

  // Build response
  const health: HealthStatus = {
    status: overallStatus,
    timestamp,
    version: VERSION,
    environment: ENVIRONMENT,
    region: REGION,
    checks: {
      database: databaseCheck,
    },
  };

  // Include detailed stats if requested
  if (includeDetails) {
    health.stats = {
      uptime: Math.floor((Date.now() - startTime) / 1000),
      memoryUsage: getMemoryUsage(),
    };
  }

  const statusCode = overallStatus === "ok" ? 200 : 503;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(requestId && { "X-Request-Id": requestId }),
    },
  });
}

// ============================================================================
// HEAD /api/health (lightweight check)
// ============================================================================

export async function HEAD() {
  try {
    await db.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
