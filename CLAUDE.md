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

## Architecture Notes

- Pin color semantics (Find Leads mode): pink (#ff0092) = new lead, purple (#9749c1) = selected/queued, teal (#00c2cc) = already in CRM. These are locked — do not change without updating all 3 files: `google-map.tsx`, `find-leads-panel.tsx`, `types/contacts.ts`
- `BusinessType` union + `BUSINESS_TYPE_COLORS` in `types/contacts.ts` is the single source of truth for all business type lists. `filter-panel.tsx` derives its list from this constant — never hardcode a separate list
- `/api/leads/discover` returns `contact_id` for existing CRM entries (select "id, place_id") — required for teal-pin click-to-open-ContactDetail behavior
- `batch-add` API accepts `string | string[]` for `business_type` — backward compat intentional, do not narrow
- Phase 2 (Contacts → Companies/Accounts migration) is blocked on Bigin prerequisites: bulk-assign Business_Type on Accounts, Billing_Street populated, decision on 278 `_unknown_company` records, Accounts single-select picklist behavior confirmed
- Bigin Companies module API name is `Accounts` — not `Companies`. All scripts targeting company records must use `module=Accounts`

## Commands
- `npm run dev` — Start dev server with Turbopack
- `npm run build` — Production build
- `npm run lint` — ESLint
