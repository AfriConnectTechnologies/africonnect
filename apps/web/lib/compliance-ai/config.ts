import { z } from "zod";

import type {
  ComplianceAiGenerationProvider,
  ComplianceAiProviderSummary,
  ComplianceAiRuntimeStatus,
} from "@/lib/compliance-ai/types";

const generationProviderSchema = z.enum(["openai", "gemini", "anthropic"]);

export interface ComplianceAiConfig {
  qdrantUrl: string;
  qdrantApiKey?: string;
  qdrantCollection: string;
  qdrantTimeout: number;
  embeddingModel: string;
  embeddingDimension?: number;
  rerankerModel?: string;
  generationProvider?: ComplianceAiGenerationProvider;
  generationModel?: string;
  generationApiKey?: string;
  voyageApiKey: string;
  topK: number;
}

const DEFAULT_EMBEDDING_MODEL = "voyage-4";
const DEFAULT_RERANKER_MODEL = "rerank-2.5-lite";
const DEFAULT_GENERATION_PROVIDER: ComplianceAiGenerationProvider = "openai";
const DEFAULT_GENERATION_MODEL = "gpt-5-mini";
const DEFAULT_TOP_K = 8;
const DEFAULT_EMBEDDING_DIMENSION = 1024;
const DEFAULT_QDRANT_TIMEOUT_MS = 10000;

function getGenerationProvider(): ComplianceAiGenerationProvider {
  const parsed = generationProviderSchema.safeParse(
    process.env.COMPLIANCE_AI_GENERATION_PROVIDER ?? DEFAULT_GENERATION_PROVIDER
  );

  return parsed.success ? parsed.data : DEFAULT_GENERATION_PROVIDER;
}

function getGenerationApiKey(
  provider: ComplianceAiGenerationProvider
): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

function getProviderSummary(
  generationProvider?: ComplianceAiGenerationProvider,
  generationModel?: string
): ComplianceAiProviderSummary {
  return {
    vectorStore: "Qdrant",
    embeddingModel:
      process.env.COMPLIANCE_AI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    rerankerModel:
      process.env.COMPLIANCE_AI_RERANK_MODEL ?? DEFAULT_RERANKER_MODEL,
    generationProvider,
    generationModel,
  };
}

export function isComplianceAiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_COMPLIANCE_AI === "true";
}

export function getComplianceAiRuntimeStatus(): ComplianceAiRuntimeStatus {
  const enabled = isComplianceAiEnabled();
  const generationProvider = getGenerationProvider();
  const generationModel =
    process.env.COMPLIANCE_AI_GENERATION_MODEL ?? DEFAULT_GENERATION_MODEL;

  const providerSummary = getProviderSummary(generationProvider, generationModel);

  if (!enabled) {
    return {
      enabled: false,
      retrievalReady: false,
      generationReady: false,
      missing: ["NEXT_PUBLIC_ENABLE_COMPLIANCE_AI"],
      providerSummary,
    };
  }

  const retrievalMissing: string[] = [];
  if (!process.env.COMPLIANCE_AI_QDRANT_URL) {
    retrievalMissing.push("COMPLIANCE_AI_QDRANT_URL");
  }
  if (!process.env.COMPLIANCE_AI_QDRANT_COLLECTION) {
    retrievalMissing.push("COMPLIANCE_AI_QDRANT_COLLECTION");
  }
  if (!process.env.VOYAGE_API_KEY) {
    retrievalMissing.push("VOYAGE_API_KEY");
  }

  const generationMissing: string[] = [];
  if (!getGenerationApiKey(generationProvider)) {
    generationMissing.push(
      generationProvider === "openai"
        ? "OPENAI_API_KEY"
        : generationProvider === "gemini"
          ? "GEMINI_API_KEY"
          : "ANTHROPIC_API_KEY"
    );
  }

  return {
    enabled,
    retrievalReady: retrievalMissing.length === 0,
    generationReady: generationMissing.length === 0,
    missing: [...retrievalMissing, ...generationMissing],
    providerSummary,
  };
}

export function getComplianceAiConfig(): ComplianceAiConfig {
  const status = getComplianceAiRuntimeStatus();
  if (!status.enabled || !status.retrievalReady) {
    throw new Error(
      `Compliance AI is not configured. Missing: ${status.missing.join(", ")}`
    );
  }

  const generationProvider = getGenerationProvider();
  const generationModel =
    process.env.COMPLIANCE_AI_GENERATION_MODEL ?? DEFAULT_GENERATION_MODEL;
  const parsedTopK = Number(process.env.COMPLIANCE_AI_TOP_K ?? DEFAULT_TOP_K);
  const parsedEmbeddingDimension = Number(
    process.env.COMPLIANCE_AI_EMBEDDING_DIMENSION ?? DEFAULT_EMBEDDING_DIMENSION
  );
  const parsedQdrantTimeout = Number(
    process.env.COMPLIANCE_AI_QDRANT_TIMEOUT ?? DEFAULT_QDRANT_TIMEOUT_MS
  );

  return {
    qdrantUrl: process.env.COMPLIANCE_AI_QDRANT_URL!,
    qdrantApiKey: process.env.COMPLIANCE_AI_QDRANT_API_KEY,
    qdrantCollection: process.env.COMPLIANCE_AI_QDRANT_COLLECTION!,
    qdrantTimeout:
      Number.isFinite(parsedQdrantTimeout) && parsedQdrantTimeout > 0
        ? parsedQdrantTimeout
        : DEFAULT_QDRANT_TIMEOUT_MS,
    embeddingModel:
      process.env.COMPLIANCE_AI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    embeddingDimension:
      Number.isFinite(parsedEmbeddingDimension) && parsedEmbeddingDimension > 0
        ? parsedEmbeddingDimension
        : DEFAULT_EMBEDDING_DIMENSION,
    rerankerModel:
      process.env.COMPLIANCE_AI_RERANK_MODEL ?? DEFAULT_RERANKER_MODEL,
    generationProvider: status.generationReady ? generationProvider : undefined,
    generationModel: status.generationReady ? generationModel : undefined,
    generationApiKey: status.generationReady
      ? getGenerationApiKey(generationProvider)
      : undefined,
    voyageApiKey: process.env.VOYAGE_API_KEY!,
    topK: Number.isFinite(parsedTopK) && parsedTopK > 0 ? parsedTopK : DEFAULT_TOP_K,
  };
}
