import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { z } from "zod";
import { Id } from "@/convex/_generated/dataModel";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
};

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

const impersonateSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export async function POST(request: NextRequest) {
  try {
    const { userId: adminClerkId, getToken } = await auth();
    if (!adminClerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get("user-agent") || undefined;
    const convex = new ConvexHttpClient(convexUrl);
    const logImpersonationAudit = async (
      status: string,
      metadata?: Record<string, unknown>,
      errorMessage?: string
    ) => {
      try {
        await convex.mutation(api.paymentAuditLogs.create, {
          action: "admin_impersonation",
          status,
          userId: adminClerkId,
          ipAddress,
          userAgent,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
          errorMessage,
        });
      } catch (error) {
        console.error("Failed to create impersonation audit log:", error);
      }
    };

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const validation = impersonateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Validation failed" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const { userId } = validation.data;

    if (!/^[a-zA-Z0-9_]+$/.test(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const token = await getToken({ template: "convex" });
    if (!token) {
      await logImpersonationAudit(
        "failed",
        { targetUserId: userId },
        "Authentication failed"
      );
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }
    convex.setAuth(token);

    const admin = await convex.query(api.users.getCurrentUser);
    if (!admin || admin.role !== "admin") {
      await logImpersonationAudit(
        "failed",
        { targetUserId: userId, adminUserId: admin?._id, adminRole: admin?.role },
        "Admin access required"
      );
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403, headers: SECURITY_HEADERS }
      );
    }

    const targetUser = await convex.query(api.users.getUser, {
      userId: userId as Id<"users">,
    });

    if (!targetUser) {
      await logImpersonationAudit(
        "failed",
        { targetUserId: userId, adminUserId: admin._id },
        "User not found"
      );
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: SECURITY_HEADERS }
      );
    }

    if (targetUser._id === admin._id) {
      await logImpersonationAudit(
        "failed",
        {
          targetUserId: userId,
          adminUserId: admin._id,
        },
        "Already signed in as this user"
      );
      return NextResponse.json(
        { error: "You are already signed in as this user" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const clerk = await clerkClient();
    const signInToken = await clerk.signInTokens.createSignInToken({
      userId: targetUser.clerkId,
      expiresInSeconds: 10 * 60,
    });

    await logImpersonationAudit("success", {
      targetUserId: userId,
      targetClerkId: targetUser.clerkId,
      adminUserId: admin._id,
    });

    return NextResponse.json(
      { url: signInToken.url },
      { status: 200, headers: SECURITY_HEADERS }
    );
  } catch (error) {
    console.error("Impersonation failed:", error);
    return NextResponse.json(
      { error: "Failed to impersonate user" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
