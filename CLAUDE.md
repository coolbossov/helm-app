# SAPD Ops — Field Sales Map Application

## Project Overview
Interactive Google Map app for SA Picture Day field sales. Displays ~2000+ CRM leads from Zoho Bigin with filtering, route planning, and mobile driving mode.

## Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Database**: Supabase (separate project from SAIL)
- **Auth**: Supabase Auth (email/password, single user)
- **Map**: Google Maps JavaScript API + @googlemaps/markerclusterer
- **CRM**: Zoho Bigin REST API (server-side, OAuth refresh token)
- **Styling**: Tailwind CSS 4 (mobile-first)
- **Icons**: Lucide React
- **Validation**: Zod

## Conventions
- Use `@/*` import alias for all project imports
- Server components by default; add `"use client"` only when needed
- API routes in `app/api/` use Route Handlers
- Supabase clients: browser (`lib/supabase/client.ts`), server (`lib/supabase/server.ts`), admin (`lib/supabase/admin.ts`)
- All Zoho API calls are server-side only (tokens never exposed to client)
- Use `cn()` utility for conditional class merging (clsx + tailwind-merge)
- Mobile-first responsive design; no glassmorphism
- Type definitions in `types/` directory
- React hooks in `lib/hooks/`

## Route Groups
- `(auth)` — Login page (public)
- `(app)` — Protected app routes (map, settings)

## Key Patterns
- Zoho field mappings handle actual_value → display_value conversion
- Geocode results cached in `geocode_cache` table to minimize API costs
- Map markers loaded all at once (~200 bytes each), filtered client-side
- Detail data fetched on marker click (too large to preload for all)
- CRM sync is manual (Phase 1), triggered from settings page

## Git workflow (enforced — no exceptions)

- **Never commit directly to `main`** — all code changes go through a branch + PR
- **Auto-branch on first code edit** — the moment a session transitions from research/planning to implementation, create a branch before the first file edit. Use prefix conventions: `feat/`, `fix/`, `chore/`, `docs/`
- **End of session** — run `@review-2-code-commit` before pushing. This triggers the `opencode-review` GitHub Action on the PR automatically
- CI passes → PR is squash-merged automatically and branch is deleted

## Commands
- `npm run dev` — Start dev server with Turbopack
- `npm run build` — Production build
- `npm run lint` — ESLint
