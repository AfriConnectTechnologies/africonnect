import { getComplianceAiConfig } from "@/lib/compliance-ai/config";
import type {
  ComplianceAssistantFilters,
  ComplianceChunk,
} from "@/lib/compliance-ai/types";

type QdrantPayload = Record<string, unknown>;

export class QdrantSearchError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "QdrantSearchError";
    this.statusCode = statusCode;
  }
}

function getTextFromPayload(payload: QdrantPayload): string {
  const candidates = ["text", "chunk_text", "content", "body"];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getLocatorFromPayload(payload: QdrantPayload): string {
  const explicit =
    payload.article_or_section ??
    payload.section_title ??
    payload.annex_or_schedule ??
    payload.section ??
    payload.heading;

  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }

  const pageStart = payload.page_start;
  if (typeof pageStart === "number") {
    return `Page ${pageStart}`;
  }

  return "Relevant section";
}

function buildFilter(filters?: ComplianceAssistantFilters) {
  if (!filters) {
    return undefined;
  }

  const must = [
    filters.country
      ? { key: "country", match: { value: filters.country } }
      : null,
    filters.jurisdiction
      ? { key: "jurisdiction", match: { value: filters.jurisdiction } }
      : null,
    filters.language
      ? { key: "language", match: { value: filters.language } }
      : null,
    filters.documentType
      ? { key: "document_type", match: { value: filters.documentType } }
      : null,
  ].filter(Boolean);

  return must.length > 0 ? { must } : undefined;
}

export async function searchComplianceChunks(
  vector: number[],
  filters?: ComplianceAssistantFilters
): Promise<ComplianceChunk[]> {
  const config = getComplianceAiConfig();
  const endpoint = `${config.qdrantUrl.replace(/\/$/, "")}/collections/${config.qdrantCollection}/points/search`;
  const controller = new AbortController();
  const timeoutMs = config.qdrantTimeout || 10000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.qdrantApiKey ? { "api-key": config.qdrantApiKey } : {}),
      },
      body: JSON.stringify({
        vector,
        limit: config.topK,
        with_payload: true,
        with_vector: false,
        filter: buildFilter(filters),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new QdrantSearchError(
        `Qdrant search timed out after ${timeoutMs}ms`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const responseText = await response.text();
    let details = "";

    try {
      const parsed = JSON.parse(responseText) as {
        status?: { error?: string } | string;
      };

      if (typeof parsed.status === "string") {
        details = parsed.status;
      } else if (parsed.status?.error) {
        details = parsed.status.error;
      }
    } catch {
      details = responseText.trim();
    }

    if (response.status === 404) {
      throw new QdrantSearchError(
        details
          ? `Qdrant collection "${config.qdrantCollection}" was not found. ${details}`
          : `Qdrant collection "${config.qdrantCollection}" was not found.`,
        response.status
      );
    }

    throw new QdrantSearchError(
      details
        ? `Qdrant search failed with status ${response.status}: ${details}`
        : `Qdrant search failed with status ${response.status}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    result?: Array<{
      id: string | number;
      score: number;
      payload?: QdrantPayload;
    }>;
  };

  return (data.result ?? [])
    .map((point, index) => {
      const payload = point.payload ?? {};
      const text = getTextFromPayload(payload);
      const title =
        (typeof payload.document_title === "string" && payload.document_title) ||
        (typeof payload.title === "string" && payload.title) ||
        "Uploaded compliance document";

      return {
        id: String(point.id ?? index),
        text,
        score: point.score ?? 0,
        documentTitle: title,
        locator: getLocatorFromPayload(payload),
        sourceUrl:
          typeof payload.source_url === "string" ? payload.source_url : undefined,
        country: typeof payload.country === "string" ? payload.country : undefined,
        jurisdiction:
          typeof payload.jurisdiction === "string"
            ? payload.jurisdiction
            : undefined,
        language:
          typeof payload.language === "string" ? payload.language : undefined,
        documentType:
          typeof payload.document_type === "string"
            ? payload.document_type
            : undefined,
      };
    })
    .filter((chunk) => chunk.text.length > 0);
}
