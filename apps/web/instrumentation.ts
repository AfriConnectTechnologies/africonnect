import type { Instrumentation } from "next";

/**
 * Next.js instrumentation file for server-side error tracking.
 * This file is automatically loaded by Next.js on server startup.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export function register() {
  // No-op for initialization - PostHog is initialized lazily in getPostHogServer()
}

/**
 * Capture server-side request errors and send them to PostHog.
 * This hook is called when an error occurs during request handling.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import to avoid loading PostHog in Edge runtime
    const { getPostHogServer } = await import("./lib/posthog-server");
    const posthog = getPostHogServer();

    // Extract distinct_id from PostHog cookie to link error to user
    let distinctId: string | undefined = undefined;

    if (request.headers.cookie) {
      // Normalize cookie header (could be string or array)
      const cookieString = Array.isArray(request.headers.cookie)
        ? request.headers.cookie.join("; ")
        : request.headers.cookie;

      // PostHog cookie format: ph_<project_api_key>_posthog
      // The cookie contains JSON with distinct_id
      const postHogCookieMatch = cookieString.match(
        /ph_phc_.*?_posthog=([^;]+)/
      );

      if (postHogCookieMatch && postHogCookieMatch[1]) {
        try {
          const decodedCookie = decodeURIComponent(postHogCookieMatch[1]);
          const postHogData = JSON.parse(decodedCookie);
          distinctId = postHogData.distinct_id;
        } catch (e) {
          // Log parse failure with context for debugging
          console.warn("[PostHog] Cookie parse failed, error tracking will be anonymous:", {
            error: e instanceof Error ? e.message : String(e),
            cookieLength: postHogCookieMatch[1].length,
            cookiePreview: postHogCookieMatch[1].substring(0, 50) + "...",
          });
          // Use undefined to indicate parse failure (better than grouping all as "anonymous_parse_error")
          distinctId = undefined;
        }
      }
    }

    // Capture the exception with context
    await posthog.captureException(err, distinctId, {
      $exception_source: "server_instrumentation",
      route: context.routePath,
      route_type: context.routeType,
      render_source: context.renderSource,
      request_path: request.path,
      request_method: request.method,
    });
  }
};
