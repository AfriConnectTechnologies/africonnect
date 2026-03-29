"use client";

import posthog from "posthog-js";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture the exception to PostHog for error tracking
    posthog.captureException(error, {
      $exception_source: "global_error_boundary",
      digest: error.digest,
    });
  }, [error]);

  return (
    // global-error must include html and body tags
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 bg-background text-foreground">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Application Error
              </h1>
              <p className="text-muted-foreground max-w-md">
                A critical error occurred. Our team has been notified.
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
        {/* Fallback to Next.js default error page for additional info */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
