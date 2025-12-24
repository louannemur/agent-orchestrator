import { z } from "zod";

// ============================================================================
// Environment Variable Schema
// ============================================================================

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // API Keys
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),

  // Security
  CRON_SECRET: z.string().optional(),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

// ============================================================================
// Environment Validation
// ============================================================================

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  ${key}: ${messages?.join(", ")}`)
      .join("\n");

    // In production, fail fast with clear error
    if (process.env.NODE_ENV === "production") {
      console.error("❌ Invalid environment variables:\n" + errorMessages);
      throw new Error(
        "Invalid environment variables. See logs for details."
      );
    }

    // In development, warn but allow startup
    console.warn("⚠️  Missing or invalid environment variables:\n" + errorMessages);
    console.warn("Some features may not work correctly.\n");

    // Return partial env with defaults for development
    return {
      DATABASE_URL: process.env.DATABASE_URL || "",
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
      CRON_SECRET: process.env.CRON_SECRET,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: (process.env.NODE_ENV as Env["NODE_ENV"]) || "development",
    };
  }

  return parsed.data;
}

// ============================================================================
// Exported Environment
// ============================================================================

export const env = validateEnv();

// Type-safe environment access
export type { Env };

// Helper to check if we're in production
export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
