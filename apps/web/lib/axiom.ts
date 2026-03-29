/**
 * Axiom Logger for Next.js API Routes
 * 
 * This module provides structured logging to Axiom from Next.js API routes.
 * Uses HTTP API for compatibility with edge and serverless environments.
 * 
 * Setup:
 * 1. Add AXIOM_API_TOKEN and AXIOM_DATASET to .env.local
 * 2. Import and use createApiLogger() in your API routes
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ApiLogEntry {
  _time: string;
  level: LogLevel;
  route: string;
  method: string;
  requestId: string;
  message: string;
  userId?: string;
  statusCode?: number;
  duration_ms?: number;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  environment?: string;
}

export interface ApiLogContext {
  route: string;
  method: string;
  requestId: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  startTime: number;
}

// In-memory buffer for batching logs
const logBuffer: ApiLogEntry[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 500; // Flush every 500ms for API routes (lower latency)
const MAX_BUFFER_SIZE = 25; // Smaller buffer for API routes

/**
 * Send logs to Axiom via HTTP API
 */
async function sendToAxiom(logs: ApiLogEntry[]): Promise<void> {
  const apiToken = process.env.AXIOM_API_TOKEN;
  const dataset = process.env.AXIOM_DATASET || "africonnect-logs";

  if (!apiToken) {
    // Fall back to console logging if Axiom is not configured
    logs.forEach((log) => {
      const consoleMethod = log.level === "error" ? console.error : 
                           log.level === "warn" ? console.warn : 
                           console.log;
      consoleMethod(`[${log.level.toUpperCase()}] [${log.method}] ${log.route}: ${log.message}`, {
        requestId: log.requestId,
        userId: log.userId,
        statusCode: log.statusCode,
        duration_ms: log.duration_ms,
        metadata: log.metadata,
        error: log.error,
      });
    });
    return;
  }

  try {
    // Use the correct edge deployment endpoint
    // EU Central 1 (AWS): eu-central-1.aws.edge.axiom.co
    // US East 1 (AWS): us-east-1.aws.edge.axiom.co
    // See: https://axiom.co/docs/reference/edge-deployments
    const apiHost = process.env.AXIOM_API_HOST || "https://eu-central-1.aws.edge.axiom.co";
    const orgId = process.env.AXIOM_ORG_ID;
    const url = `${apiHost}/v1/ingest/${dataset}`;
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };
    
    // Add org ID header if provided
    if (orgId) {
      headers["X-Axiom-Org-Id"] = orgId;
    }
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(logs),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`[Axiom] Failed to send logs: ${response.status} ${response.statusText}`, responseText);
      throw new Error(`Axiom ingest failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error("[Axiom] Error sending logs:", error);
    throw error;
  }
}

/**
 * Flush the log buffer to Axiom
 * Logs are only removed from buffer on successful send
 */
async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) return;

  const logsToSend = [...logBuffer];

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  try {
    await sendToAxiom(logsToSend);
    // Only clear buffer on success
    logBuffer.length = 0;
  } catch (error) {
    // On failure, logs remain in buffer for retry
    console.error("[Axiom] Flush failed, logs retained for retry:", error);
    // Re-schedule flush for retry
    scheduleFlush();
  }
}

/**
 * Schedule a flush if not already scheduled
 */
function scheduleFlush(): void {
  if (flushTimeout === null) {
    flushTimeout = setTimeout(() => {
      flushLogs();
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Add a log entry to the buffer
 */
function bufferLog(entry: ApiLogEntry): void {
  logBuffer.push(entry);

  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flushLogs();
  } else {
    scheduleFlush();
  }
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `api_${timestamp}_${random}`;
}

/**
 * Sanitize sensitive data from metadata recursively
 */
function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sensitiveKeys = ["password", "secret", "token", "key", "authorization", "cookie", "credit_card", "card_number", "cvv", "ssn", "api_key", "access_token", "auth"];
  
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
 * Extract client IP from request headers
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * API Logger class for structured logging
 */
export class ApiLogger {
  private context: ApiLogContext;

  constructor(context: ApiLogContext) {
    this.context = context;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    options?: {
      statusCode?: number;
      metadata?: Record<string, unknown>;
      error?: Error;
    }
  ): ApiLogEntry {
    const entry: ApiLogEntry = {
      _time: new Date().toISOString(),
      level,
      route: this.context.route,
      method: this.context.method,
      requestId: this.context.requestId,
      message,
      userId: this.context.userId,
      ip: this.context.ip,
      userAgent: this.context.userAgent,
      duration_ms: Date.now() - this.context.startTime,
      statusCode: options?.statusCode,
      metadata: sanitizeMetadata(options?.metadata),
      environment: process.env.NODE_ENV || "development",
    };

    if (options?.error) {
      entry.error = {
        message: options.error.message,
        stack: options.error.stack,
        code: (options.error as Error & { code?: string }).code,
      };
    }

    return entry;
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    bufferLog(this.createEntry("debug", message, { metadata }));
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    bufferLog(this.createEntry("info", message, { metadata }));
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    bufferLog(this.createEntry("warn", message, { metadata }));
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorObj = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    bufferLog(this.createEntry("error", message, { metadata, error: errorObj }));
  }

  /**
   * Log a successful response
   */
  logResponse(statusCode: number, message: string, metadata?: Record<string, unknown>): void {
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    bufferLog(this.createEntry(level, message, { statusCode, metadata }));
  }

  /**
   * Update the context
   */
  setContext(updates: Partial<ApiLogContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Set the user ID
   */
  setUserId(userId: string): void {
    this.context.userId = userId;
  }

  /**
   * Get the current request ID
   */
  getRequestId(): string {
    return this.context.requestId;
  }

  /**
   * Force flush all buffered logs immediately
   */
  async flush(): Promise<void> {
    await flushLogs();
  }
}

/**
 * Create a logger for an API route
 */
export function createApiLogger(
  request: Request,
  route: string,
  options?: {
    userId?: string;
    requestId?: string;
  }
): ApiLogger {
  return new ApiLogger({
    route,
    method: request.method,
    requestId: options?.requestId || generateRequestId(),
    userId: options?.userId,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") || undefined,
    startTime: Date.now(),
  });
}

/**
 * Higher-order function to wrap API route handlers with automatic logging
 * 
 * Usage:
 * ```
 * export const POST = withApiLogging("/api/payments", async (request, log) => {
 *   log.info("Processing payment", { amount: 100 });
 *   // ... your logic
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withApiLogging<T extends Response>(
  route: string,
  handler: (request: Request, log: ApiLogger) => Promise<T>
) {
  return async (request: Request): Promise<T> => {
    const log = createApiLogger(request, route);

    // Sanitize URL to remove sensitive query parameters
    const sensitiveParams = ["token", "api_key", "access_token", "password", "auth", "key", "secret"];
    let sanitizedUrl = request.url;
    try {
      const urlObj = new URL(request.url);
      sensitiveParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, "[REDACTED]");
        }
      });
      sanitizedUrl = urlObj.pathname + (urlObj.search || "");
    } catch {
      // If URL parsing fails, just use pathname-like portion
      sanitizedUrl = request.url.split("?")[0];
    }

    log.info("Request received", {
      url: sanitizedUrl,
      method: request.method,
    });

    try {
      const response = await handler(request, log);
      
      log.logResponse(response.status, "Request completed", {
        status: response.status,
      });
      
      // Ensure logs are flushed
      await log.flush();
      
      return response;
    } catch (error) {
      log.error("Request failed with exception", error);
      
      // Ensure logs are flushed even on error
      await log.flush();
      
      throw error;
    }
  };
}

/**
 * Log payment-specific events
 */
export const PaymentLogEvents = {
  PAYMENT_INITIATED: "Payment initiated",
  PAYMENT_VERIFIED: "Payment verified",
  PAYMENT_WEBHOOK_RECEIVED: "Payment webhook received",
  PAYMENT_WEBHOOK_PROCESSED: "Payment webhook processed",
  PAYMENT_WEBHOOK_DUPLICATE: "Duplicate webhook detected",
  PAYMENT_REFUND_INITIATED: "Refund initiated",
  PAYMENT_REFUND_COMPLETED: "Refund completed",
  PAYMENT_REFUND_FAILED: "Refund failed",
} as const;

// Export flush function
export { flushLogs };
