import { PostHog } from "posthog-node";

let posthogInstance: PostHog | null = null;

/**
 * Get or create a singleton PostHog server-side client.
 * Use this for server-side error tracking and analytics.
 *
 * Note: Server-side uses NEXT_PUBLIC_POSTHOG_HOST directly (not the /api/ph proxy)
 * since the proxy is only needed for client-side ad blocker bypass.
 */
export function getPostHogServer(): PostHog {
  if (!posthogInstance) {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!posthogKey) {
      // Only log once by caching the no-op instance
      console.warn(
        "[PostHog Server] Missing NEXT_PUBLIC_POSTHOG_KEY - server-side analytics disabled"
      );
      // Create and cache a no-op client to prevent crashes and stop repeated warnings
      posthogInstance = {
        capture: () => {},
        captureException: () => {},
        identify: () => {},
        shutdown: async () => {},
        flush: async () => {},
      } as unknown as PostHog;
      return posthogInstance;
    }

    posthogInstance = new PostHog(posthogKey, {
      host: posthogHost || "https://us.i.posthog.com",
      // Flush immediately for serverless environments
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return posthogInstance;
}

/**
 * Shutdown the PostHog client gracefully.
 * Call this when your server is shutting down.
 */
export async function shutdownPostHogServer(): Promise<void> {
  if (posthogInstance) {
    await posthogInstance.shutdown();
    posthogInstance = null;
  }
}
