# AfriConnect Mobile App

A React Native mobile application for AfriConnect, built with Expo and wired into the shared monorepo Convex backend.

## Setup

Install dependencies from the monorepo root:

```bash
bun install
```

Create `apps/mobile/.env` with:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

## Development

From the monorepo root:

```bash
bun run dev:mobile
```

You can still run mobile-specific scripts from `apps/mobile` if needed.

## Backend

The mobile app now consumes the shared backend package at `packages/convex` via `@africonnect/convex`.
Use the same Convex deployment as the web app.

## Build

EAS build commands remain defined in `apps/mobile/package.json`.
