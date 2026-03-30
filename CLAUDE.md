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
- HELM is a single-user app (one admin account via Supabase Auth) — security review findings about "any authenticated user accessing global data" are false positives. All routes use the same admin client pattern by design. Do not add per-user RLS or ownership checks.
- Supabase dynamic select typing: `.select()` with a runtime string variable loses TypeScript inference and returns `GenericStringError`. Use `.returns<Array<Record<string, unknown>>>()` to cast the result type explicitly.
- CI squash-merge timing: commits pushed after CI begins merging may not be included in the squash. Always verify the merge SHA includes all intended commits before closing a PR.
- Push sync uses preview-then-confirm pattern: `GET /api/sync/push/preview` (read-only) → user confirms → `POST /api/sync/push`. Never skip the preview step.
- Pull sync returns field-level diff: `SyncResult` includes `created`/`updated`/`unchanged` counts + `details[]` array with per-contact `fieldsChanged[]`. Diff is computed on-the-fly — no DB table, no migration needed.
- Primary entity is now `synced_companies` (Bigin Accounts module). `synced_contacts` is kept for legacy activities fallback (linked by `account_name`). All map-facing APIs return compatibility-shaped responses: field name normalization so frontend receives `last_name`, `zoho_id`, `account_name`, `business_type: string[]` regardless of source table.
- `business_type` on companies = single string (Accounts picklist is single-select). `business_type` on contacts = string[] (Contacts picklist is multi-select). Never conflate the two.
- Geocode batch for companies: POST `/api/geocode?target=companies&batch=true` — requires explicit `?batch=true` to prevent accidental full-table geocode runs.
- Push processor routes company field updates to `PUT /Accounts/{zoho_account_id}` (not `/Contacts`). `field_updates` rows with `company_id` set are routed to Accounts; rows with `contact_id` set go to Contacts.
- Phase 3 (route app polish) shipped: `company_name` shown in route stops, `billing_street` used for navigation, `company_id` FK wired in route stops ordering.
- Migrations shipped: 014 (`synced_companies` table), 015 (`route_stops.company_id` FK), 016 (`field_updates.company_id` FK), 017 (`route_stops` company-first ordering). Migration 017 must be applied to Supabase production manually — company-only stops won't sort correctly until then.
- Coordinate null guards: always use `lat != null && lng != null` (not `lat && lng`) — valid `0` coordinates must not be falsy-dropped.
- `companyCount` presence check: use `synced_companies?.id != null || synced_contacts?.id != null` — never rely on truthy object check for linked records.
- Supabase migration tracking: `supabase db push` fails when `CREATE POLICY` statements aren't idempotent and `supabase_migrations.schema_migrations` is out of sync with what's actually applied. Fix: manually INSERT sentinel rows for already-applied migrations (`INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('NNN', 'name', '{}') ON CONFLICT DO NOTHING`) then re-run push. Always check `schema_migrations` before assuming `db push` will work cleanly on production.
- `supabase db push --linked --yes` flag required for non-interactive shells (CI, scripts) — omitting `--yes` causes push to hang waiting for confirmation.
- Migrations 012 and 013 were applied directly to production outside of `db push` — sentinel rows inserted manually to restore tracking table alignment. Current production state: migrations 001–017 all applied and tracked.

## Commands
- `npm run dev` — Start dev server with Turbopack
- `npm run build` — Production build
- `npm run lint` — ESLint
