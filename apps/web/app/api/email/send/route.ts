import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Email service not configured" },
        { status: 500 }
      );
    }
    
    // Import email module dynamically
    const { sendEmail } = await import("@/lib/email/send");
    
    // Validate payload has a type
    if (!payload.type) {
      return NextResponse.json(
        { success: false, error: "Missing email type" },
        { status: 400 }
      );
    }

    // Validate required fields based on type
    switch (payload.type) {
      case "welcome":
        if (!payload.to) {
          return NextResponse.json(
            { success: false, error: "Missing recipient email" },
            { status: 400 }
          );
        }
        break;

      case "email-verification":
        if (!payload.to || !payload.verificationToken) {
          return NextResponse.json(
            { success: false, error: "Missing recipient email or verification token" },
            { status: 400 }
          );
        }
        break;

      case "business-registered":
        if (!payload.to || !payload.businessName || !payload.category || !payload.country) {
          return NextResponse.json(
            { success: false, error: "Missing required fields for business registration email" },
            { status: 400 }
          );
        }
        break;

      case "business-verified":
      case "business-rejected":
        if (!payload.to || !payload.businessName) {
          return NextResponse.json(
            { success: false, error: "Missing required fields for business verification email" },
            { status: 400 }
          );
        }
        break;

      case "admin-new-business":
        if (!payload.businessName || !payload.ownerEmail || !payload.category || !payload.country) {
          return NextResponse.json(
            { success: false, error: "Missing required fields for admin notification email" },
            { status: 400 }
          );
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Unknown email type" },
          { status: 400 }
        );
    }

    const result = await sendEmail(payload);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      },
      { status: 500 }
    );
  }
}
