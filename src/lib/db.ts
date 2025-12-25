import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

// Use fetch mode for serverless (no WebSocket needed)
// Note: This is deprecated but still required for proper initialization
neonConfig.fetchConnectionCache = true;

const createPrismaClient = () => {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Remove channel_binding parameter if present (incompatible with serverless driver)
  connectionString = connectionString.replace(/&?channel_binding=[^&]*/gi, "");
  // Clean up any trailing ? or &
  connectionString = connectionString.replace(/[?&]$/, "");

  // Create pool for Neon serverless
  const pool = new Pool({ connectionString });
  // @ts-expect-error - Pool type mismatch between neon and prisma adapter versions
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type { PrismaClient } from "@prisma/client";
