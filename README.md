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

## Environment

- Web expects `NEXT_PUBLIC_CONVEX_URL`
- Mobile expects `EXPO_PUBLIC_CONVEX_URL`
- Convex deploys use `CONVEX_DEPLOY_KEY`

Both apps should point at the same Convex deployment.

## CI and Deploy

- `.github/workflows/ci.yml` runs the web lint, type-check, unit, e2e, and build jobs from the monorepo root.
- `.github/workflows/deploy-convex.yml` deploys `packages/convex` using `CONVEX_DEPLOY_KEY`.
- Mobile EAS builds remain managed from `apps/mobile`.
