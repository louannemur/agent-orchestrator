/**
 * Next.js Instrumentation
 *
 * This file runs when the Next.js server starts.
 * Used to initialize background services like the SupervisorService.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamically import to avoid client-side bundling
    const { supervisorService } = await import("@/services/supervisor-service");

    // Start the supervisor monitoring
    console.log("[Instrumentation] Starting supervisor service...");
    await supervisorService.startMonitoring();

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("[Instrumentation] Shutting down supervisor service...");
      await supervisorService.stopMonitoring();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}
