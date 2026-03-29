import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

function getHostname(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const r2PublicHostname = getHostname(process.env.R2_PUBLIC_URL);
const r2AccountId = process.env.R2_ACCOUNT_ID;

const nextConfig: NextConfig = {
  reactStrictMode: false,
  logging: {
    browserToTerminal: process.env.NODE_ENV === "development" ? "error" : false,
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    localPatterns: [
      {
        pathname: "/logo2.webp",
        search: "?v=20260314a",
      },
    ],
    remotePatterns: [
      // Cloudflare R2 public buckets (wildcard patterns)
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      ...(r2PublicHostname
        ? [{ protocol: "https" as const, hostname: r2PublicHostname }]
        : []),
      ...(r2AccountId
        ? [{ protocol: "https" as const, hostname: `${r2AccountId}.r2.cloudflarestorage.com` }]
        : []),
      // Clerk user avatars
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      // Placeholder/fallback image services (optional)
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
  // PostHog reverse proxy to bypass ad blockers (using /api path to skip i18n middleware)
  async rewrites() {
    return [
      {
        source: "/api/ph/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/api/ph/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Required for PostHog proxy to work correctly
  skipTrailingSlashRedirect: true,
};

export default withNextIntl(nextConfig);
