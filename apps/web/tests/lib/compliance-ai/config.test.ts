import { afterEach, describe, expect, it } from "vitest";

import {
  getComplianceAiConfig,
  getComplianceAiRuntimeStatus,
} from "@/lib/compliance-ai/config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("compliance AI config", () => {
  it("reports the assistant as disabled when the feature flag is off", () => {
    process.env.NEXT_PUBLIC_ENABLE_COMPLIANCE_AI = "false";

    const status = getComplianceAiRuntimeStatus();

    expect(status.enabled).toBe(false);
    expect(status.retrievalReady).toBe(false);
    expect(status.missing).toContain("NEXT_PUBLIC_ENABLE_COMPLIANCE_AI");
  });

  it("reports missing retrieval configuration when enabled", () => {
    process.env.NEXT_PUBLIC_ENABLE_COMPLIANCE_AI = "true";
    delete process.env.COMPLIANCE_AI_QDRANT_URL;
    delete process.env.COMPLIANCE_AI_QDRANT_COLLECTION;
    delete process.env.VOYAGE_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const status = getComplianceAiRuntimeStatus();

    expect(status.enabled).toBe(true);
    expect(status.retrievalReady).toBe(false);
    expect(status.missing).toEqual(
      expect.arrayContaining([
        "COMPLIANCE_AI_QDRANT_URL",
        "COMPLIANCE_AI_QDRANT_COLLECTION",
        "VOYAGE_API_KEY",
        "OPENAI_API_KEY",
      ])
    );
  });

  it("builds the recommended stack config when all required env vars are present", () => {
    process.env.NEXT_PUBLIC_ENABLE_COMPLIANCE_AI = "true";
    process.env.COMPLIANCE_AI_QDRANT_URL = "https://qdrant.example.com";
    process.env.COMPLIANCE_AI_QDRANT_COLLECTION = "afcfta";
    process.env.COMPLIANCE_AI_QDRANT_API_KEY = "qdrant-key";
    process.env.COMPLIANCE_AI_EMBEDDING_MODEL = "voyage-4";
    process.env.COMPLIANCE_AI_RERANK_MODEL = "rerank-2.5-lite";
    process.env.COMPLIANCE_AI_GENERATION_PROVIDER = "openai";
    process.env.COMPLIANCE_AI_GENERATION_MODEL = "gpt-5-mini";
    process.env.VOYAGE_API_KEY = "voyage-key";
    process.env.OPENAI_API_KEY = "openai-key";

    const config = getComplianceAiConfig();

    expect(config.qdrantUrl).toBe("https://qdrant.example.com");
    expect(config.qdrantCollection).toBe("afcfta");
    expect(config.embeddingModel).toBe("voyage-4");
    expect(config.rerankerModel).toBe("rerank-2.5-lite");
    expect(config.generationProvider).toBe("openai");
    expect(config.generationModel).toBe("gpt-5-mini");
    expect(config.generationApiKey).toBe("openai-key");
  });
});
