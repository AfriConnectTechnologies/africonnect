import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/chapa";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import crypto from "crypto";
import {
  checkRateLimit,
  RateLimits,
  rateLimitExceededResponse,
} from "@/lib/rate-limiter";
import { webhookPayloadSchema, validatePaymentInput } from "@/lib/validators/payment";
import { createApiLogger, PaymentLogEvents, flushLogs } from "@/lib/axiom";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Security headers
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

// Chapa webhook IP allowlist (update with actual Chapa IPs if available)
const CHAPA_ALLOWED_IPS = process.env.CHAPA_WEBHOOK_IPS?.split(",") || [];

// Maximum age for webhook timestamps (5 minutes)
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

/**
 * Verify webhook signature from Chapa using HMAC-SHA256
 * Normalizes signature (strips sha256= prefix), decodes to fixed-length buffer,
 * and only uses timingSafeEqual when lengths match to avoid throws.
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedHex = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expectedHex, "hex");
  const normalized = signature.replace(/^sha256=/i, "").trim();
  let signatureBuffer: Buffer;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
      signatureBuffer = Buffer.from(normalized, "hex");
    } else {
      return false;
    }
  } catch {
    return false;
  }
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

/**
 * Log audit event for webhook processing
 */
async function logAuditEvent(
  action: string,
  status: string,
  txRef?: string,
  metadata?: Record<string, unknown>,
  errorMessage?: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await convex.mutation(api.paymentAuditLogs.create, {
      action,
      status,
      txRef,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      errorMessage,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Extract client IP from request headers
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || undefined;
  const log = createApiLogger(request, "/api/payments/webhook");

  try {
    log.info(PaymentLogEvents.PAYMENT_WEBHOOK_RECEIVED, {
      ip: ipAddress,
    });

    // Rate limiting for webhooks
    const rateLimitResult = await checkRateLimit(`webhook:${ipAddress}`, RateLimits.WEBHOOK);
    if (!rateLimitResult.success) {
      log.warn("Webhook rate limited", { ip: ipAddress });
      await logAuditEvent(
        "webhook",
        "rate_limited",
        undefined,
        { ip: ipAddress },
        "Rate limit exceeded",
        ipAddress,
        userAgent
      );
      await flushLogs();
      return rateLimitExceededResponse(rateLimitResult);
    }

    // IP allowlist check (if configured)
    if (CHAPA_ALLOWED_IPS.length > 0 && !CHAPA_ALLOWED_IPS.includes(ipAddress)) {
      log.warn("Webhook from unauthorized IP", { ip: ipAddress });
      await logAuditEvent(
        "webhook",
        "unauthorized_ip",
        undefined,
        { ip: ipAddress },
        "Unauthorized IP address",
        ipAddress,
        userAgent
      );
      await flushLogs();
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers: SECURITY_HEADERS }
      );
    }

    // Get raw payload for signature verification
    const payload = await request.text();
    const signature =
      request.headers.get("x-chapa-signature") ||
      request.headers.get("Chapa-Signature");
    const timestamp = request.headers.get("x-chapa-timestamp");

    // MANDATORY: Verify webhook signature
    const webhookSecret = process.env.CHAPA_ENCRYPTION_KEY;
    if (!webhookSecret) {
      console.error("CHAPA_ENCRYPTION_KEY is not configured - webhook security compromised");
      await logAuditEvent(
        "webhook",
        "config_error",
        undefined,
        {},
        "Webhook secret not configured",
        ipAddress,
        userAgent
      );
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }

    if (!signature) {
      console.error("Missing webhook signature");
      await logAuditEvent(
        "webhook",
        "missing_signature",
        undefined,
        {},
        "Missing signature header",
        ipAddress,
        userAgent
      );
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    const isValidSignature = verifyWebhookSignature(payload, signature, webhookSecret);
    if (!isValidSignature) {
      console.error("Invalid webhook signature");
      await logAuditEvent(
        "webhook",
        "invalid_signature",
        undefined,
        { signatureProvided: signature.substring(0, 10) + "..." },
        "Invalid signature",
        ipAddress,
        userAgent
      );
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    // Replay attack prevention: Check timestamp if provided
    if (timestamp) {
      const webhookTime = parseInt(timestamp, 10);
      const now = Date.now();
      if (isNaN(webhookTime) || now - webhookTime > MAX_WEBHOOK_AGE_MS) {
        console.error("Webhook timestamp expired or invalid");
        await logAuditEvent(
          "webhook",
          "expired",
          undefined,
          { timestamp, age: now - webhookTime },
          "Webhook expired",
          ipAddress,
          userAgent
        );
        return NextResponse.json(
          { error: "Webhook expired" },
          { status: 400, headers: SECURITY_HEADERS }
        );
      }
    }

    // Parse and validate payload
    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      await logAuditEvent(
        "webhook",
        "invalid_json",
        undefined,
        {},
        "Invalid JSON payload",
        ipAddress,
        userAgent
      );
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const validation = validatePaymentInput(webhookPayloadSchema, body);
    if (!validation.success) {
      await logAuditEvent(
        "webhook",
        "validation_failed",
        undefined,
        { error: validation.error },
        validation.error,
        ipAddress,
        userAgent
      );
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const { tx_ref, status, trx_ref } = validation.data;

    console.log(`Webhook received for tx_ref: ${tx_ref}, status: ${status}`);

    // Duplicate webhook detection
    const webhookResult = await convex.mutation(api.paymentAuditLogs.markWebhookProcessed, {
      txRef: tx_ref,
      eventType: `payment.${status || "unknown"}`,
      signature: signature.substring(0, 32), // Store partial signature for audit
    });

    if (webhookResult.alreadyProcessed) {
      console.log(`Duplicate webhook for tx_ref: ${tx_ref}, ignoring`);
      await logAuditEvent(
        "webhook",
        "duplicate",
        tx_ref,
        { eventId: webhookResult.eventId },
        "Duplicate webhook ignored",
        ipAddress,
        userAgent
      );
      return NextResponse.json(
        { success: true, message: "Already processed" },
        { headers: SECURITY_HEADERS }
      );
    }

    // Double-verify payment status with Chapa API
    let verifiedStatus = status;
    let processorFeeTotal: number | undefined;
    try {
      const verification = await verifyPayment(tx_ref);
      verifiedStatus = verification.data.status;
      if (typeof verification.data.charge === "number") {
        processorFeeTotal = verification.data.charge;
      }
    } catch (verifyError) {
      console.error("Error verifying payment with Chapa:", verifyError);
      // Log but continue with webhook status if API verification fails
      await logAuditEvent(
        "webhook",
        "verify_api_failed",
        tx_ref,
        { webhookStatus: status },
        "Chapa API verification failed, using webhook status",
        ipAddress,
        userAgent
      );
    }

    // Map Chapa status to our status
    let paymentStatus: "success" | "failed" | "pending" | "cancelled";
    switch (verifiedStatus?.toLowerCase()) {
      case "success":
      case "successful":
        paymentStatus = "success";
        break;
      case "failed":
        paymentStatus = "failed";
        break;
      case "pending":
        paymentStatus = "pending";
        break;
      default:
        paymentStatus = "failed";
    }

    // Update payment in database
    await convex.mutation(api.payments.updateStatus, {
      txRef: tx_ref,
      status: paymentStatus,
      chapaTrxRef: trx_ref,
      processorFeeTotal,
    });

    // Log successful webhook processing
    await logAuditEvent(
      "webhook",
      "success",
      tx_ref,
      {
        webhookStatus: status,
        verifiedStatus,
        finalStatus: paymentStatus,
        chapaTrxRef: trx_ref,
      },
      undefined,
      ipAddress,
      userAgent
    );

    log.info(PaymentLogEvents.PAYMENT_WEBHOOK_PROCESSED, {
      txRef: tx_ref,
      webhookStatus: status,
      verifiedStatus,
      finalStatus: paymentStatus,
      chapaTrxRef: trx_ref,
    });

    await flushLogs();

    return NextResponse.json(
      { success: true, message: "Webhook processed successfully" },
      { headers: SECURITY_HEADERS }
    );
  } catch (error) {
    log.error("Webhook processing failed", error);

    await logAuditEvent(
      "webhook",
      "error",
      undefined,
      {},
      error instanceof Error ? error.message : "Unknown error",
      ipAddress,
      userAgent
    );

    await flushLogs();

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}

// Handle GET requests (Chapa sometimes sends GET for callbacks)
export async function GET(request: NextRequest) {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  const { searchParams } = new URL(request.url);
  const txRef = searchParams.get("tx_ref") || searchParams.get("trx_ref");
  const status = searchParams.get("status");

  if (!txRef) {
    return NextResponse.json(
      { error: "Missing transaction reference" },
      { status: 400, headers: SECURITY_HEADERS }
    );
  }

  // Rate limit per tx_ref to prevent abuse (5 requests per minute per tx_ref)
  const txRefRateLimit = await checkRateLimit(`webhook_get:${txRef}`, {
    windowMs: 60 * 1000,
    maxRequests: 5,
  });
  if (!txRefRateLimit.success) {
    await logAuditEvent(
      "webhook_get",
      "rate_limited",
      txRef,
      { retryAfter: txRefRateLimit.retryAfter },
      "Rate limit exceeded for tx_ref",
      ipAddress,
      userAgent
    );
    return rateLimitExceededResponse(txRefRateLimit);
  }

  // Log GET callback
  await logAuditEvent(
    "webhook_get",
    "received",
    txRef,
    { status },
    undefined,
    ipAddress,
    userAgent
  );

  // Verify and update payment (always verify with Chapa API, ignore query params)
  try {
    const verification = await verifyPayment(txRef);
    const paymentStatus = verification.data.status === "success" ? "success" : "failed";
    const processorFeeTotal = typeof verification.data.charge === "number"
      ? verification.data.charge
      : undefined;

    await convex.mutation(api.payments.updateStatus, {
      txRef,
      status: paymentStatus,
      chapaTrxRef: verification.data.reference,
      processorFeeTotal,
    });

    await logAuditEvent(
      "webhook_get",
      "success",
      txRef,
      { verifiedStatus: paymentStatus },
      undefined,
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      { success: true, status: paymentStatus },
      { headers: SECURITY_HEADERS }
    );
  } catch (error) {
    console.error("Webhook GET processing error:", error);

    // SECURITY: If verification fails, do NOT trust unverified query parameter status
    // Set to "pending" for manual review instead of trusting client-controlled data
    try {
      await convex.mutation(api.payments.updateStatus, {
        txRef,
        status: "pending", // Safe fallback - requires manual review
      });
    } catch {
      // Ignore update errors
    }

    await logAuditEvent(
      "webhook_get",
      "fallback_pending",
      txRef,
      { untrustedQueryStatus: status },
      error instanceof Error ? error.message : "Verification failed - set to pending",
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      { success: true, message: "Webhook processed - verification required" },
      { headers: SECURITY_HEADERS }
    );
  }
}
