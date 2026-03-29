import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyPayment, ChapaError } from "@/lib/chapa";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { COMMERCE_ENABLED } from "@/lib/features";
import {
  checkRateLimit,
  RateLimits,
  rateLimitExceededResponse,
  createRateLimitHeaders,
} from "@/lib/rate-limiter";
import { paymentVerifySchema, validatePaymentInput } from "@/lib/validators/payment";

// Security headers for payment endpoints
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
};

/** Prefer platform-set headers (not client-spoofable) over x-forwarded-for */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  // Check if commerce features are enabled
  if (!COMMERCE_ENABLED) {
    return NextResponse.json(
      { error: "Payment features are currently unavailable. Coming soon!" },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const txRef = searchParams.get("tx_ref");

    const { userId } = await auth();
    const clientIp = getClientIP(request);
    const rateLimitKey = userId
      ? `payment_verify:${userId}`
      : `payment_verify:${clientIp}:${txRef || "no-ref"}`;

    const rateLimitResult = await checkRateLimit(rateLimitKey, RateLimits.PAYMENT_VERIFY);

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    // Validate input
    const validation = validatePaymentInput(paymentVerifySchema, { tx_ref: txRef });
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Verify with Chapa
    const chapaResponse = await verifyPayment(validation.data.tx_ref);

    // Update payment status in Convex
    const status = chapaResponse.data.status === "success" ? "success" : "failed";
    const verifiedTxRef = validation.data.tx_ref;
    const chapaTrxRef = chapaResponse.data.reference;
    const processorFeeTotal = typeof chapaResponse.data.charge === "number"
      ? chapaResponse.data.charge
      : undefined;

    // Isolate DB update so Chapa verification and DB updates are handled separately
    try {
      await convex.mutation(api.payments.updateStatus, {
        txRef: verifiedTxRef,
        status,
        chapaTrxRef,
        processorFeeTotal,
      });
    } catch (updateError) {
      console.error("Chapa verification succeeded but DB update failed:", {
        txRef: verifiedTxRef,
        chapaTrxRef,
        chapaResponse: chapaResponse.data,
        error: updateError,
      });
      // Return partial success - verification passed but DB update failed
      return NextResponse.json(
        {
          success: true,
          status,
          warning: "Payment verified but status update failed. Please contact support if issues persist.",
          data: {
            amount: chapaResponse.data.amount,
            currency: chapaResponse.data.currency,
            reference: chapaResponse.data.reference,
            tx_ref: chapaResponse.data.tx_ref,
            payment_method: chapaResponse.data.method,
            created_at: chapaResponse.data.created_at,
          },
          reconciliationRequired: true,
        },
        {
          headers: {
            ...SECURITY_HEADERS,
            ...createRateLimitHeaders(rateLimitResult),
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status,
        data: {
          amount: chapaResponse.data.amount,
          currency: chapaResponse.data.currency,
          reference: chapaResponse.data.reference,
          tx_ref: chapaResponse.data.tx_ref,
          payment_method: chapaResponse.data.method,
          created_at: chapaResponse.data.created_at,
        },
      },
      {
        headers: {
          ...SECURITY_HEADERS,
          ...createRateLimitHeaders(rateLimitResult),
        },
      }
    );
  } catch (error) {
    console.error("Payment verification error:", error);

    if (error instanceof ChapaError) {
      // Don't expose internal details
      return NextResponse.json(
        { error: "Unable to verify payment status" },
        { status: error.statusCode === 404 ? 404 : 503, headers: SECURITY_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  // Check if commerce features are enabled
  if (!COMMERCE_ENABLED) {
    return NextResponse.json(
      { error: "Payment features are currently unavailable. Coming soon!" },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }

  try {
    let body: { tx_ref?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const txRef = body.tx_ref;

    if (!txRef) {
      return NextResponse.json(
        { error: "Transaction reference is required" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Create a new URL with the tx_ref as query param
    const url = new URL(request.url);
    url.searchParams.set("tx_ref", txRef);

    // Create a new request with the modified URL
    const newRequest = new NextRequest(url, {
      method: "GET",
      headers: request.headers,
    });

    return GET(newRequest);
  } catch {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
