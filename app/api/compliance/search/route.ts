import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { promises as fs } from "fs";
import path from "path";
import { COMPLIANCE_ENABLED, isComplianceEnabledForEmail } from "@/lib/features";

type TariffCountry = "ethiopia" | "kenya";

// Normalized type for HS code entry (unified format for both countries)
interface NormalizedHSCodeEntry {
  hs_code: string;
  english_name: string;
  amharic_name: string;
  category: string;
  rates: {
    "2026": string;
    "2027": string;
    "2028": string;
    "2029": string;
    "2030": string;
  };
  base_rate?: string;
  unit?: string;
  matched?: boolean;
  source_documents?: string[];
}

// Ethiopia data structure
interface EthiopiaHSCodeEntry {
  hs_code: string;
  english_name: string;
  amharic_name: string;
  category: string;
  unit?: string;
  base_rate?: string;
  matched?: boolean;
  source_documents?: string[];
  rates: {
    "2026": string;
    "2027": string;
    "2028": string;
    "2029": string;
    "2030": string;
  };
}

// EAC/Kenya data structure
interface EACHSCodeEntry {
  hs_code: string;
  description: string;
  unit: string;
  base_rate: string;
  category: string;
  rates: {
    "2026": string;
    "2027": string;
    "2028": string;
    "2029": string;
    "2030": string;
  };
}

// Cache for loaded data (separate cache per country)
const dataCache: Record<TariffCountry, NormalizedHSCodeEntry[] | null> = {
  ethiopia: null,
  kenya: null,
};

// Strip percentage sign and return clean number string
function stripPercentage(value: string): string {
  return value.replace(/%/g, "").trim();
}

// Normalize Ethiopia data
function normalizeEthiopiaData(data: EthiopiaHSCodeEntry[]): NormalizedHSCodeEntry[] {
  return data.map((item) => ({
    hs_code: item.hs_code,
    english_name: item.english_name,
    amharic_name: item.amharic_name,
    category: item.category,
    rates: item.rates,
    unit: item.unit,
    base_rate: item.base_rate,
    matched: item.matched ?? true,
    source_documents: item.source_documents,
  }));
}

// Normalize EAC/Kenya data
function normalizeEACData(data: EACHSCodeEntry[]): NormalizedHSCodeEntry[] {
  return data.map((item) => ({
    hs_code: item.hs_code,
    english_name: item.description,
    amharic_name: "", // EAC doesn't have Amharic names
    category: item.category,
    rates: {
      "2026": stripPercentage(item.rates["2026"]),
      "2027": stripPercentage(item.rates["2027"]),
      "2028": stripPercentage(item.rates["2028"]),
      "2029": stripPercentage(item.rates["2029"]),
      "2030": stripPercentage(item.rates["2030"]),
    },
    base_rate: stripPercentage(item.base_rate),
    unit: item.unit,
    matched: true,
  }));
}

function getTariffSource(country: TariffCountry, entry?: NormalizedHSCodeEntry | null): string {
  if (country === "kenya") {
    return "eac_category_a_2026_2030.json";
  }

  if (entry?.source_documents?.length) {
    return entry.source_documents.join(" + ");
  }

  return entry?.matched === false
    ? "Legacy Ethiopia tariff dataset"
    : "Vol 1 - English -.docx + Vol 2 - English -.docx";
}

async function loadHSCodeData(country: TariffCountry): Promise<NormalizedHSCodeEntry[]> {
  if (dataCache[country]) {
    return dataCache[country]!;
  }

  const fileName = country === "ethiopia" 
    ? "ethiopia_vol_1_2_category_a_2026_2030.json" 
    : "eac_category_a_2026_2030.json";
  
  const filePath = path.join(process.cwd(), fileName);
  const fileContent = await fs.readFile(filePath, "utf-8");
  const rawData = JSON.parse(fileContent);

  // Normalize based on country
  const normalizedData = country === "ethiopia"
    ? normalizeEthiopiaData(rawData as EthiopiaHSCodeEntry[])
    : normalizeEACData(rawData as EACHSCodeEntry[]);

  dataCache[country] = normalizedData;
  return normalizedData;
}

export async function GET(request: NextRequest) {
  try {
    const clerkUser = COMPLIANCE_ENABLED ? null : await currentUser();
    const userEmail = clerkUser?.emailAddresses[0]?.emailAddress;

    if (!isComplianceEnabledForEmail(userEmail)) {
      return NextResponse.json(
        { error: "Compliance tools are currently unavailable." },
        { status: 503 }
      );
    }
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.toLowerCase().trim() || "";
    const hsCode = searchParams.get("hs_code")?.trim() || "";
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const country = (searchParams.get("country") || "ethiopia") as TariffCountry;

    // Validate country parameter
    if (country !== "ethiopia" && country !== "kenya") {
      return NextResponse.json({
        success: false,
        error: "Invalid country. Must be 'ethiopia' or 'kenya'",
      }, { status: 400 });
    }

    const data = await loadHSCodeData(country);

    // If looking up a specific HS code
    if (hsCode) {
      // For Kenya/EAC, also try matching with dots removed or added
      const normalizedHsCode = hsCode.replace(/\./g, "");
      const entry = data.find((item) => {
        const itemNormalized = item.hs_code.replace(/\./g, "");
        return item.hs_code === hsCode || itemNormalized === normalizedHsCode;
      });
      
      if (entry) {
        const scheduleMatched = entry.matched ?? true;
        return NextResponse.json({
          success: true,
          data: entry,
          isCompliant: scheduleMatched, // Legacy compatibility for existing consumers
          tariffScheduleStatus: scheduleMatched ? "matched" : "not_matched",
          tariffSource: getTariffSource(country, entry),
          country,
        });
      } else {
        return NextResponse.json({
          success: true,
          data: null,
          isCompliant: false, // Legacy compatibility for existing consumers
          tariffScheduleStatus: "not_matched",
          tariffSource: getTariffSource(country),
          country,
        });
      }
    }

    // Search by query (name or HS code)
    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "Please enter at least 2 characters to search",
        country,
      });
    }

    const normalizedQuery = query.replace(/\./g, ""); // Remove dots for HS code matching
    
    const results = data
      .filter((item) => {
        const matchesName = item.english_name.toLowerCase().includes(query) ||
          (item.amharic_name && item.amharic_name.includes(query));
        const itemCodeNormalized = item.hs_code.replace(/\./g, "");
        const matchesCode = item.hs_code.includes(query) || 
          itemCodeNormalized.includes(normalizedQuery);
        return matchesName || matchesCode;
      })
      .slice(0, limit)
      .map((item) => {
        const scheduleMatched = item.matched ?? true;

        return {
          hsCode: item.hs_code,
          englishName: item.english_name,
          amharicName: item.amharic_name,
          category: item.category,
          rates: item.rates,
          currentRate: item.rates["2026"], // Current year
          baseRate: item.base_rate,
          unit: item.unit,
          tariffCategory: item.category,
          tariffScheduleStatus: scheduleMatched ? "matched" : "not_matched",
          tariffSource: getTariffSource(country, item),
        };
      });

    return NextResponse.json({
      success: true,
      results,
      total: results.length,
      country,
    });
  } catch (error) {
    console.error("Compliance search API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search HS codes",
      },
      { status: 500 }
    );
  }
}
