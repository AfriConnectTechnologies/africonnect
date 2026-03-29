import { getComplianceAiConfig } from "@/lib/compliance-ai/config";
import type {
  ComplianceChunk,
  ComplianceCitation,
  ComplianceTranslationLanguage,
} from "@/lib/compliance-ai/types";

export interface GeneratedAnswerPayload {
  answer: string;
  citationIds: string[];
  warning?: string;
}

const DEFAULT_PROVIDER_TIMEOUT_MS = 15000;
const GENERATION_PROVIDER_TIMEOUT_MS = 30000;
const STREAMING_PROVIDER_TIMEOUT_MS = 60000;
const TRANSLATION_PROVIDER_TIMEOUT_MS = 15000;
const OPENAI_GENERATED_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    citationIds: {
      type: "array",
      items: { type: "string" },
    },
    warning: {
      type: ["string", "null"],
    },
  },
  required: ["answer", "citationIds", "warning"],
} as const;

interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
  requestName?: string;
}

async function fetchWithTimeout(
  input: string | URL | globalThis.Request,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = DEFAULT_PROVIDER_TIMEOUT_MS,
    requestName = "External request",
    signal,
    ...init
  } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const abortHandler = () => controller.abort();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${requestName} timed out after ${timeout}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortHandler);
  }
}

function extractJsonObject(value: string): string | null {
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  return value.slice(first, last + 1);
}

function coerceGeneratedAnswer(
  parsed:
    | (Partial<GeneratedAnswerPayload> & { warning?: string | null })
    | null
    | undefined
): GeneratedAnswerPayload | null {
  if (typeof parsed?.answer !== "string" || !Array.isArray(parsed.citationIds)) {
    return null;
  }

  return {
    answer: parsed.answer,
    citationIds: parsed.citationIds.map(String),
    warning: parsed.warning ?? undefined,
  };
}

function parseGeneratedAnswer(raw: string): GeneratedAnswerPayload | null {
  const candidate = extractJsonObject(raw) ?? raw;

  try {
    return coerceGeneratedAnswer(JSON.parse(candidate) as Partial<GeneratedAnswerPayload>);
  } catch {
    return null;
  }
}

function buildEvidenceBlock(chunks: ComplianceChunk[]): string {
  return chunks
    .map(
      (chunk) =>
        `[${chunk.id}] ${chunk.documentTitle} | ${chunk.locator}\n${chunk.text}`
    )
    .join("\n\n");
}

function buildAnswerPrompt(question: string, chunks: ComplianceChunk[]): string {
  const evidence = buildEvidenceBlock(chunks);
  return [
    "You are an AfCFTA compliance assistant.",
    "Answer only from the evidence below.",
    "Respond in English.",
    "If the evidence is insufficient, say so clearly.",
    "Do not give legal advice.",
    'Write the "answer" value as clean GitHub-flavored Markdown.',
    'Use this structure when helpful: "Summary", "Key points", and "Gaps or caveats".',
    "Use short paragraphs and bullet points where helpful.",
    "Do not include a top-level title.",
    "Clean up OCR noise, broken line wraps, repeated fragments, and document-style formatting.",
    "Rewrite fragmented evidence into readable business language while staying faithful to the source.",
    "Do not copy noisy source text verbatim unless quoting a short phrase is necessary.",
    "If the evidence is ambiguous or incomplete, say that plainly.",
    'Return strict JSON with keys: "answer", "citationIds", and optional "warning".',
    'The "citationIds" array must contain evidence IDs such as ["1", "3"].',
    'If there is no warning, use "warning": null.',
    "",
    `Question: ${question}`,
    "",
    "Evidence:",
    evidence,
  ].join("\n");
}

function buildStreamingAnswerPrompt(question: string, chunks: ComplianceChunk[]): string {
  const evidence = buildEvidenceBlock(chunks);
  return [
    "You are an AfCFTA compliance assistant.",
    "Answer only from the evidence below.",
    "Respond in English.",
    "If the evidence is insufficient, say so clearly.",
    "Do not give legal advice.",
    "Write a clean GitHub-flavored Markdown answer.",
    'Use this structure when helpful: "Summary", "Key points", and "Gaps or caveats".',
    "Use short paragraphs and bullet points where helpful.",
    "Do not include a top-level title.",
    "Clean up OCR noise, broken line wraps, repeated fragments, and document-style formatting.",
    "Rewrite fragmented evidence into readable business language while staying faithful to the source.",
    "Do not copy noisy source text verbatim unless quoting a short phrase is necessary.",
    "Do not include inline citation markers, source IDs, UUIDs, or bracketed references in the visible answer.",
    "",
    `Question: ${question}`,
    "",
    "Evidence:",
    evidence,
  ].join("\n");
}

