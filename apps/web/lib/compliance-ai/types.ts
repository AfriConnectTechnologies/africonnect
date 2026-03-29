export type ComplianceAiGenerationProvider = "openai" | "gemini" | "anthropic";
export type ComplianceTranslationLanguage = "en" | "am" | "om" | "sw";

export interface ComplianceAssistantFilters {
  country?: string;
  jurisdiction?: string;
  language?: string;
  documentType?: string;
}

export interface ComplianceCitation {
  id: string;
  documentTitle: string;
  locator: string;
  excerpt: string;
  sourceUrl?: string;
  score?: number;
}

export interface ComplianceChunk {
  id: string;
  text: string;
  score: number;
  documentTitle: string;
  locator: string;
  sourceUrl?: string;
  country?: string;
  jurisdiction?: string;
  language?: string;
  documentType?: string;
}

export interface ComplianceAiProviderSummary {
  vectorStore: string;
  embeddingModel: string;
  rerankerModel?: string;
  generationProvider?: ComplianceAiGenerationProvider;
  generationModel?: string;
}

export interface ComplianceAssistantAnswer {
  status: "ready" | "not_configured" | "no_evidence";
  mode: "full-rag" | "retrieval-only";
  answer: string;
  citations: ComplianceCitation[];
  warning?: string;
  providerSummary: ComplianceAiProviderSummary;
}

export type ComplianceAssistantStreamEvent =
  | {
      type: "metadata";
      answer: Pick<ComplianceAssistantAnswer, "status" | "mode" | "providerSummary">;
    }
  | {
      type: "delta";
      delta: string;
    }
  | {
      type: "complete";
      answer: ComplianceAssistantAnswer;
    }
  | {
      type: "error";
      error: string;
    };

export interface ComplianceAiRuntimeStatus {
  enabled: boolean;
  retrievalReady: boolean;
  generationReady: boolean;
  missing: string[];
  providerSummary: ComplianceAiProviderSummary;
}
