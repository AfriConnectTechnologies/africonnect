import { NextRequest, NextResponse } from "next/server";

type ExchangeApiResponse = {
  result?: "success" | "error";
  time_last_update_utc?: string;
  rates?: Record<string, number>;
};

const SUPPORTED_TARGETS = ["USD", "ETB", "KES"] as const;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const from = (params.get("from") || "ETB").toUpperCase();
    const amount = Number(params.get("amount") || "0");

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a number greater than 0." },
        { status: 400 }
      );
    }

    const response = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to fetch exchange rates right now." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as ExchangeApiResponse;
    if (data.result !== "success" || !data.rates) {
      return NextResponse.json(
        { error: "Invalid exchange-rate response." },
        { status: 502 }
      );
    }

    const converted = SUPPORTED_TARGETS.reduce<Record<string, number>>(
      (acc, currency) => {
        const rate = data.rates?.[currency];
        if (typeof rate === "number") {
          acc[currency] = Number((amount * rate).toFixed(2));
        }
        return acc;
      },
      {}
    );

    return NextResponse.json({
      from,
      amount,
      converted,
      rates: {
        USD: data.rates.USD,
        KES: data.rates.KES,
      },
      asOf: data.time_last_update_utc || new Date().toUTCString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected error while converting currency." },
      { status: 500 }
    );
  }
}