export async function embedComplianceQuery(question: string): Promise<number[]> {
  const config = getComplianceAiConfig();
  const response = await fetchWithTimeout("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    timeout: DEFAULT_PROVIDER_TIMEOUT_MS,
    requestName: "Voyage embedding request",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.voyageApiKey}`,
    },
    body: JSON.stringify({
      input: [question],
      model: config.embeddingModel,
      input_type: "query",
      output_dimension: config.embeddingDimension,
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage embedding failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding: number[] }>;
  };

  const vector = data.data?.[0]?.embedding;
  if (!vector) {
    throw new Error("Voyage embedding response did not include an embedding");
  }

  return vector;
}

export async function rerankComplianceChunks(
  _question: string,
  chunks: ComplianceChunk[]
): Promise<ComplianceChunk[]> {
  return [...chunks].sort((a, b) => b.score - a.score);
}

async function generateWithOpenAi(
  apiKey: string,
  model: string,
  prompt: string
): Promise<GeneratedAnswerPayload | null> {
  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    timeout: GENERATION_PROVIDER_TIMEOUT_MS,
    requestName: "OpenAI generation request",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "afcfta_compliance_answer",
          strict: true,
          schema: OPENAI_GENERATED_ANSWER_SCHEMA,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You answer AfCFTA compliance questions only from retrieved evidence and produce valid JSON. Respond in English. The answer field must contain clean GitHub-flavored Markdown that reorganizes noisy source text into readable prose.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      body
        ? `OpenAI generation failed with status ${response.status}: ${body}`
        : `OpenAI generation failed with status ${response.status}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
        refusal?: string;
      };
    }>;
  };

  const message = data.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`OpenAI refused the generation request: ${message.refusal}`);
  }

  return parseGeneratedAnswer(message?.content ?? "");
}

