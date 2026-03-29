import { getComplianceAiConfig, getComplianceAiRuntimeStatus } from "@/lib/compliance-ai/config";
import {
  chunkToCitation,
  embedComplianceQuery,
  generateComplianceAnswer,
  rerankComplianceChunks,
  translateTextWithAddisAssistant,
} from "@/lib/compliance-ai/providers";
import { QdrantSearchError, searchComplianceChunks } from "@/lib/compliance-ai/qdrant";
import type {
  ComplianceAssistantAnswer,
  ComplianceAssistantFilters,
  ComplianceAiProviderSummary,
  ComplianceChunk,
  ComplianceTranslationLanguage,
} from "@/lib/compliance-ai/types";

function normalizeChunkText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s*([,.;:])\s*/g, "$1 ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function buildFallbackExcerpt(text: string): string {
  const normalized = normalizeChunkText(text);
  if (normalized.length <= 180) {
    return normalized;
  }

  const truncated = normalized.slice(0, 180);
  const lastSentenceBoundary = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("; "),
    truncated.lastIndexOf(": ")
  );

  if (lastSentenceBoundary >= 80) {
    return `${truncated.slice(0, lastSentenceBoundary + 1).trim()}...`;
  }

  const lastWordBoundary = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastWordBoundary > 0 ? lastWordBoundary : 180).trim()}...`;
}

function buildRetrievalOnlyAnswer(chunks: ComplianceChunk[]): string {
  const topChunks = chunks.slice(0, 3);
  const bulletList = topChunks
    .map(
      (chunk) =>
        [
          `- **${chunk.documentTitle}**`,
          `  - Location: ${chunk.locator}`,
          `  - Evidence: ${buildFallbackExcerpt(chunk.text)}`,
        ].join("\n")
    )
    .join("\n");

  return [
    "I found relevant AfCFTA compliance source material, but a fully generated answer is not available for this request.",
    "",
    "### Retrieved excerpts",
    bulletList,
  ].join("\n\n");
}

export function buildNotConfiguredAnswer(): ComplianceAssistantAnswer {
  const status = getComplianceAiRuntimeStatus();

  return {
    status: "not_configured",
    mode: "retrieval-only",
    answer:
      "The AfCFTA AI assistant is scaffolded, but the required Qdrant and provider environment variables are not fully configured yet.",
    citations: [],
    warning: `Missing configuration: ${status.missing.join(", ")}`,
    providerSummary: status.providerSummary,
  };
}

export interface PreparedComplianceAssistantContext {
  question: string;
  rerankedChunks: ComplianceChunk[];
  providerSummary: ComplianceAiProviderSummary;
  targetLanguage: ComplianceTranslationLanguage;
  warning?: string;
}

type PreparedComplianceAssistantResult =
  | {
      type: "answer";
      answer: ComplianceAssistantAnswer;
      targetLanguage: ComplianceTranslationLanguage;
    }
  | {
      type: "context";
      context: PreparedComplianceAssistantContext;
      targetLanguage: ComplianceTranslationLanguage;
    };

type GeneratedAnswer = NonNullable<Awaited<ReturnType<typeof generateComplianceAnswer>>>;

function normalizeRequestedLanguage(
  value?: string
): ComplianceTranslationLanguage | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "am" || normalized === "amharic") {
    return "am";
  }
  if (normalized === "sw" || normalized === "swahili") {
    return "sw";
  }
  if (
    normalized === "om" ||
    normalized === "oromo" ||
    normalized === "afan oromo" ||
    normalized === "afaan oromoo"
  ) {
    return "om";
  }
  if (normalized === "en" || normalized === "english") {
    return "en";
  }

  return undefined;
}

export function detectComplianceQuestionLanguage(
  question: string,
  filters?: ComplianceAssistantFilters
): ComplianceTranslationLanguage {
  const requestedLanguage = normalizeRequestedLanguage(filters?.language);
  if (requestedLanguage) {
    return requestedLanguage;
  }

  if (/\p{Script=Ethiopic}/u.test(question)) {
    return "am";
  }

  const normalizedQuestion = ` ${question.toLowerCase()} `;
  const oromoSignals = [
    " maal ",
    " keessa ",
    " irratti ",
    " keessaa ",
    " qajeelfama ",
    " ragaa ",
    " akkam ",
    " yeroo ",
    " keessatti ",
    " mootummaa ",
    " daldalaa ",
    " afaan oromoo",
  ];

  if (oromoSignals.some((signal) => normalizedQuestion.includes(signal))) {
    return "om";
  }

  return "en";
}

function mergeWarnings(
  primary?: string,
  secondary?: string
): string | undefined {
  if (primary && secondary) {
    return `${primary} ${secondary}`;
  }

  return primary ?? secondary;
}

export function buildRetrievalOnlyResponse(
  chunks: ComplianceChunk[],
  providerSummary: ComplianceAiProviderSummary,
  generationWarning?: string
): ComplianceAssistantAnswer {
  return {
    status: "ready",
    mode: "retrieval-only",
    answer: buildRetrievalOnlyAnswer(chunks),
    citations: chunks.slice(0, 3).map(chunkToCitation),
    warning:
      generationWarning ??
      "Generation provider is not configured, so this response is based on retrieved evidence only.",
    providerSummary,
  };
}

export function buildGeneratedComplianceResponse(
  generated: GeneratedAnswer,
  rerankedChunks: ComplianceChunk[],
  providerSummary: ComplianceAiProviderSummary
): ComplianceAssistantAnswer {
  const citationLookup = new Map(
    rerankedChunks.map((chunk) => [chunk.id, chunkToCitation(chunk)])
  );
  const citations = generated.citationIds
    .map((citationId) => citationLookup.get(citationId))
    .filter((citation): citation is NonNullable<typeof citation> => !!citation);

  return {
    status: "ready",
    mode: "full-rag",
    answer: generated.answer,
    citations: citations.length > 0
      ? citations
      : rerankedChunks.slice(0, 3).map(chunkToCitation),
    warning: generated.warning,
    providerSummary,
  };
}

export async function localizeComplianceAssistantAnswer(
  answer: ComplianceAssistantAnswer,
  targetLanguage: ComplianceTranslationLanguage
): Promise<ComplianceAssistantAnswer> {
  if (targetLanguage === "en" || !answer.answer.trim()) {
    return answer;
  }

  try {
    const translatedAnswer = await translateTextWithAddisAssistant(
      answer.answer,
      "en",
      targetLanguage
    );

    return {
      ...answer,
      answer: translatedAnswer,
    };
  } catch (error) {
    const translationWarning =
      error instanceof Error
        ? `Translation to ${targetLanguage} failed, so the answer is shown in English. ${error.message}`
        : `Translation to ${targetLanguage} failed, so the answer is shown in English.`;

    return {
      ...answer,
      warning: mergeWarnings(answer.warning, translationWarning),
    };
  }
}

export async function prepareComplianceAssistant(
  question: string,
  filters?: ComplianceAssistantFilters
): Promise<PreparedComplianceAssistantResult> {
  const status = getComplianceAiRuntimeStatus();
  const targetLanguage = detectComplianceQuestionLanguage(question, filters);
  if (!status.enabled || !status.retrievalReady) {
    return {
      type: "answer",
      answer: buildNotConfiguredAnswer(),
      targetLanguage,
    };
  }

  getComplianceAiConfig();
  const retrievalFilters = filters
    ? {
        ...filters,
        language: undefined,
      }
    : undefined;
  let normalizedQuestion = question;
  let translationWarning: string | undefined;

  if (targetLanguage !== "en") {
    try {
      normalizedQuestion = await translateTextWithAddisAssistant(
        question,
        targetLanguage,
        "en"
      );
    } catch (error) {
      translationWarning =
        error instanceof Error
          ? `Question translation to English failed, so retrieval used the original text. ${error.message}`
          : "Question translation to English failed, so retrieval used the original text.";
    }
  }

  let vector: number[];
  let retrievedChunks: ComplianceChunk[];

  try {
    vector = await embedComplianceQuery(normalizedQuestion);
    retrievedChunks = await searchComplianceChunks(vector, retrievalFilters);
  } catch (error) {
    const warning = mergeWarnings(
      translationWarning,
      error instanceof QdrantSearchError || error instanceof Error
        ? error.message
        : "Compliance retrieval is not ready yet."
    );

    return {
      type: "answer",
      answer: {
        status: "not_configured",
        mode: "retrieval-only",
        answer:
          "The AfCFTA AI assistant is connected, but the compliance document index is not ready yet.",
        citations: [],
        warning,
        providerSummary: status.providerSummary,
      },
      targetLanguage,
    };
  }

  if (retrievedChunks.length === 0) {
    return {
      type: "answer",
      answer: {
        status: "no_evidence",
        mode: "retrieval-only",
        answer:
          "I could not find enough uploaded AfCFTA evidence to answer that question confidently. Try narrowing the country, document type, or wording.",
        citations: [],
        providerSummary: status.providerSummary,
      },
      targetLanguage,
    };
  }

  const rerankedChunks = await rerankComplianceChunks(normalizedQuestion, retrievedChunks);
  return {
    type: "context",
    targetLanguage,
    context: {
      question: normalizedQuestion,
      rerankedChunks,
      providerSummary: status.providerSummary,
      targetLanguage,
      warning: translationWarning,
    },
  };
}

export async function askComplianceAssistant(
  question: string,
  filters?: ComplianceAssistantFilters
): Promise<ComplianceAssistantAnswer> {
  const prepared = await prepareComplianceAssistant(question, filters);
  if (prepared.type === "answer") {
    return localizeComplianceAssistantAnswer(prepared.answer, prepared.targetLanguage);
  }

  const { context } = prepared;
  let generated: Awaited<ReturnType<typeof generateComplianceAnswer>> = null;
  let generationWarning: string | undefined;

  try {
    generated = await generateComplianceAnswer(context.question, context.rerankedChunks);
  } catch (error) {
    generationWarning =
      error instanceof Error
        ? error.message
        : "Generation failed, so this response is based on retrieved evidence only.";
  }

  if (!generated) {
    const generationWarningOrFallback =
      generationWarning ??
      "The model returned unusable or malformed output, so this response is based on retrieved evidence only.";

    return localizeComplianceAssistantAnswer(
      buildRetrievalOnlyResponse(
        context.rerankedChunks,
        context.providerSummary,
        mergeWarnings(context.warning, generationWarningOrFallback)
      ),
      context.targetLanguage
    );
  }

  return localizeComplianceAssistantAnswer(
    buildGeneratedComplianceResponse(
      {
        ...generated,
        warning: mergeWarnings(context.warning, generated.warning),
      },
      context.rerankedChunks,
      context.providerSummary
    ),
    context.targetLanguage
  );
}
