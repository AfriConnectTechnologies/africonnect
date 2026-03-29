import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { getComplianceAiConfig } from "@/lib/compliance-ai/config";
import {
  generateComplianceAnswer,
  streamOpenAiComplianceAnswer,
} from "@/lib/compliance-ai/providers";
import {
  buildGeneratedComplianceResponse,
  buildRetrievalOnlyResponse,
  localizeComplianceAssistantAnswer,
  prepareComplianceAssistant,
} from "@/lib/compliance-ai/service";
import { isComplianceEnabledForEmail } from "@/lib/features";
import type { ComplianceAssistantStreamEvent } from "@/lib/compliance-ai/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  question: z.string().trim().min(5).max(2000),
  filters: z
    .object({
      country: z.string().trim().min(1).optional(),
      jurisdiction: z.string().trim().min(1).optional(),
      language: z.string().trim().min(1).optional(),
      documentType: z.string().trim().min(1).optional(),
    })
    .optional(),
});

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
  );
}

function createSseResponse(
  signal: AbortSignal,
  streamHandler: (
    send: (event: ComplianceAssistantStreamEvent) => void
  ) => Promise<void>
) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: ComplianceAssistantStreamEvent) => {
          if (signal.aborted) {
            return;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          await streamHandler(send);
        } catch (error) {
          if (signal.aborted || isAbortError(error)) {
            return;
          }

          console.error("Compliance AI ask route failed:", error);
          send({
            type: "error",
            error: "Failed to answer compliance question",
          });
        } finally {
          try {
            controller.close();
          } catch {
            // The client may have disconnected before the stream closed.
          }
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
        { error: "Compliance tools are currently unavailable." },
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
        { error: "Please provide a valid compliance question." },
        { status: 400 }
      );
    }

    const prepared = await prepareComplianceAssistant(
      parsed.data.question,
      parsed.data.filters
    );

    if (prepared.type === "answer") {
      return createSseResponse(request.signal, async (send) => {
        send({
          type: "complete",
          answer: await localizeComplianceAssistantAnswer(
            prepared.answer,
            prepared.targetLanguage
          ),
        });
      });
    }

    const { context } = prepared;
    const config = getComplianceAiConfig();

    return createSseResponse(request.signal, async (send) => {
      if (
        config.generationProvider === "openai" &&
        config.generationApiKey &&
        config.generationModel
      ) {
        if (context.targetLanguage === "en") {
          send({
            type: "metadata",
            answer: {
              status: "ready",
              mode: "full-rag",
              providerSummary: context.providerSummary,
            },
          });
        }

        try {
          const generated = await streamOpenAiComplianceAnswer(
            context.question,
            context.rerankedChunks,
            (delta) => {
              if (context.targetLanguage === "en") {
                send({
                  type: "delta",
                  delta,
                });
              }
            },
            request.signal
          );

          if (!generated) {
            send({
              type: "complete",
              answer: await localizeComplianceAssistantAnswer(
                buildRetrievalOnlyResponse(
                  context.rerankedChunks,
                  context.providerSummary,
                  "Generation provider returned an empty response, so this answer is based on retrieved evidence only."
                ),
                context.targetLanguage
              ),
            });
            return;
          }

          send({
            type: "complete",
            answer: await localizeComplianceAssistantAnswer(
              buildGeneratedComplianceResponse(
                generated,
                context.rerankedChunks,
                context.providerSummary
              ),
              context.targetLanguage
            ),
          });
          return;
        } catch (error) {
          if (request.signal.aborted || isAbortError(error)) {
            return;
          }

          send({
            type: "complete",
            answer: await localizeComplianceAssistantAnswer(
              buildRetrievalOnlyResponse(
                context.rerankedChunks,
                context.providerSummary,
                error instanceof Error
                  ? error.message
                  : "Generation failed, so this answer is based on retrieved evidence only."
              ),
              context.targetLanguage
            ),
          });
          return;
        }
      }

      let generated: Awaited<ReturnType<typeof generateComplianceAnswer>> = null;
      let generationWarning: string | undefined;

      try {
        generated = await generateComplianceAnswer(
          context.question,
          context.rerankedChunks
        );
      } catch (error) {
        generationWarning =
          error instanceof Error
            ? error.message
            : "Generation failed, so this answer is based on retrieved evidence only.";
      }

      send({
        type: "complete",
        answer: await localizeComplianceAssistantAnswer(
          generated
            ? buildGeneratedComplianceResponse(
                generated,
                context.rerankedChunks,
                context.providerSummary
              )
            : buildRetrievalOnlyResponse(
                context.rerankedChunks,
                context.providerSummary,
                generationWarning
              ),
          context.targetLanguage
        ),
      });
    });
  } catch (error) {
    console.error("Compliance AI ask route failed:", error);
    return NextResponse.json(
      { error: "Failed to answer compliance question" },
      { status: 500 }
    );
  }
}
