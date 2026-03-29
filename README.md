# AfriConnect Monorepo

AfriConnect now lives in a Bun workspace monorepo with preserved Git history for the imported web and mobile apps.

## Layout

- `apps/web`: Next.js web app
- `apps/mobile`: Expo mobile app
- `packages/convex`: shared Convex backend and generated API/types

## Install

```bash
bun install
```

Run installs from the monorepo root.

## Development

```bash
bun run dev:convex
bun run dev:web
bun run dev:mobile
```

Run Convex in one terminal and either web or mobile in another.