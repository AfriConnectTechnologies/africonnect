import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing verification token" },
        { status: 400 }
      );
    }

    const result = await convex.mutation(api.verification.verifyEmailToken, { token });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      email: result.email,
      message: "Email verified successfully" 
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify email",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing verification token" },
        { status: 400 }
      );
    }

    const result = await convex.mutation(api.verification.verifyEmailToken, { token });

    if (!result.success) {
      // Redirect to verification page with error
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      return NextResponse.redirect(`${baseUrl}/verify-email?error=${encodeURIComponent(result.error || "Verification failed")}`);
    }

    // Redirect to success page
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(`${baseUrl}/verify-email?success=true`);
  } catch (error) {
    console.error("Email verification error:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(`${baseUrl}/verify-email?error=${encodeURIComponent("Verification failed")}`);
  }
}
