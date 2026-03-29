import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getObject, getKeyFromPublicUrl, isR2Configured } from "@/lib/r2";
import { Readable } from "stream";

export async function GET(request: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const convex = new ConvexHttpClient(convexUrl);
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }
    convex.setAuth(token);

    const currentUser = await convex.query(api.users.getCurrentUser);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const url = request.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      );
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "Document storage is not configured" },
        { status: 503 }
      );
    }

    const key = getKeyFromPublicUrl(url);
    if (!key) {
      return NextResponse.json(
        { error: "Invalid or unauthorized document URL" },
        { status: 400 }
      );
    }

    const allowed = await convex.query(api.businesses.isDocumentUrlAllowed, {
      url,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Document not found or access denied" },
        { status: 404 }
      );
    }

    const { body, contentType } = await getObject(key);
    const webStream = Readable.toWeb(body) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Document view error:", error);
    if (error instanceof Error && error.message === "Object not found or empty") {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load document" },
      { status: 500 }
    );
  }
}
