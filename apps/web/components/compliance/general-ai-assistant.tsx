"use client";

import { useState } from "react";
import { AlertCircle, Bot, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ComplianceAssistantAnswer,
  ComplianceAssistantStreamEvent,
  ComplianceTranslationLanguage,
} from "@/lib/compliance-ai/types";
import { cn } from "@/lib/utils";

const markdownClassNames = {
  p: "mb-3 last:mb-0",
  ul: "mb-3 list-disc space-y-1 pl-5 last:mb-0",
  ol: "mb-3 list-decimal space-y-1 pl-5 last:mb-0",
  li: "marker:text-muted-foreground",
  strong: "font-semibold text-foreground",
  a: "text-primary underline underline-offset-2",
  blockquote: "mb-3 border-l-2 border-border pl-4 italic text-muted-foreground last:mb-0",
  code: "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground",
  pre: "mb-3 overflow-x-auto rounded-lg border bg-muted/50 p-3 last:mb-0",
  h1: "mb-3 text-lg font-semibold text-foreground last:mb-0",
  h2: "mb-3 text-base font-semibold text-foreground last:mb-0",
  h3: "mb-2 text-sm font-semibold text-foreground last:mb-0",
  table: "mb-3 w-full border-collapse text-sm last:mb-0",
  th: "border border-border bg-muted px-2 py-1 text-left font-medium text-foreground",
  td: "border border-border px-2 py-1 align-top",
} as const;

export function GeneralAiAssistant() {
  const t = useTranslations("aiAssistantPage.general");
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState<ComplianceTranslationLanguage>("en");
  const [answer, setAnswer] = useState<ComplianceAssistantAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = question.trim().length >= 5 && !isSubmitting;

  const applyStreamEvent = (event: ComplianceAssistantStreamEvent) => {
    switch (event.type) {
      case "metadata":
        setAnswer({
          ...event.answer,
          answer: "",
          citations: [],
        });
        return;
      case "delta":
        setAnswer((current) =>
          current
            ? {
                ...current,
                answer: `${current.answer}${event.delta}`,
              }
            : current
        );
        return;
      case "complete":
        setAnswer(event.answer);
        return;
      case "error":
        setAnswer(null);
        setError(event.error);
        return;
      default:
        return;
    }
  };

  const submitQuestion = async (nextQuestion?: string) => {
    const value = (nextQuestion ?? question).trim();
    if (value.length < 5) {
      setError(t("validation.questionTooShort"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setAnswer(null);

    try {
      const response = await fetch("/api/compliance/ask-general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: value,
          filters: {
            language,
          },
        }),
      });
      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setAnswer(null);
        setError(
          response.status === 400
            ? t("validation.invalidQuestion")
            : payload.error ?? t("error.generic")
        );
        return;
      }

      setQuestion(value);

      if (!contentType.includes("text/event-stream") || !response.body) {
        const payload = (await response.json()) as ComplianceAssistantAnswer;
        setAnswer(payload);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processEvent = (rawEvent: string) => {
        const payload = rawEvent
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");

        if (!payload) return;

        try {
          const event = JSON.parse(payload) as ComplianceAssistantStreamEvent;
          applyStreamEvent(event);
        } catch (parseError) {
          console.warn("Malformed SSE event in general assistant:", parseError);
        }
      };

      while (true) {
        const { done, value: chunk } = await reader.read();
        buffer += decoder.decode(chunk ?? new Uint8Array(), { stream: !done });

        const segments = buffer.split(/\r?\n\r?\n/);
        buffer = segments.pop() ?? "";

        for (const segment of segments) {
          const trimmedSegment = segment.trim();
          if (trimmedSegment) processEvent(trimmedSegment);
        }

        if (done) {
          const trailingSegment = buffer.trim();
          if (trailingSegment) processEvent(trailingSegment);
          break;
        }
      }
    } catch (requestError) {
      console.error("General AI assistant request failed:", requestError);
      setAnswer(null);
      setError(t("error.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {t("title")}
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              {t("description")}
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            {t("badge")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-background/80 p-3 text-sm text-muted-foreground">
          {t("helper")}
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("form.languageLabel")}
            </label>
            <Select
              value={language}
              onValueChange={(value) => setLanguage(value as ComplianceTranslationLanguage)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="am">Amharic</SelectItem>
                <SelectItem value="om">Afan Oromo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            aria-label={t("form.questionLabel")}
            placeholder={t("placeholder")}
            className="min-h-28"
          />
          <div className="flex items-center gap-3">
            <Button onClick={() => void submitQuestion()} disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("cta.asking")}
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4" />
                  {t("cta.ask")}
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {answer && (
          <div className="space-y-4 rounded-xl border bg-background p-4">
            <div className="space-y-2">
              <h3 className="font-medium">{t("sections.answer")}</h3>
              <div className="rounded-lg border bg-muted/20 p-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ className, ...props }) => (
                      <p
                        className={cn(
                          markdownClassNames.p,
                          "text-sm leading-6 text-muted-foreground",
                          className
                        )}
                        {...props}
                      />
                    ),
                    ul: ({ className, ...props }) => (
                      <ul
                        className={cn(
                          markdownClassNames.ul,
                          "text-sm leading-6 text-muted-foreground",
                          className
                        )}
                        {...props}
                      />
                    ),
                    ol: ({ className, ...props }) => (
                      <ol
                        className={cn(
                          markdownClassNames.ol,
                          "text-sm leading-6 text-muted-foreground",
                          className
                        )}
                        {...props}
                      />
                    ),
                    li: ({ className, ...props }) => (
                      <li
                        className={cn(
                          markdownClassNames.li,
                          "text-sm leading-6 text-muted-foreground",
                          className
                        )}
                        {...props}
                      />
                    ),
                    strong: ({ className, ...props }) => (
                      <strong className={cn(markdownClassNames.strong, className)} {...props} />
                    ),
                    a: ({ className, ...props }) => (
                      <a
                        className={cn(markdownClassNames.a, className)}
                        target="_blank"
                        rel="noreferrer"
                        {...props}
                      />
                    ),
                    blockquote: ({ className, ...props }) => (
                      <blockquote
                        className={cn(markdownClassNames.blockquote, className)}
                        {...props}
                      />
                    ),
                    code: ({ className, ...props }) => (
                      <code className={cn(markdownClassNames.code, className)} {...props} />
                    ),
                    pre: ({ className, ...props }) => (
                      <pre className={cn(markdownClassNames.pre, className)} {...props} />
                    ),
                    h1: ({ className, ...props }) => (
                      <h1 className={cn(markdownClassNames.h1, className)} {...props} />
                    ),
                    h2: ({ className, ...props }) => (
                      <h2 className={cn(markdownClassNames.h2, className)} {...props} />
                    ),
                    h3: ({ className, ...props }) => (
                      <h3 className={cn(markdownClassNames.h3, className)} {...props} />
                    ),
                    table: ({ className, ...props }) => (
                      <table className={cn(markdownClassNames.table, className)} {...props} />
                    ),
                    th: ({ className, ...props }) => (
                      <th className={cn(markdownClassNames.th, className)} {...props} />
                    ),
                    td: ({ className, ...props }) => (
                      <td className={cn(markdownClassNames.td, className)} {...props} />
                    ),
                  }}
                >
                  {answer.answer}
                </ReactMarkdown>
              </div>
              {answer.warning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {answer.warning}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
