import { NextRequest, NextResponse } from "next/server";

import { supervisorService } from "@/services/supervisor-service";

// ============================================================================
// GET /api/cron/cleanup
// ============================================================================
// This endpoint is called by Vercel Cron every 5 minutes.
// It runs supervisor checks to clean up stuck agents and expired locks.

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // In production, require CRON_SECRET for security
    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        console.error("[Cron] CRON_SECRET environment variable is not set");
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 }
        );
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[Cron] Unauthorized cron request attempted");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    console.log("[Cron] Starting cleanup job...");
    const startTime = Date.now();

    // Run supervisor checks
    // This will:
    // - Check for stuck agents
    // - Clean up expired locks
    // - Process failed tasks for retry
    await supervisorService.runChecks();

    const duration = Date.now() - startTime;
    console.log(`[Cron] Cleanup job completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: "Cleanup completed",
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Cleanup job failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Vercel Cron configuration
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for cleanup
