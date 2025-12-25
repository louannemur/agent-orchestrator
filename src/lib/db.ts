import { neon } from "@neondatabase/serverless";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const createPrismaClient = () => {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Remove channel_binding parameter if present (incompatible with serverless driver)
  connectionString = connectionString.replace(/&?channel_binding=[^&]*/gi, "");
  // Clean up any trailing ? or &
  connectionString = connectionString.replace(/[?&]$/, "");

  // Use HTTP-based Neon client (better for Vercel serverless)
  const sql = neon(connectionString);
  const adapter = new PrismaNeonHTTP(sql);

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
