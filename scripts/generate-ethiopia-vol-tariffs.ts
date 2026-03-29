import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import mammothModule from "mammoth";
import { JSDOM } from "jsdom";

type MammothApi = {
  convertToHtml: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

const mammoth = mammothModule as unknown as MammothApi;

interface ExistingCategoryAEntry {
  hs_code: string;
  english_name: string;
  amharic_name: string;
  category: string;
  rates: Record<string, string>;
}

interface ExtractedTariffRow {
  hs_code: string;
  english_name: string;
  unit?: string;
  base_rate: string;
}

interface OutputEntry {
  hs_code: string;
  english_name: string;
  amharic_name: string;
  category: "A";
  unit?: string;
  base_rate?: string;
  matched: boolean;
  source_documents: string[];
  rates: {
    "2026": string;
    "2027": string;
    "2028": string;
    "2029": string;
    "2030": string;
  };
}

const ROOT = process.cwd();
const VOL_1_PATH = path.join(ROOT, "pdfs", "Vol 1 - English -.docx");
const EXISTING_CATEGORY_A_PATH = path.join(ROOT, "category_a_detailed_2026_2030.json");
const OUTPUT_PATH = path.join(ROOT, "ethiopia_vol_1_2_category_a_2026_2030.json");
const VOL_1_SOURCE_DOCUMENT = path.basename(VOL_1_PATH);

const CATEGORY_A_FACTORS = {
  "2026": 0.4,
  "2027": 0.3,
  "2028": 0.2,
  "2029": 0.1,
  "2030": 0,
} as const;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeHsCode(value: string): string {
  return value.replace(/\D/g, "");
}

function parseDutyRate(value: string): number | null {
  const cleaned = normalizeText(value).replace(/%/g, "");
  if (!cleaned) {
    return null;
  }
  if (/^free$/i.test(cleaned)) {
    return 0;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRate(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(3).replace(/\.?0+$/, "");
}

async function extractVol1Rows(): Promise<Map<string, ExtractedTariffRow>> {
  const buffer = await readFile(VOL_1_PATH);
  const html = (await mammoth.convertToHtml({ buffer })).value;
  const dom = new JSDOM(html);
  const rows = [...dom.window.document.querySelectorAll("tr")];
  const extracted = new Map<string, ExtractedTariffRow>();

  for (const row of rows) {
    const cells = [...row.querySelectorAll("td, th")]
      .map((cell) => normalizeText(cell.textContent ?? ""))
      .filter(Boolean);

    if (cells.length < 4) {
      continue;
    }

    const tariffIndex = cells.findIndex((cell) => /^\d{4}\.\d{4}$/.test(cell));
    if (tariffIndex === -1) {
      continue;
    }

    const tariffNo = cells[tariffIndex]!;
    const description = cells[tariffIndex + 1] ?? "";
    const unit = cells[tariffIndex + 2] ?? "";
    const dutyCell = cells.at(-1) ?? "";
    const baseRate = parseDutyRate(dutyCell);

    if (!description || baseRate === null) {
      continue;
    }

    extracted.set(normalizeHsCode(tariffNo), {
      hs_code: normalizeHsCode(tariffNo),
      english_name: description,
      unit: unit || undefined,
      base_rate: formatRate(baseRate),
    });
  }

  return extracted;
}

function buildRates(baseRate: number) {
  return {
    "2026": formatRate(baseRate * CATEGORY_A_FACTORS["2026"]),
    "2027": formatRate(baseRate * CATEGORY_A_FACTORS["2027"]),
    "2028": formatRate(baseRate * CATEGORY_A_FACTORS["2028"]),
    "2029": formatRate(baseRate * CATEGORY_A_FACTORS["2029"]),
    "2030": formatRate(baseRate * CATEGORY_A_FACTORS["2030"]),
  };
}

async function main() {
  const existing = JSON.parse(
    await readFile(EXISTING_CATEGORY_A_PATH, "utf8")
  ) as ExistingCategoryAEntry[];
  const vol1Rows = await extractVol1Rows();
  const existingMap = new Map(
    existing.map((entry) => [normalizeHsCode(entry.hs_code), entry] as const)
  );
  const hsCodes = [...new Set([...vol1Rows.keys(), ...existingMap.keys()])];

  const output: OutputEntry[] = hsCodes.flatMap((normalizedHs) => {
    const docRow = vol1Rows.get(normalizedHs);
    const existingEntry = existingMap.get(normalizedHs);

    if (!docRow && !existingEntry) {
      return [];
    }

    const baseRate = docRow?.base_rate ? Number(docRow.base_rate) : null;

    return [
      {
        hs_code: docRow?.hs_code ?? existingEntry!.hs_code,
        english_name: docRow?.english_name ?? existingEntry!.english_name,
        amharic_name: existingEntry?.amharic_name ?? "",
        category: "A",
        ...(docRow?.unit ? { unit: docRow.unit } : {}),
        ...(docRow?.base_rate ? { base_rate: docRow.base_rate } : {}),
        matched: Boolean(docRow),
        source_documents: docRow ? [VOL_1_SOURCE_DOCUMENT] : [],
        rates:
          baseRate === null
            ? (existingEntry!.rates as OutputEntry["rates"])
            : buildRates(baseRate),
      },
    ];
  });

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Generated ${output.length} Ethiopia tariff rows at ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error("Failed to generate Ethiopia tariff data from Vol 1/Vol 2:", error);
  process.exit(1);
});
