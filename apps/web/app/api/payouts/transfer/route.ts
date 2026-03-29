import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { COMMERCE_ENABLED } from "@/lib/features";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
};

export async function POST(request: NextRequest) {
  if (!COMMERCE_ENABLED) {
    return NextResponse.json(
      { error: "Payout features are currently unavailable. Coming soon!" },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }

  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    let body: { orderId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    if (!body.orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }
    convex.setAuth(token);

    const payout = await convex.action(api.payouts.transferForOrder, {
      orderId: body.orderId as Id<"orders">,
    });

    return NextResponse.json(
      { success: true, payout },
      { headers: SECURITY_HEADERS }
    );
  } catch (error) {
    console.error("Payout transfer error:", error);
    const message = error instanceof Error ? error.message : "Failed to initiate payout";
    const statusCode =
      message.toLowerCase().includes("unauthorized")
        ? 403
        : message.toLowerCase().includes("required") ||
          message.toLowerCase().includes("invalid")
        ? 400
        : 500;
    return NextResponse.json(
      { error: message },
      { status: statusCode, headers: SECURITY_HEADERS }
    );
  }
}
