# Workspace

## Overview

Multi-tenant marketing SaaS application (**Saturn** — formerly Synozur) for generating and managing social media posts across multiple organizations. Built as a pnpm workspace monorepo using TypeScript. Implements Orbit's user/tenant management patterns for enterprise-grade multi-tenancy.

## Synozur Platform Ecosystem

- **Constellation**: Project delivery platform. Codebase: https://github.com/chris-mcnulty/synozur-scdp
- **Orbit**: Marketing analytics app. Codebase: https://github.com/chris-mcnulty/synozur-orbit
- **Saturn**: Marketing content management & SocialPilot export app (this project)

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
- **AI (text)**: Anthropic Claude Sonnet 4-6 via Replit AI Integrations (content extraction and post variations)
- **AI (image/audio)**: OpenAI via Replit AI Integrations (image generation, audio)
- **Auth**: Session-based (express-session + bcryptjs), no JWT. Entra SSO support (planned).

## Core Features

- **Multi-tenant auth**: Domain-based tenant provisioning. First user for a domain becomes Domain Admin. Session-based with Orbit role system.
- **Market Hierarchy**: Tenant → Market hierarchy. Each tenant auto-gets a default market on creation. One default market per tenant enforced server-side. All major entities (assets, brand assets, categories, campaigns, social accounts, product tags, generated posts/emails) have optional `marketId` FK. List endpoints accept `?market_id=` query filter. Auth responses include `markets[]` array. Full CRUD at `/markets` with admin middleware, validation, and default invariant protection. Admin CRUD at `/admin/tenants` (POST/DELETE). Grounding docs support three-tier scoping. Frontend: MarketContext provider with localStorage persistence (`saturn_active_market_id`), market picker dropdown in sidebar, Markets management page, Tenant Admin page for Global Admins.
- **Roles**: Global Admin, Domain Admin, Standard User, Consultant (from Orbit)
- **Service Plans**: trial (60-day), free, pro, enterprise — with feature flags (JSONB), usage limits, user limits
- **Domain Blocklist**: Blocks personal email providers (gmail, yahoo, hotmail, etc.) from self-registration
- **Tenant Invites**: Domain/Global Admins can invite users with token-based acceptance flow
- **Consultant Access**: Global Admin can grant consultants read access to specific tenants
- **Content Asset Library**: Add URLs, AI-powered content extraction (cheerio + OpenAI for summaries), category tagging, active/inactive toggle. Per-asset @mentions and hashtags that persist through all generated post variations.
- **Brand Asset Library**: Manage brand images with titles, descriptions, and tags. Category management UI with create/edit/delete. Edit/delete buttons always visible on cards.
- **Product Tags**: Many-to-many product/service offering tags (e.g., "Vega", "M365 Readiness", "Company OS") that can be assigned to both content assets and brand assets. CRUD management + junction tables (`asset_product_tags`, `brand_asset_product_tags`).
- **Campaign Management**: Create campaigns with scheduling (start date, duration, posts/day, posting times), assign assets and social accounts.
- **Multi-Platform CSV Export**: Generate bulk posts with AI-powered variation. Supports SocialPilot, Hootsuite, Sprout Social, and Buffer formats. Max 500 posts per export. AI calls (hashtag generation + 3 text variations per asset) are pre-generated in parallel with bounded concurrency (5 concurrent asset batches) to avoid timeouts on large campaigns. Generated posts are persisted to the `generated_posts` table so they survive page refreshes and can be re-exported without regeneration.
- **Social Account Management**: Configure social media accounts with SocialPilot account IDs.
- **AI Grounding Documents**: Upload files (PDF, DOCX, TXT, Markdown) or paste text for brand voice guidelines, messaging frameworks, marketing guidelines, and methodology docs. Files are extracted to text server-side using pdf-parse and mammoth. Tenant-scoped, active/inactive toggle. Active docs are automatically injected into AI prompts for content extraction and post variation generation.
- **Promotional Email Generator**: AI-powered email generation for content assets. Select one or more assets, choose target platform (Outlook, HubSpot Marketing, HubSpot 1:1, Dynamics 365), set optional tone/CTA/recipient context. Generates platform-tailored email body with subject line suggestions and coaching tips. Copy-to-clipboard support. Asset selector includes category filter, date range (from/to) pickers, and Select All / Deselect All toggle. Generated emails can be saved to database (`generated_emails` table), listed, viewed, and deleted via the Saved Emails panel.
- **Settings**: Manage organization profile, content categories, team members, and active market details.

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── marketing-app/      # React + Vite frontend
├── extensions/
│   └── saturn-capture/     # Chromium browser extension for asset capture
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── integrations-anthropic-ai/      # Anthropic AI integration (text generation)
│   └── integrations-openai-ai-server/  # OpenAI AI integration (image/audio)
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
- Routes: `src/routes/index.ts` mounts sub-routers for auth, categories, assets, brand-assets, campaigns, social-accounts, tenant, csv, admin, grounding-docs, markets
- Auth routes: `src/routes/auth.ts` — register (domain-based with blocklist check), login (SSO-aware), me, logout, Entra SSO status
- Admin routes: `src/routes/admin.ts` — service plans CRUD, domain blocklist, tenant management, user management, tenant invites, consultant access
- Middleware: `src/middlewares/auth.ts` — `requireAuth`, `requireAdmin` (Domain Admin+), `requireGlobalAdmin`
- Services: `src/services/plan-policy.ts` — feature registry, plan limits, DB-cached plan features with TTL
- Content Extractor: `src/lib/contentExtractor.ts` — cheerio + Anthropic Claude for URL metadata extraction (uses grounding context)
- Grounding Context: `src/lib/groundingContext.ts` — fetches active grounding docs for a tenant and formats them for AI prompt injection
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-anthropic-ai`, `@workspace/integrations-openai-ai-server`

### `artifacts/marketing-app` (`@workspace/marketing-app`)

React + Vite frontend with TailwindCSS, Wouter routing, TanStack React Query.

- Pages: login, register, dashboard, assets, brand-assets, campaigns, campaign-detail, social-accounts, grounding-docs, settings, markets, admin-tenants
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

Schema tables:
- **Core**: tenants, users, categories, assets, brandAssets, brandAssetCategories, campaigns, campaignAssets, socialAccounts, campaignSocialAccounts, groundingDocuments, productTags, assetProductTags, brandAssetProductTags, markets
- **Orbit patterns**: servicePlans, emailVerificationTokens, tenantInvites, domainBlocklist, consultantAccess

Tenants table: domain (unique), name, plan, status, trial dates, user/analysis/competitor limits, Entra SSO fields, branding colors
Users table: tenantId (FK), email, passwordHash, name, role, avatar, entraId, authProvider, emailVerified, status

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by api-server for request validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec. Custom fetch includes `credentials: "include"` for session cookies.

### `extensions/saturn-capture`

Chromium/Edge browser extension (Manifest V3) for capturing web content and images while browsing.

- **Content Asset Capture**: Click popup button to grab current page's title, URL, meta description, and OG image
- **Image Asset Capture**: Right-click any image → "Capture Image for Saturn" to grab image URL, page title, alt text
- **Also Add to Brand Assets**: When sending content assets, checkbox option to also add captured OG images to brand assets (with URL-based duplicate detection)
- **Separate storage**: Content assets and image assets stored in separate lists via chrome.storage.local
- **Edit/Delete**: Inline editing of all fields, per-item deletion
- **CSV Export**: Content assets → `url,title,description`; Image assets → `image_url,title,description,tags` — matches Saturn's import format
- **Branding**: Saturn/Synozur dark theme (#810FFB primary, #E60CB3 secondary)
- **Installation**: Side-load as unpacked extension in Chrome/Edge Developer Mode

### `scripts` (`@workspace/scripts`)

Utility scripts package. Run via `pnpm --filter @workspace/scripts run <script>`.

## Database Schema Notes

- **ID columns**: All tables use `serial` primary keys (auto-increment integers). Never change to varchar/UUID.
- **Roles**: "Global Admin", "Domain Admin", "Standard User", "Consultant" — stored as text
- **Service Plans**: trial, free, pro, enterprise — features stored as JSONB, limits as integer columns
- **Domain Blocklist**: Seeded with common personal email providers (gmail.com, yahoo.com, etc.)
- **Zod date issue**: Always convert string dates to Date objects before safeParse. Do NOT use Zod `.parse()` on route responses.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` — Secret for express-session (has fallback default)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Auto-set by Replit AI Integrations
- `ENTRA_CLIENT_ID` — (Optional) Azure AD App Registration Client ID for Entra SSO
- `ENTRA_TENANT_ID` — (Optional) Azure AD Tenant ID for Entra SSO
- `ENTRA_CLIENT_SECRET` — (Optional) Azure AD Client Secret for Entra SSO
