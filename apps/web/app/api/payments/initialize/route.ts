import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { initializePayment, getPaymentUrls, ChapaError } from "@/lib/chapa";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@africonnect/convex/_generated/api";
import { COMMERCE_ENABLED } from "@/lib/features";
import {
  checkRateLimit,
  RateLimits,
  rateLimitExceededResponse,
  createRateLimitHeaders,
} from "@/lib/rate-limiter";
import {
  paymentInitializeSchema,
  validatePaymentInput,
  validateAmountForCurrency,
} from "@/lib/validators/payment";

// Security headers for payment endpoints
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
};

export async function POST(request: NextRequest) {
  // Check if commerce features are enabled
  if (!COMMERCE_ENABLED) {
    return NextResponse.json(
      { error: "Payment features are currently unavailable. Coming soon!" },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }

  try {
    // Check authentication first
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(
      `payment_init:${userId}`,
      RateLimits.PAYMENT_INIT
    );

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Validate input with Zod
    const validation = validatePaymentInput(paymentInitializeSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const { amount, currency, paymentType, metadata, idempotencyKey } = validation.data;

    // Validate amount for currency
    const amountValidation = validateAmountForCurrency(amount, currency);
    if (!amountValidation.valid) {
      return NextResponse.json(
        { error: amountValidation.error },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Create authenticated Convex client
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const token = await getToken({ template: "convex" });
    if (token) {
      convex.setAuth(token);
    }

    if (paymentType === "order") {
      const buyer = await convex.query(api.users.getCurrentUser);
      const buyerBusiness = await convex.query(api.businesses.getMyBusiness);

      if (!buyer?.businessId || !buyerBusiness) {
        return NextResponse.json(
          {
            error:
              "Business verification is required before you can buy products. Complete your business verification in Settings.",
          },
          { status: 403, headers: SECURITY_HEADERS }
        );
      }
      if (buyerBusiness.verificationStatus === "pending") {
        return NextResponse.json(
          {
            error:
              "Your business verification is still pending review. You can place orders after approval.",
          },
          { status: 403, headers: SECURITY_HEADERS }
        );
      }
      if (buyerBusiness.verificationStatus === "rejected") {
        return NextResponse.json(
          {
            error:
              "Your business verification was rejected. Update your business documents in Settings before buying.",
          },
          { status: 403, headers: SECURITY_HEADERS }
        );
      }

      const buyerAgreementState = await convex.query(
        api.agreements.hasAcceptedCurrentAgreement,
        { type: "buyer" }
      );
      if (buyerAgreementState.status === "missing_active_version") {
        return NextResponse.json(
          { error: "Buyer agreement is not configured. Please contact support." },
          { status: 503, headers: SECURITY_HEADERS }
        );
      }
      if (buyerAgreementState.status !== "accepted") {
        return NextResponse.json(
          { error: "Buyer agreement must be accepted before checkout" },
          { status: 403, headers: SECURITY_HEADERS }
        );
      }
    }

    // Check for existing payment with idempotency key
    if (idempotencyKey) {
      const existingPayment = await convex.query(api.payments.getByIdempotencyKey, {
        idempotencyKey,
        userId,
      });
      if (existingPayment) {
        // TTL varies by status: completed payments cached longer to prevent double-charging
        const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes for pending
        const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for completed
        const ttl = existingPayment.status === "pending" ? PENDING_TTL_MS : COMPLETED_TTL_MS;
        const isStale = existingPayment.createdAt && (Date.now() - existingPayment.createdAt > ttl);
        
        if (!isStale) {
          // Return existing payment regardless of status to ensure idempotency
          if (existingPayment.status === "success") {
            // Already paid - prevent double-charging
            return NextResponse.json(
              {
                success: true,
                message: "Payment already completed",
                txRef: existingPayment.chapaTransactionRef,
                paymentId: existingPayment._id,
                status: existingPayment.status,
                cached: true,
              },
              { headers: { ...SECURITY_HEADERS, ...createRateLimitHeaders(rateLimitResult) } }
            );
          }
          if (existingPayment.status === "pending" && existingPayment.checkoutUrl) {
            // Still pending - return checkout URL
            return NextResponse.json(
              {
                success: true,
                checkoutUrl: existingPayment.checkoutUrl,
                txRef: existingPayment.chapaTransactionRef,
                paymentId: existingPayment._id,
                cached: true,
              },
              { headers: { ...SECURITY_HEADERS, ...createRateLimitHeaders(rateLimitResult) } }
            );
          }
          // Failed payments within TTL - allow retry with new idempotency key
        }
      }
    }

    // Create payment record in Convex (also snapshots cart for order payments)
    const payment = await convex.mutation(api.payments.create, {
      amount,
      currency,
      paymentType,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      idempotencyKey,
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Failed to create payment record" },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }

    // Get base URL for callbacks - use configured URL in production, fallback only in dev
    const isDevelopment = process.env.NODE_ENV === "development";
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    if (!configuredUrl && !isDevelopment) {
      console.error("NEXT_PUBLIC_APP_URL not configured in production");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }
    
    const baseUrl = configuredUrl || "http://localhost:3000";

    const urls = getPaymentUrls(baseUrl, payment.txRef);

    // Parse user name
    const firstName = user.firstName || user.username || "Customer";
    const lastName = user.lastName || "";
    const email = user.emailAddresses[0]?.emailAddress || "";

    // Initialize Chapa payment
    const chapaResponse = await initializePayment({
      amount: amount.toString(),
      currency,
      email,
      first_name: firstName,
      last_name: lastName,
      tx_ref: payment.txRef,
      callback_url: urls.callback_url,
      return_url: urls.return_url,
      customization: {
        title: "AfriConnect",
        description:
          paymentType === "subscription" ? "Subscription Payment" : "Order Payment",
      },
      meta: {
        payment_id: payment._id?.toString() || "",
        user_id: userId,
        payment_type: paymentType,
        ...(idempotencyKey && { idempotency_key: idempotencyKey }),
      },
    });

    // Store checkout URL for idempotency cache
    if (payment._id && chapaResponse.data.checkout_url) {
      await convex.mutation(api.payments.updateCheckoutUrl, {
        paymentId: payment._id,
        checkoutUrl: chapaResponse.data.checkout_url,
      });
    }

    return NextResponse.json(
      {
        success: true,
        checkoutUrl: chapaResponse.data.checkout_url,
        txRef: payment.txRef,
        paymentId: payment._id,
      },
      {
        headers: {
          ...SECURITY_HEADERS,
          ...createRateLimitHeaders(rateLimitResult),
        },
      }
    );
  } catch (error) {
    console.error("Payment initialization error:", error);

    if (error instanceof ChapaError) {
      // Don't expose internal Chapa error details to client
      return NextResponse.json(
        { error: "Payment service temporarily unavailable" },
        { status: error.statusCode === 400 ? 400 : 503, headers: SECURITY_HEADERS }
      );
    }

    // Generic error - don't expose internal details
    return NextResponse.json(
      { error: "Failed to initialize payment" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
