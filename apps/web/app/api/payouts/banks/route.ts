import { NextResponse } from "next/server";
import { getBanks, ChapaError } from "@/lib/chapa";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

export async function GET() {
  try {
    const banks = await getBanks();
    return NextResponse.json(banks, { headers: SECURITY_HEADERS });
  } catch (error) {
    if (error instanceof ChapaError) {
      return NextResponse.json(
        { error: "Unable to fetch banks" },
        { status: error.statusCode === 400 ? 400 : 503, headers: SECURITY_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch banks" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
