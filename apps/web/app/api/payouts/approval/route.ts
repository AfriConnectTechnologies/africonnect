import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import crypto from "crypto";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedHex = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expectedHex, "hex");
  const normalized = signature.replace(/^sha256=/i, "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return false;
  }
  const signatureBuffer = Buffer.from(normalized, "hex");
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const rawPayload = await request.text();
    const signature =
      request.headers.get("x-chapa-signature") ||
      request.headers.get("chapa-signature") ||
      "";

    const approvalSecret = process.env.CHAPA_TRANSFER_APPROVAL_SECRET;

    if (!approvalSecret) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }

    if (!signature || !verifySignature(rawPayload, signature, approvalSecret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawPayload) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }
    const payloadData = payload?.data as Record<string, unknown> | undefined;
    const reference =
      (payload?.reference as string) ||
      (payloadData?.reference as string) ||
      (payload?.transfer_reference as string);

    if (!reference) {
      return NextResponse.json(
        { error: "Missing reference" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const payout = await convex.query(api.payouts.getByReference, { reference });

    if (!payout) {
      return NextResponse.json(
        { error: "Payout not found" },
        { status: 404, headers: SECURITY_HEADERS }
      );
    }

    if (payout.status === "success") {
      return NextResponse.json(
        { status: payout.status, reference },
        { headers: SECURITY_HEADERS }
      );
    }

    const rawAmount = (payload?.amount as unknown) ?? (payloadData?.amount as unknown);
    const parsedAmount =
      typeof rawAmount === "number"
        ? rawAmount
        : typeof rawAmount === "string"
          ? Number(rawAmount)
          : undefined;
    if (parsedAmount === undefined || Number.isNaN(parsedAmount)) {
      return NextResponse.json(
        { error: "Invalid payout amount" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }
    if (Math.abs(parsedAmount - payout.amountNet) > 0.01) {
      return NextResponse.json(
        { error: "Payout amount mismatch" },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    await convex.action(api.payouts.setPayoutStatusFromWebhook, {
      payoutId: payout._id,
      status: "approved",
      chapaReference: (payload?.chapa_reference as string | undefined) || payout.chapaReference,
      bankReference: (payload?.bank_reference as string | undefined) || payout.bankReference,
    });

    return NextResponse.json(
      { status: "approved", reference },
      { headers: SECURITY_HEADERS }
    );
  } catch (error) {
    console.error("Payout approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
