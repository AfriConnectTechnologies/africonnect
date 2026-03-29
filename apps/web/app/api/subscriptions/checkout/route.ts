import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { initializePayment, getPaymentUrls, ChapaError } from "@/lib/chapa";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { COMMERCE_ENABLED } from "@/lib/features";
import {
  checkRateLimit,
  RateLimits,
  rateLimitExceededResponse,
  createRateLimitHeaders,
} from "@/lib/rate-limiter";
import {
  subscriptionCheckoutSchema,
  validatePaymentInput,
} from "@/lib/validators/payment";
import { Id } from "@/convex/_generated/dataModel";
import { USD_TO_ETB_RATE } from "@/lib/pricing";

// Security headers
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
      { error: "Subscription features are currently unavailable. Coming soon!" },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }

  try {
    // Check authentication
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(
      `subscription_checkout:${userId}`,
      RateLimits.SUBSCRIPTION_CHECKOUT
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

    // Validate input
    const validation = validatePaymentInput(subscriptionCheckoutSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const { planId, billingCycle, idempotencyKey } = validation.data;

    // Validate Convex URL exists
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      console.error("NEXT_PUBLIC_CONVEX_URL not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }

    // Create authenticated Convex client
    const convex = new ConvexHttpClient(convexUrl);
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { error: "Authentication failed - no valid token" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }
    convex.setAuth(token);

    // Get current user from Convex to check business
    const convexUser = await convex.query(api.users.getCurrentUser);
    if (!convexUser) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404, headers: SECURITY_HEADERS }
      );
    }

    if (!convexUser.businessId) {
      return NextResponse.json(
        { error: "You need to register a business first before subscribing" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Check if business already has an active subscription
    const existingSubscription = await convex.query(api.subscriptions.getByBusiness, {
      businessId: convexUser.businessId as Id<"businesses">,
    });

    if (
      existingSubscription &&
      (existingSubscription.status === "active" || existingSubscription.status === "trialing")
    ) {
      return NextResponse.json(
        {
          error: "Your business already has an active subscription",
          currentPlan: existingSubscription.plan?.name,
        },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Get plan details
    const plan = await convex.query(api.subscriptionPlans.getById, {
      planId: planId as Id<"subscriptionPlans">,
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404, headers: SECURITY_HEADERS }
      );
    }

    if (!plan.isActive) {
      return NextResponse.json(
        { error: "This plan is no longer available" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Handle enterprise plan (custom pricing)
    if (plan.slug === "enterprise") {
      return NextResponse.json(
        {
          error: "Enterprise plan requires custom pricing. Please contact sales.",
          contactSales: true,
        },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Calculate price based on billing cycle with validation
    const rawPrice = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
    
    // Validate price is a valid number
    if (rawPrice === undefined || rawPrice === null || isNaN(rawPrice) || rawPrice < 0) {
      console.error("Invalid plan price:", { planId, billingCycle, rawPrice });
      return NextResponse.json(
        { error: "Plan pricing is not properly configured" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }
    
    // Get currency subunit divisor (most currencies use 100, some like JPY use 1)
    const zeroDecimalCurrencies = ["JPY", "KRW", "VND"];
    const subunitDivisor = zeroDecimalCurrencies.includes(plan.currency) ? 1 : 100;
    
    const amountInPlanCurrency = rawPrice / subunitDivisor; // USD or ETB major units

    // Chapa uses ETB - convert USD to ETB when plan is in USD
    const chargeCurrency = plan.currency === "USD" ? "ETB" : plan.currency;
    const chargeAmount =
      plan.currency === "USD"
        ? Math.round(amountInPlanCurrency * USD_TO_ETB_RATE)
        : amountInPlanCurrency;

    // Create payment record in Convex (generates txRef/chapaTransactionRef; store actual charge amount in ETB for Chapa)
    const payment = await convex.mutation(api.payments.create, {
      amount: chargeAmount,
      currency: chargeCurrency,
      paymentType: "subscription",
      metadata: JSON.stringify({
        planId,
        planSlug: plan.slug,
        planName: plan.name,
        billingCycle,
        businessId: convexUser.businessId,
      }),
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
    
    // Validate email before proceeding to payment
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required for payment processing" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Initialize Chapa payment (Chapa uses ETB)
    const chapaResponse = await initializePayment({
      amount: chargeAmount.toString(),
      currency: chargeCurrency,
      email,
      first_name: firstName,
      last_name: lastName,
      tx_ref: payment.txRef,
      callback_url: urls.callback_url,
      return_url: `${baseUrl}/settings/subscription?tx_ref=${payment.txRef}&success=true`,
      customization: {
        title: "AfriConnect", // Max 16 chars
        description: `${plan.name} - ${billingCycle === "annual" ? "Annual" : "Monthly"}`,
      },
      meta: {
        payment_id: payment._id?.toString() || "",
        user_id: userId,
        payment_type: "subscription",
        plan_id: planId,
        plan_slug: plan.slug,
        billing_cycle: billingCycle,
        business_id: convexUser.businessId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        checkoutUrl: chapaResponse.data.checkout_url,
        txRef: payment.txRef,
        paymentId: payment._id,
        plan: {
          name: plan.name,
          billingCycle,
          amount: amountInPlanCurrency,
          currency: plan.currency,
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
    console.error("Subscription checkout error:", error);

    if (error instanceof ChapaError) {
      return NextResponse.json(
        { error: "Payment service temporarily unavailable" },
        { status: 503, headers: SECURITY_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "Failed to initialize subscription checkout" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
