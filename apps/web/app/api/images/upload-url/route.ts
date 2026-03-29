import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getPresignedUploadUrl,
  generateImageKey,
  generateBusinessDocKey,
  getPublicUrl,
  isValidImageType,
  isValidDocumentType,
  isR2Configured,
  MAX_FILE_SIZE,
} from "@/lib/r2";

const BUSINESS_REGISTRATION_DOC_TYPES = [
  "business-licence",
  "memo-of-association",
  "tin-certificate",
  "import-export-permit",
] as const;

export async function POST(request: NextRequest) {
  try {
    // Check if R2 is configured
    if (!isR2Configured()) {
      return NextResponse.json(
        { 
          error: "Image upload is not configured. Please set up R2 environment variables.",
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
    const { productId, filename, contentType, fileSize, context, docType } = body;

    const isBusinessRegistration =
      context === "business-registration" &&
      docType &&
      BUSINESS_REGISTRATION_DOC_TYPES.includes(docType);

    if (isBusinessRegistration) {
      // Business registration document upload (no productId)
      if (!filename || !contentType) {
        return NextResponse.json(
          { error: "Missing required fields: filename, contentType" },
          { status: 400 }
        );
      }
    } else {
      // Product image upload (existing flow)
      if (!productId || !filename || !contentType) {
        return NextResponse.json(
          { error: "Missing required fields: productId, filename, contentType" },
          { status: 400 }
        );
      }
    }

    // Validate content type (business docs allow images + PDF; product images allow images only)
    if (isBusinessRegistration) {
      if (!isValidDocumentType(contentType)) {
        return NextResponse.json(
          { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF" },
          { status: 400 }
        );
      }
    } else {
      if (!isValidImageType(contentType)) {
        return NextResponse.json(
          { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
          { status: 400 }
        );
      }
    }

    // Validate file size
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    const key = isBusinessRegistration
      ? generateBusinessDocKey(userId, docType, filename)
      : generateImageKey(productId, filename);

    // Get presigned upload URL
    const uploadUrl = await getPresignedUploadUrl(key, contentType);

    // Get the public URL for after upload
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl,
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check for specific error types
    if (errorMessage.includes("Missing R2 configuration")) {
      return NextResponse.json(
        { 
          error: "Image upload is not configured. Please contact support.",
          code: "R2_NOT_CONFIGURED"
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
