# Workspace

## Overview

Multi-tenant marketing SaaS application (Synozur) for generating and managing social media posts across multiple organizations. Built as a pnpm workspace monorepo using TypeScript.

## Synozur Platform Ecosystem

- **Constellation**: Project delivery platform. Codebase: https://github.com/chris-mcnulty/synozur-scdp
- **Orbit**: Marketing analytics app. Codebase: https://github.com/chris-mcnulty/synozur-orbit

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + Wouter + TanStack React Query
- **AI**: OpenAI via Replit AI Integrations (gpt-4o-mini for content extraction and post variations)
- **Auth**: Session-based (express-session + bcryptjs), no JWT

## Core Features

- **Multi-tenant auth**: Register creates organization + admin user + default categories. Session-based with role support (admin/standard).
- **Content Asset Library**: Add URLs, AI-powered content extraction (cheerio + OpenAI for summaries), category tagging, active/inactive toggle.
- **Brand Asset Library**: Manage brand images with titles, descriptions, and tags.
- **Campaign Management**: Create campaigns with scheduling (start date, duration, posts/day, posting times), assign assets and social accounts.
- **SocialPilot CSV Export**: Generate bulk posts with AI-powered variation for repeated content. Max 500 posts per export.
- **Social Account Management**: Configure social media accounts with SocialPilot account IDs.
- **Settings**: Manage organization profile, content categories, and team members.

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── marketing-app/      # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/  # OpenAI AI integration
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with session-based auth, multi-tenant data isolation, AI content extraction, and SocialPilot CSV generation.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, express-session, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers for auth, categories, assets, brand-assets, campaigns, social-accounts, tenant, csv
- Middleware: `src/middlewares/auth.ts` — `requireAuth` (session check), `requireAdmin` (role check)
- Content Extractor: `src/lib/contentExtractor.ts` — cheerio + OpenAI for URL metadata extraction
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-openai-ai-server`

### `artifacts/marketing-app` (`@workspace/marketing-app`)

React + Vite frontend with TailwindCSS, Wouter routing, TanStack React Query.

- Pages: login, register, dashboard, assets, brand-assets, campaigns, campaign-detail, social-accounts, settings
- Layout: sidebar navigation with mobile responsive drawer
- Auth context: auto-redirects to login when unauthenticated
- API client: uses generated React Query hooks from `@workspace/api-client-react` with `credentials: "include"` for session cookies
- **Branding**: Aurora visual theme matching Constellation (project delivery platform at https://github.com/chris-mcnulty/synozur-scdp)
- **Brand Colors**: Primary #810FFB (purple), Secondary #E60CB3 (magenta)
- **Font**: Avenir Next LT Pro (Light 300, Regular 400, Italic 400i, Demi 600, Bold 700, Bold Italic 700i) — files in `public/fonts/`
- **Theme**: Light + Dark mode with ThemeProvider (localStorage-persisted, cycles light/dark/system)
- **Aurora CSS**: Gradient utilities (`.synozur-gradient`, `.synozur-gradient-text`, `.aurora-bg`), sidebar active gradient bar, page header gradient bar, glass card effects

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

Schema tables: tenants, users, categories, assets, brandAssets, campaigns, campaignAssets, socialAccounts, campaignSocialAccounts

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by api-server for request validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec. Custom fetch includes `credentials: "include"` for session cookies.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Run via `pnpm --filter @workspace/scripts run <script>`.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` — Secret for express-session (has fallback default)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-set by Replit AI Integrations
