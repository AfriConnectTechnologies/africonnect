import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { getComplianceAiConfig } from "@/lib/compliance-ai/config";
import {
  translateTextWithAddisAssistant,
} from "@/lib/compliance-ai/providers";
import {
  detectComplianceQuestionLanguage,
  localizeComplianceAssistantAnswer,
} from "@/lib/compliance-ai/service";
import { isComplianceEnabledForEmail } from "@/lib/features";
import type {
  ComplianceAssistantAnswer,
  ComplianceAssistantStreamEvent,
} from "@/lib/compliance-ai/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  question: z.string().trim().min(5).max(2000),
  filters: z
    .object({
      language: z.string().trim().min(1).optional(),
    })
    .optional(),
});

function createSseResponse(
  streamHandler: (
    send: (event: ComplianceAssistantStreamEvent) => void
  ) => Promise<void>
) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: ComplianceAssistantStreamEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          await streamHandler(send);
        } catch (error) {
          console.error("General AI ask route failed:", error);
          send({
            type: "error",
            error: "Failed to answer your question",
          });
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }
  );
}

const STREAMING_PROVIDER_TIMEOUT_MS = 60000;

async function fetchWithTimeout(
  input: string | URL | globalThis.Request,
  options: RequestInit & { timeout?: number; requestName?: string } = {}
): Promise<Response> {
  const {
    timeout = 30000,
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

const SYSTEM_PROMPT = [
  "You are an expert assistant specializing ONLY in the African Continental Free Trade Area (AfCFTA) and closely related African trade topics.",
  "You have deep knowledge of AfCFTA agreements, protocols, rules of origin, tariff schedules, credit scoring frameworks, trade facilitation, customs procedures, dispute resolution mechanisms, and African cross-border commerce.",
  "",
  "STRICT SCOPE RULES:",
  "- You MUST ONLY answer questions directly related to AfCFTA, African trade, rules of origin, tariff reduction, credit scoring for African trade, customs procedures, certificates of origin, trade facilitation in Africa, and related regulatory/compliance topics.",
  '- If a question is NOT related to AfCFTA or African trade, you MUST refuse politely. Respond with: "I can only help with questions related to the African Continental Free Trade Area (AfCFTA), African trade, rules of origin, tariff schedules, credit scoring, and related topics. Please ask a question within that scope."',
  "- Do NOT answer general programming, coding, math, science, entertainment, or any other off-topic questions, even if the user insists.",
  "",
  "RESPONSE GUIDELINES:",
  "- Answer questions clearly and accurately based on your knowledge.",
  "- If you are not certain about something, say so clearly.",
  "- Do not give legal advice — provide informational guidance only.",
  "- Write clean GitHub-flavored Markdown.",
  "- Use short paragraphs and bullet points where helpful.",
  "- Respond in English.",
].join("\n");

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const userEmail = user?.emailAddresses[0]?.emailAddress;
    if (!isComplianceEnabledForEmail(userEmail)) {
      return NextResponse.json(
        { error: "AI assistant is currently unavailable." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid question." },
        { status: 400 }
      );
    }

    const targetLanguage = detectComplianceQuestionLanguage(
      parsed.data.question,
      parsed.data.filters
    );

    let normalizedQuestion = parsed.data.question;
    let translationWarning: string | undefined;

    if (targetLanguage !== "en") {
      try {
        normalizedQuestion = await translateTextWithAddisAssistant(
          parsed.data.question,
          targetLanguage,
          "en"
        );
      } catch (error) {
        translationWarning =
          error instanceof Error
            ? `Question translation failed; original text used. ${error.message}`
            : "Question translation failed; original text used.";
      }
    }

    const config = getComplianceAiConfig();

    if (
      config.generationProvider !== "openai" ||
      !config.generationApiKey ||
      !config.generationModel
    ) {
      const directAnswer: ComplianceAssistantAnswer = {
        status: "not_configured",
        mode: "full-rag",
        answer: "The AI assistant is not fully configured yet. Please try again later.",
        citations: [],
        providerSummary: {
          vectorStore: "N/A",
          embeddingModel: "N/A",
          generationProvider: config.generationProvider,
          generationModel: config.generationModel,
        },
      };

      return createSseResponse(async (send) => {
        send({ type: "complete", answer: directAnswer });
      });
    }

    return createSseResponse(async (send) => {
      if (targetLanguage === "en") {
        send({
          type: "metadata",
          answer: {
            status: "ready",
            mode: "full-rag",
            providerSummary: {
              vectorStore: "N/A",
              embeddingModel: "N/A",
              generationProvider: config.generationProvider,
              generationModel: config.generationModel,
            },
          },
        });
      }

      const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: request.signal,
        timeout: STREAMING_PROVIDER_TIMEOUT_MS,
        requestName: "OpenAI generation request",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.generationApiKey}`,
        },
        body: JSON.stringify({
          model: config.generationModel,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: normalizedQuestion },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          errorBody
            ? `Generation failed with status ${response.status}: ${errorBody}`
            : `Generation failed with status ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("Generation response body was empty");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aborted = request.signal.aborted;
      let buffer = "";
      let fullAnswer = "";

      const handleSseEvent = (rawEvent: string) => {
        const payload = rawEvent
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");

        if (!payload || payload === "[DONE]") return;

        let parsed: {
          choices?: Array<{
            delta?: { content?: string; refusal?: string };
          }>;
        };
        try {
          parsed = JSON.parse(payload) as {
            choices?: Array<{
              delta?: { content?: string; refusal?: string };
            }>;
          };
        } catch (error) {
          console.error("Failed to parse compliance SSE chunk", {
            error,
            payloadLength: payload.length,
          });
          return;
        }

        const delta = parsed.choices?.[0]?.delta;
        if (delta?.refusal) {
          throw new Error(`OpenAI refused the request: ${delta.refusal}`);
        }

        if (delta?.content) {
          fullAnswer += delta.content;
          if (targetLanguage === "en") {
            send({ type: "delta", delta: delta.content });
          }
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

      const handleAbort = () => {
        aborted = true;
        void reader.cancel().catch(() => {
          // Ignore cancellation errors while shutting down a disconnected stream.
        });
      };

      request.signal.addEventListener("abort", handleAbort);
      try {
        while (true) {
          if (aborted || request.signal.aborted) {
            return;
          }

          const { done, value } = await reader.read();
          if (aborted || request.signal.aborted) {
            return;
          }

          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

          let separator = getNextSeparator(buffer);
          while (separator) {
            const rawEvent = buffer.slice(0, separator.index).trim();
            buffer = buffer.slice(separator.index + separator.length);
            if (rawEvent) handleSseEvent(rawEvent);
            separator = getNextSeparator(buffer);
          }

          if (done) {
            const trailingEvent = buffer.trim();
            if (trailingEvent) handleSseEvent(trailingEvent);
            break;
          }
        }
      } finally {
        request.signal.removeEventListener("abort", handleAbort);
      }

      const cleanedAnswer = fullAnswer.trim();
      if (!cleanedAnswer) {
        send({
          type: "complete",
          answer: {
            status: "ready",
            mode: "full-rag",
            answer: "The AI assistant was unable to generate a response. Please try again.",
            citations: [],
            providerSummary: {
              vectorStore: "N/A",
              embeddingModel: "N/A",
              generationProvider: config.generationProvider,
              generationModel: config.generationModel,
            },
          },
        });
        return;
      }

      const completeAnswer: ComplianceAssistantAnswer = {
        status: "ready",
        mode: "full-rag",
        answer: cleanedAnswer,
        citations: [],
        warning: translationWarning,
        providerSummary: {
          vectorStore: "N/A",
          embeddingModel: "N/A",
          generationProvider: config.generationProvider,
          generationModel: config.generationModel,
        },
      };

      send({
        type: "complete",
        answer: await localizeComplianceAssistantAnswer(completeAnswer, targetLanguage),
      });
    });
  } catch (error) {
    console.error("General AI ask route failed:", error);
    return NextResponse.json(
      { error: "Failed to answer your question" },
      { status: 500 }
    );
  }
}
