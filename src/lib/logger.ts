// ============================================================================
// Structured Logger
// ============================================================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProduction = process.env.NODE_ENV === "production";
const minLevel = isProduction ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatError(error: unknown): LogEntry["error"] | undefined {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack,
    };
  }
  if (error) {
    return {
      name: "Unknown",
      message: String(error),
    };
  }
  return undefined;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: context && Object.keys(context).length > 0 ? context : undefined,
    error: formatError(error),
  };
}

function output(entry: LogEntry): void {
  if (isProduction) {
    // JSON format for Vercel logs
    console.log(JSON.stringify(entry));
  } else {
    // Human-readable format for development
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const contextStr = entry.context
      ? ` ${JSON.stringify(entry.context)}`
      : "";
    const errorStr = entry.error
      ? `\n  Error: ${entry.error.message}${entry.error.stack ? `\n${entry.error.stack}` : ""}`
      : "";

    const logFn =
      entry.level === "error"
        ? console.error
        : entry.level === "warn"
          ? console.warn
          : console.log;

    logFn(`${prefix} ${entry.message}${contextStr}${errorStr}`);
  }
}

// ============================================================================
// Logger Class
// ============================================================================

class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    if (shouldLog("debug")) {
      output(createLogEntry("debug", message, { ...this.context, ...context }));
    }
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    if (shouldLog("info")) {
      output(createLogEntry("info", message, { ...this.context, ...context }));
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext, error?: unknown): void {
    if (shouldLog("warn")) {
      output(
        createLogEntry("warn", message, { ...this.context, ...context }, error)
      );
    }
  }

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext, error?: unknown): void {
    if (shouldLog("error")) {
      output(
        createLogEntry("error", message, { ...this.context, ...context }, error)
      );
    }
  }

  /**
   * Log an API request
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    if (shouldLog(level)) {
      output(
        createLogEntry(level, `${method} ${path} ${statusCode}`, {
          ...this.context,
          ...context,
          method,
          path,
          statusCode,
          duration,
        })
      );
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export const logger = new Logger();
export type { LogContext, LogLevel, LogEntry };
