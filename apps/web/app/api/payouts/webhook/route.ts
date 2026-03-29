import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { verifyTransfer, ChapaError } from "@/lib/chapa";
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

    const webhookSecret = process.env.CHAPA_TRANSFER_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }

    if (!signature || !verifySignature(rawPayload, signature, webhookSecret)) {
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

    let verifiedStatus: string | undefined;
    let chapaReference = (payload?.chapa_reference as string | undefined) || (payloadData?.chapa_reference as string | undefined);
    let bankReference = (payload?.bank_reference as string | undefined) || (payloadData?.bank_reference as string | undefined);

    try {
      const verification = await verifyTransfer(reference);
      if (!verification?.data?.status) {
        return NextResponse.json(
          { error: "Transfer verification unavailable" },
          { status: 502, headers: SECURITY_HEADERS }
        );
      }
      if (verification?.data?.status) {
        verifiedStatus = verification.data.status;
      }
      if (verification?.data?.chapa_reference) {
        chapaReference = verification.data.chapa_reference;
      }
      if (verification?.data?.bank_reference) {
        bankReference = verification.data.bank_reference;
      }
    } catch (error) {
      if (error instanceof ChapaError) {
        console.error("Transfer verification failed:", error.response);
      } else {
        console.error("Transfer verification failed:", error);
      }
      return NextResponse.json(
        { error: "Transfer verification failed" },
        { status: 502, headers: SECURITY_HEADERS }
      );
    }

    if (!verifiedStatus) {
      return NextResponse.json(
        { error: "Transfer verification unavailable" },
        { status: 502, headers: SECURITY_HEADERS }
      );
    }

    let payoutStatus: "queued" | "approved" | "success" | "failed" | "reverted";
    switch (String(verifiedStatus).toLowerCase()) {
      case "success":
      case "successful":
        payoutStatus = "success";
        break;
      case "approved":
        payoutStatus = "approved";
        break;
      case "pending":
        payoutStatus = "queued";
        break;
      case "reverted":
      case "reversed":
        payoutStatus = "reverted";
        break;
      default:
        payoutStatus = "failed";
    }

    await convex.action(api.payouts.setPayoutStatusFromWebhook, {
      payoutId: payout._id,
      status: payoutStatus,
      chapaReference,
      bankReference,
    });

    return NextResponse.json(
      { success: true, status: payoutStatus },
      { headers: SECURITY_HEADERS }
    );
  } catch (error) {
    console.error("Payout webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process payout webhook" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
