import { Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const createPrismaClient = () => {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Remove channel_binding parameter if present (incompatible with serverless driver)
  // Use regex to avoid URL encoding issues with special characters in passwords
  connectionString = connectionString
    .replace(/(\?|&)channel_binding=[^&]*(&|$)/g, (_, prefix, suffix) =>
      prefix === "?" && suffix === "&" ? "?" : suffix === "&" ? "" : ""
    )
    .replace(/\?$/, ""); // Remove trailing ? if channel_binding was the only param

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
