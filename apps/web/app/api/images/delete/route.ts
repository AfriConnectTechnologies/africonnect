import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteObject, isR2Configured } from "@/lib/r2";

export async function DELETE(request: NextRequest) {
  try {
    // Check if R2 is configured
    if (!isR2Configured()) {
      return NextResponse.json(
        { 
          error: "Image storage is not configured.",
          code: "R2_NOT_CONFIGURED"
        },
        { status: 503 }
      );
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { key } = body;

    if (!key) {
      return NextResponse.json(
        { error: "Missing required field: key" },
        { status: 400 }
      );
    }

    // Delete the object from R2
    await deleteObject(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("Missing R2 configuration")) {
      return NextResponse.json(
        { 
          error: "Image storage is not configured.",
          code: "R2_NOT_CONFIGURED"
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
