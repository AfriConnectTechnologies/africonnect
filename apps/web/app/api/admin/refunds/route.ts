import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { processRefund, ChapaError } from "@/lib/chapa";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { z } from "zod";
import { Id } from "@/convex/_generated/dataModel";
import { createApiLogger, PaymentLogEvents, flushLogs } from "@/lib/axiom";

// Security headers
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

// Validation schema
const refundSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  reason: z.string().max(500, "Reason too long").optional(),
  amount: z.number().positive("Amount must be positive").optional(),
});

export async function POST(request: NextRequest) {
  const log = createApiLogger(request, "/api/admin/refunds");
  
  try {
    log.info(PaymentLogEvents.PAYMENT_REFUND_INITIATED);

    // Check authentication
    const { userId, getToken } = await auth();
    if (!userId) {
      log.warn("Refund request - not authenticated");
      await flushLogs();
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    log.setUserId(userId);

    // Validate Convex URL exists
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      log.error("Server configuration error - CONVEX_URL missing");
      await flushLogs();
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }

    // Create authenticated Convex client
    const convex = new ConvexHttpClient(convexUrl);
    const token = await getToken({ template: "convex" });
    if (!token) {
      log.warn("Refund request - no valid authentication token");
      await flushLogs();
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }
    convex.setAuth(token);

    // Check if user is admin
    const currentUser = await convex.query(api.users.getCurrentUser);
    if (!currentUser || currentUser.role !== "admin") {
      log.warn("Refund request - not admin", { userRole: currentUser?.role });
      await flushLogs();
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403, headers: SECURITY_HEADERS }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      await flushLogs();
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const validation = refundSchema.safeParse(body);
    if (!validation.success) {
      await flushLogs();
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Validation failed" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const { paymentId, reason, amount } = validation.data;

    // Validate paymentId format (Convex IDs are alphanumeric strings)
    if (!/^[a-zA-Z0-9]+$/.test(paymentId)) {
      log.warn("Invalid payment ID format", { paymentId });
      await flushLogs();
      return NextResponse.json(
        { error: "Invalid payment ID format" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Get payment details from Convex
    const payment = await convex.query(api.payments.getById, {
      paymentId: paymentId as Id<"payments">,
    });

    if (!payment) {
      await flushLogs();
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404, headers: SECURITY_HEADERS }
      );
    }

    // Only allow refunds for successful payments
    if (payment.status !== "success") {
      return NextResponse.json(
        { error: "Can only refund successful payments" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Check if already refunded
    if (payment.refundedAt) {
      return NextResponse.json(
        { error: "This payment has already been refunded" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Validate refund amount doesn't exceed original payment
    if (amount !== undefined) {
      if (amount <= 0) {
        await flushLogs();
        return NextResponse.json(
          { error: "Refund amount must be a positive number" },
          { status: 400, headers: SECURITY_HEADERS }
        );
      }
      if (amount > payment.amount) {
        log.warn("Refund amount exceeds original payment", {
          paymentId,
          requestedAmount: amount,
          originalAmount: payment.amount,
        });
        await flushLogs();
        return NextResponse.json(
          { error: `Refund amount cannot exceed original payment of ${payment.amount}` },
          { status: 400, headers: SECURITY_HEADERS }
        );
      }
    }

    // Use tx_ref we sent to Chapa (required for refund API), not chapaTrxRef (returned by Chapa)
    const txRef = payment.chapaTransactionRef;
    if (!txRef) {
      await flushLogs();
      return NextResponse.json(
        { error: "No Chapa transaction reference found for this payment" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Generate unique refund reference
    const refundReference = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Process refund with Chapa
    const refundResponse = await processRefund(txRef, {
      reason: reason || "Subscription refund requested by admin",
      amount: amount ? amount.toString() : undefined, // If not provided, full refund
      reference: refundReference,
      meta: {
        payment_id: paymentId,
        admin_user_id: userId,
        refund_type: payment.paymentType,
      },
    });

    // Record refund in Convex with error handling for inconsistent state
    const refundAmount = amount || payment.amount;
    try {
      await convex.mutation(api.payments.recordRefund, {
        paymentId: paymentId as Id<"payments">,
        refundAmount,
        refundReason: reason || "Admin initiated refund",
        refundReference,
      });
    } catch (mutationError) {
      // Log detailed error for refund discrepancy tracking
      log.error("Refund processed but database update failed - RECONCILIATION NEEDED", mutationError, {
        paymentId,
        refundReference,
        refundAmount,
        reason,
        adminUserId: userId,
        chapaResponse: refundResponse.data,
      });
      await flushLogs();
      // Return partial success so the caller knows refund went through but DB update failed
      return NextResponse.json(
        {
          success: true,
          warning: "Refund processed with payment provider but database update failed. Please contact support.",
          refund: {
            reference: refundReference,
            amount: refundAmount,
            currency: payment.currency,
            chapaResponse: refundResponse.data,
          },
          reconciliationRequired: true,
        },
        { status: 200, headers: SECURITY_HEADERS }
      );
    }

    // If this was a subscription payment, cancel the subscription
    if (payment.paymentType === "subscription" && payment.metadata) {
      try {
        const metadata = JSON.parse(payment.metadata);
        if (metadata.businessId) {
          const subscription = await convex.query(api.subscriptions.getByBusiness, {
            businessId: metadata.businessId as Id<"businesses">,
          });
          if (subscription) {
            await convex.mutation(api.subscriptions.updateStatus, {
              subscriptionId: subscription._id,
              status: "cancelled",
            });
          }
        }
      } catch (e) {
        console.error("Failed to cancel subscription after refund:", e);
        // Don't fail the refund if subscription cancellation fails
      }
    }

    log.info(PaymentLogEvents.PAYMENT_REFUND_COMPLETED, {
      paymentId,
      refundReference,
      refundAmount: amount || payment.amount,
      currency: payment.currency,
      originalAmount: payment.amount,
      adminUserId: userId,
    });

    await flushLogs();

    return NextResponse.json(
      {
        success: true,
        message: "Refund processed successfully",
        refund: {
          reference: refundReference,
          amount: amount || payment.amount,
          currency: payment.currency,
          chapaResponse: refundResponse.data,
        },
      },
      { headers: SECURITY_HEADERS }
    );
  } catch (error) {
    log.error(PaymentLogEvents.PAYMENT_REFUND_FAILED, error);
    await flushLogs();

    if (error instanceof ChapaError) {
      return NextResponse.json(
        { error: error.message || "Failed to process refund with payment provider" },
        { status: error.statusCode || 503, headers: SECURITY_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
