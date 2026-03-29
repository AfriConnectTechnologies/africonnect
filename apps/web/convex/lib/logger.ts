/**
 * Logger for Convex Functions
 * 
 * This module provides structured logging for Convex serverless functions.
 * 
 * IMPORTANT: Convex queries and mutations cannot use fetch() or setTimeout().
 * This logger uses console.log() which is safe for all Convex function types.
 * 
 * For external log shipping (e.g., to Axiom), use a separate Convex action
 * or ship logs from the client side.
 * 
 * Usage:
 * 1. Import and use createLogger() in your functions
 * 2. Logs will appear in Convex dashboard and local console
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  _time: string;
  level: LogLevel;
  function: string;
  requestId: string;
  message: string;
  userId?: string;
  businessId?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  environment?: string;
}

export interface LogContext {
  functionName: string;
  requestId: string;
  userId?: string;
  businessId?: string;
  startTime?: number;
}

/**
 * Log an entry to console (safe for queries, mutations, and actions)
 */
function logToConsole(entry: LogEntry): void {
  const consoleMethod = entry.level === "error" ? console.error : 
                       entry.level === "warn" ? console.warn : 
                       entry.level === "debug" ? console.debug :
                       console.log;
  
  const logData: Record<string, unknown> = {
    requestId: entry.requestId,
    function: entry.function,
  };
  
  if (entry.userId) logData.userId = entry.userId;
  if (entry.businessId) logData.businessId = entry.businessId;
  if (entry.duration_ms !== undefined) logData.duration_ms = entry.duration_ms;
  if (entry.metadata) logData.metadata = entry.metadata;
  if (entry.error) logData.error = entry.error;
  
  consoleMethod(`[${entry.level.toUpperCase()}] ${entry.function}: ${entry.message}`, logData);
}

/**
 * No-op flush function for backwards compatibility
 * Logs are written immediately to console, no buffering needed
 */
async function flushLogs(): Promise<void> {
  // No-op: logs are written immediately to console
  // This function exists for backwards compatibility
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Sanitize sensitive data from metadata recursively
 */
function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sensitiveKeys = ["password", "secret", "token", "key", "authorization", "cookie", "credit_card", "card_number", "cvv", "ssn"];
  
  function sanitizeValue(value: unknown, key?: string, seen = new WeakSet()): unknown {
    // Check if key contains sensitive data
    if (key) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        return "[REDACTED]";
      }
    }
    
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }
    
    // Handle special objects (Date, RegExp) - return as-is
    if (value instanceof Date || value instanceof RegExp) {
      return value;
    }
    
    // Handle strings
    if (typeof value === "string") {
      return value.length > 500 ? value.substring(0, 500) + "...[truncated]" : value;
    }
    
    // Handle primitives
    if (typeof value !== "object") {
      return value;
    }
    
    // Check for circular references
    if (seen.has(value as object)) {
      return "[Circular]";
    }
    seen.add(value as object);
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, undefined, seen));
    }
    
    // Handle objects - recurse
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitizedObj[k] = sanitizeValue(v, k, seen);
    }
    return sanitizedObj;
  }
  
  return sanitizeValue(metadata) as Record<string, unknown>;
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private context: LogContext;

  constructor(context: LogContext) {
    this.context = context;
  }

  private createEntry(level: LogLevel, message: string, metadata?: Record<string, unknown>, error?: Error): LogEntry {
    const entry: LogEntry = {
      _time: new Date().toISOString(),
      level,
      function: this.context.functionName,
      requestId: this.context.requestId,
      message,
      userId: this.context.userId,
      businessId: this.context.businessId,
      metadata: sanitizeMetadata(metadata),
      environment: process.env.NODE_ENV || "development",
    };

    if (this.context.startTime) {
      entry.duration_ms = Date.now() - this.context.startTime;
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string }).code,
      };
    }

    return entry;
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    logToConsole(this.createEntry("debug", message, metadata));
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    logToConsole(this.createEntry("info", message, metadata));
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    logToConsole(this.createEntry("warn", message, metadata));
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logToConsole(this.createEntry("error", message, metadata, errorObj));
  }

  /**
   * Update the context (e.g., after getting userId)
   */
  setContext(updates: Partial<LogContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Get the current request ID
   */
  getRequestId(): string {
    return this.context.requestId;
  }

  /**
   * No-op flush for backwards compatibility
   * Logs are written immediately, no buffering
   */
  async flush(): Promise<void> {
    // No-op: logs are written immediately
  }
}

/**
 * Create a logger for a function
 */
export function createLogger(
  functionName: string,
  options?: {
    userId?: string;
    businessId?: string;
    requestId?: string;
  }
): Logger {
  return new Logger({
    functionName,
    requestId: options?.requestId || generateRequestId(),
    userId: options?.userId,
    businessId: options?.businessId,
    startTime: Date.now(),
  });
}

/**
 * Higher-order function to wrap Convex handlers with automatic logging
 * 
 * Usage:
 * ```
 * export const myMutation = mutation({
 *   args: { ... },
 *   handler: withLogging("myFile.myMutation", async (ctx, args, log) => {
 *     log.info("Starting operation", { arg1: args.arg1 });
 *     // ... your logic
 *     log.info("Operation completed", { result: "success" });
 *     return result;
 *   }),
 * });
 * ```
 */
export function withLogging<TCtx, TArgs, TResult>(
  functionName: string,
  handler: (ctx: TCtx, args: TArgs, log: Logger) => Promise<TResult>
) {
  return async (ctx: TCtx, args: TArgs): Promise<TResult> => {
    const log = createLogger(functionName);
    const startTime = Date.now();

    // Log function start with sanitized args
    log.info("Function started", { args: sanitizeMetadata(args as Record<string, unknown>) });

    try {
      const result = await handler(ctx, args, log);
      
      const duration = Date.now() - startTime;
      log.info("Function completed successfully", { duration_ms: duration });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      log.error("Function failed", error, { duration_ms: duration });
      
      throw error;
    }
  };
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(
  parent: Logger, 
  functionName: string,
  additionalContext: { businessId?: string; userId?: string }
): Logger {
  const newLogger = createLogger(functionName, { requestId: parent.getRequestId() });
  newLogger.setContext(additionalContext);
  return newLogger;
}

/**
 * Log function execution with timing
 */
export async function logWithTiming<T>(
  log: Logger,
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();
  log.debug(`Starting: ${operationName}`, metadata);

  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    log.debug(`Completed: ${operationName}`, { ...metadata, duration_ms: duration });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error(`Failed: ${operationName}`, error, { ...metadata, duration_ms: duration });
    throw error;
  }
}

// Export flush function for backwards compatibility
export { flushLogs };
