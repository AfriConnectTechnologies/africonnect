import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeStatus = {
  enabled: true,
  retrievalReady: true,
  generationReady: true,
  missing: [],
  providerSummary: {
    vectorStore: "Qdrant",
    embeddingModel: "voyage-4",
    rerankerModel: "rerank-2.5-lite",
    generationProvider: "openai" as const,
    generationModel: "gpt-5-mini",
  },
};

vi.mock("@/lib/compliance-ai/config", () => ({
  getComplianceAiRuntimeStatus: vi.fn(() => runtimeStatus),
  getComplianceAiConfig: vi.fn(() => ({
    qdrantUrl: "https://qdrant.example.com",
    qdrantCollection: "afcfta-compliance",
    voyageApiKey: "voyage-key",
    embeddingModel: "voyage-4",
    topK: 8,
  })),
}));

vi.mock("@/lib/compliance-ai/providers", () => ({
  embedComplianceQuery: vi.fn(async () => [0.1, 0.2, 0.3]),
  rerankComplianceChunks: vi.fn(async (_question: string, chunks: unknown[]) => chunks),
  generateComplianceAnswer: vi.fn(async () => null),
  chunkToCitation: vi.fn(),
}));

vi.mock("@/lib/compliance-ai/qdrant", async () => {
  const actual = await vi.importActual<typeof import("@/lib/compliance-ai/qdrant")>(
    "@/lib/compliance-ai/qdrant"
  );

  return {
    ...actual,
    searchComplianceChunks: vi.fn(),
  };
});

describe("askComplianceAssistant", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a safe not-configured response when the Qdrant collection is missing", async () => {
    const { askComplianceAssistant } = await import("@/lib/compliance-ai/service");
    const { searchComplianceChunks, QdrantSearchError } = await import(
      "@/lib/compliance-ai/qdrant"
    );

    vi.mocked(searchComplianceChunks).mockRejectedValue(
      new QdrantSearchError('Qdrant collection "afcfta-compliance" was not found.', 404)
    );

    const answer = await askComplianceAssistant(
      "What documents are needed for an AfCFTA certificate of origin?"
    );

    expect(answer.status).toBe("not_configured");
    expect(answer.answer).toContain("document index is not ready yet");
    expect(answer.warning).toContain('Qdrant collection "afcfta-compliance" was not found.');
    expect(answer.citations).toHaveLength(0);
  });
});