export async function streamOpenAiComplianceAnswer(
  question: string,
  chunks: ComplianceChunk[],
  onDelta: (delta: string) => void,
  abortSignalOrController?: AbortSignal | AbortController
): Promise<GeneratedAnswerPayload | null> {
  const config = getComplianceAiConfig();
  if (
    config.generationProvider !== "openai" ||
    !config.generationApiKey ||
    !config.generationModel
  ) {
    return null;
  }

  const externalSignal =
    abortSignalOrController instanceof AbortController
      ? abortSignalOrController.signal
      : abortSignalOrController;
  const controller = new AbortController();
  let didTimeout = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  const abortHandler = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortHandler);
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, STREAMING_PROVIDER_TIMEOUT_MS);

  const throwAbortError = async () => {
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Ignore reader cancellation errors during abort cleanup.
      }
    }

    if (didTimeout) {
      throw new Error(
        `OpenAI generation request timed out after ${STREAMING_PROVIDER_TIMEOUT_MS}ms`
      );
    }

    throw new Error("OpenAI generation request was aborted");
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.generationApiKey}`,
      },
      body: JSON.stringify({
        model: config.generationModel,
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "You answer AfCFTA compliance questions only from retrieved evidence. Respond in English. Return only clean GitHub-flavored Markdown. Do not include inline citation markers, source IDs, UUIDs, or bracketed references in the visible answer.",
          },
          {
            role: "user",
            content: buildStreamingAnswerPrompt(question, chunks),
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        body
          ? `OpenAI generation failed with status ${response.status}: ${body}`
          : `OpenAI generation failed with status ${response.status}`
      );
    }

    if (!response.body) {
      throw new Error("OpenAI generation response body was empty");
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";

    const handleSseEvent = (rawEvent: string) => {
      const payload = rawEvent
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");

      if (!payload) {
        return;
      }

      if (payload === "[DONE]") {
        return;
      }

      let parsed: {
        choices?: Array<{
          delta?: {
            content?: string;
            refusal?: string;
          };
        }>;
      };
      try {
        const candidate = JSON.parse(payload);
        if (typeof candidate !== "object" || candidate === null) {
          console.error("Malformed OpenAI SSE payload", {
            payloadLength: payload.length,
          });
          return;
        }

        parsed = candidate as {
          choices?: Array<{
            delta?: {
              content?: string;
              refusal?: string;
            };
          }>;
        };
      } catch (error) {
        console.error("Failed to parse OpenAI SSE payload", {
          error,
          payloadLength: payload.length,
        });
        return;
      }

      const delta = parsed.choices?.[0]?.delta;
      if (delta?.refusal) {
        throw new Error(`OpenAI refused the generation request: ${delta.refusal}`);
      }

      if (delta?.content) {
        answer += delta.content;
        onDelta(delta.content);
      }
    };

    const getNextSeparator = (value: string) => {
      const lfIndex = value.indexOf("\n\n");
      const crlfIndex = value.indexOf("\r\n\r\n");

      if (lfIndex === -1) {
        return crlfIndex === -1 ? null : { index: crlfIndex, length: 4 };
      }

      if (crlfIndex === -1 || lfIndex < crlfIndex) {
        return { index: lfIndex, length: 2 };
      }

      return { index: crlfIndex, length: 4 };
    };

    while (true) {
      if (controller.signal.aborted) {
        await throwAbortError();
      }

      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      let separator = getNextSeparator(buffer);
      while (separator) {
        const rawEvent = buffer.slice(0, separator.index).trim();
        buffer = buffer.slice(separator.index + separator.length);
        if (rawEvent) {
          handleSseEvent(rawEvent);
        }
        separator = getNextSeparator(buffer);
      }

      if (done) {
        const trailingEvent = buffer.trim();
        if (trailingEvent) {
          handleSseEvent(trailingEvent);
        }
        break;
      }
    }

    const cleanedAnswer = answer.trim();
    if (!cleanedAnswer) {
      return null;
    }

    return {
      answer: cleanedAnswer,
      citationIds: [],
    };
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      await throwAbortError();
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortHandler);
  }
}

async function generateWithGemini(
  apiKey: string,
  model: string,
  prompt: string
): Promise<GeneratedAnswerPayload | null> {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      timeout: GENERATION_PROVIDER_TIMEOUT_MS,
      requestName: "Gemini generation request",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini generation failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseGeneratedAnswer(text);
}

async function generateWithAnthropic(
  apiKey: string,
  model: string,
  prompt: string
): Promise<GeneratedAnswerPayload | null> {
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    timeout: GENERATION_PROVIDER_TIMEOUT_MS,
    requestName: "Anthropic generation request",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0.1,
      system:
        "You answer AfCFTA compliance questions only from retrieved evidence and produce valid JSON. Respond in English. The answer field must contain clean GitHub-flavored Markdown that reorganizes noisy source text into readable prose.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic generation failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text =
    data.content?.find((item) => item.type === "text")?.text ?? "";
  return parseGeneratedAnswer(text);
}

export async function generateComplianceAnswer(
  question: string,
  chunks: ComplianceChunk[]
): Promise<GeneratedAnswerPayload | null> {
  const config = getComplianceAiConfig();
  if (!config.generationProvider || !config.generationModel || !config.generationApiKey) {
    return null;
  }

  const prompt = buildAnswerPrompt(question, chunks);

  switch (config.generationProvider) {
    case "openai":
      return generateWithOpenAi(
        config.generationApiKey,
        config.generationModel,
        prompt
      );
    case "gemini":
      return generateWithGemini(
        config.generationApiKey,
        config.generationModel,
        prompt
      );
    case "anthropic":
      return generateWithAnthropic(
        config.generationApiKey,
        config.generationModel,
        prompt
      );
    default:
      return null;
  }
}

export async function translateTextWithAddisAssistant(
  text: string,
  sourceLanguage: ComplianceTranslationLanguage,
  targetLanguage: ComplianceTranslationLanguage
): Promise<string> {
  const apiKey = process.env.COMPLIANCE_ADDIS_AI_API_KEY;
  if (!apiKey) {
    throw new Error("COMPLIANCE_ADDIS_AI_API_KEY is not configured");
  }

  const response = await fetchWithTimeout("https://api.addisassistant.com/api/v1/translate", {
    method: "POST",
    timeout: TRANSLATION_PROVIDER_TIMEOUT_MS,
    requestName: "Addis Assistant translation request",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      body
        ? `Translation failed with status ${response.status}: ${body}`
        : `Translation failed with status ${response.status}`
    );
  }

  const data = (await response.json()) as {
    status?: string;
    data?: {
      translation?: string;
    };
  };

  const translation = data.data?.translation?.trim();
  if (!translation) {
    throw new Error("Translation response did not include translated text");
  }

  return translation;
}

export function chunkToCitation(chunk: ComplianceChunk): ComplianceCitation {
  return {
    id: chunk.id,
    documentTitle: chunk.documentTitle,
    locator: chunk.locator,
    excerpt: chunk.text.slice(0, 280),
    sourceUrl: chunk.sourceUrl,
    score: chunk.score,
  };
}
