# Ohun V2

Accessible, secure, private real-time messaging for friends and family.

This repository is an npm-workspaces TypeScript monorepo. Milestone 1 provides the foundation and **static application shells only** (no authentication or messaging yet).

## Design source

Approved Stitch project only:

https://stitch.withgoogle.com/projects/16264346330507370332

## Workspace layout

```
apps/web          React + Vite + PWA (CSS Modules)
apps/mobile       React Native + Expo (StyleSheet + shared tokens)
apps/api          Express + Socket.IO + TypeScript
packages/contracts        Zod schemas and shared types
packages/api-client       HTTP / socket transport helpers
packages/design-tokens    Colours, typography, spacing, breakpoints
packages/config           Shared TypeScript and ESLint config
tests/e2e                 Playwright scaffold
```

## Prerequisites

- Node.js 22.13+
- npm 10+ (repository pins `packageManager`: npm@11.3.0)

## Setup

```bash
npm install
cp .env.example apps/api/.env
cp .env.example apps/web/.env
```

`.env.example` contains placeholders only. Never commit real secrets.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build:packages` | Build shared packages |
| `npm run dev:web` | Start Vite web app |
| `npm run dev:api` | Start API (tsx watch) |
| `npm run dev:mobile` | Start Expo |
| `npm run lint` | Lint all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run Playwright web smoke tests |
| `npm run build` | Build packages, web, API; validate mobile |
| `npm run build:web` | Production web build |
| `npm run build:api` | Compile API |
| `npm run validate:mobile` | Validate Expo config |

## Milestone 1 scope

Included:

- Monorepo scaffolding
- Shared tokens, contracts, config
- API health endpoint and Socket.IO boot (no messaging)
- Static auth / mobile / tablet / desktop shells
- Loading, empty, offline, and error states
- Quality GitHub Actions workflow

Not included:

- Authentication
- Contacts / friend requests
- Direct or group messaging
- Public rooms
- Dark theme
- Production database / storage / deployment

## Legacy prototype

The V1 MERN prototype is preserved via Git tag `legacy-v1-prototype`. It is not kept in the active V2 tree.

## Brand assets

Ohun logos live under:

- `apps/web/public/brand/`
- `apps/mobile/assets/brand/`
