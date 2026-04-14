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
- **Docs update is part of every PR — not a follow-up** — any change that touches DB schema, API shape, data flows, auth, or architecture must update the relevant `docs/` file(s) in the same commit:
  - New/altered DB columns or tables → `docs/database.md` (schema + migration history)
  - Architecture or flow change → `docs/architecture.md`
  - Design decision or trade-off → `docs/decisions.md` (add ADR, newest first)
  - New integration or external dependency → `docs/integrations.md`
  - New env var → `docs/environment.md`
  - Any shipped change → `CHANGELOG.md` (add entry under today's date)
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
- Ambiguous company→contact resolution in visit activity logging: when a route stop has `company_id` but no `contact_id`, the API resolves the linked contact via `synced_companies.account_name` match against `synced_contacts.account_name`. If 0 or 2+ contacts match, the activity is logged with `contact_id: null` (safe fallback) rather than throwing. Never assume a company stop has a resolvable contact — always handle the null case in activity logging routes.
- Visit activity meta: all non-resolved resolution reasons (`no_company_name`, `not_found`, `ambiguous`, etc.) must be surfaced in the response — never silently swallow non-success cases. Always handle ALL resolution outcomes uniformly in activity logging routes.
- Bigin v2 API: `fields` param must be passed as a comma-separated string in the query string, not as a JSON body param. Incorrect param format causes the API to return all fields (performance hit) or a 400 silently.
- Zoho sync counters (`created`, `updated`, `unchanged`) must be declared as `let` (mutable) — `const` counters that are never incremented produce permanently-zero counts in sync result logs.
- GitHub squash-merge state lag: when the CI `auto-merge` job shows SUCCESS but a PR still shows OPEN, do NOT re-merge. Verify via `git fetch origin && git show origin/main:path/to/file | grep expected_change`. If the change is present, the merge succeeded — GitHub UI is lagging. Close the PR manually with a note. Only attempt manual merge if the change is confirmed absent from `origin/main`.
- `POST /api/routes/[id]/stops` — adds stops to an existing route. Accepts `{ stop_ids: string[] }` (synced_companies UUIDs), verifies route ownership, resolves company→contact links, appends at `max_order + 1`. Returns `{ data: { added: N } }`. File is a sibling of `[stopId]/route.ts` — do not confuse the two.
- Find Leads route assignment state machine in `find-leads-panel.tsx`: `ConfirmState` = `"idle" | "route-prompt" | "new-route-form" | "existing-route-picker"`. Existing route filter = all non-completed (`status !== "completed"`), sorted by `planned_date` nulls last. After "Save & Stay" on new route = reset to idle (no success banner). After adding to existing = show "Open Route" + "Stay on Map" (no auto-navigate).

- `useIsMobile()` hook at `lib/hooks/use-mobile.ts` — uses `window.matchMedia` with event listener, SSR-safe (initializes to `false`). Exported from `lib/hooks/index.ts`. Use this everywhere instead of `window.innerWidth` checks.
- `bulk_update_stop_order(stop_orders jsonb)` RPC available after migration 018 is applied to production. Use this for all batch stop_order updates — replaces PL/pgSQL loop with single `UPDATE … FROM jsonb_array_elements()`.
- All `SECURITY DEFINER` functions must include `SET search_path = public` — enforced as of migration 018.
- Migration 019 adds GIN trigram indexes on `company_name` and `account_name` — ilike search is now fast. Both migrations 018 + 019 must be applied to Supabase production before optimize feature works correctly.
- PWA manifest at `public/manifest.json`. Theme color `#ff0092`. Start URL `/map`. `display: standalone`.
- `useContacts()` returns `truncated: boolean` — surface this in any UI that displays contact counts. Orange banner shown in map UI when truncated.
- `updateStopStatus` uses snapshot-rollback pattern: snapshots state before optimistic update, restores on server error (non-TypeError), queues offline on network error (TypeError).
- Website URL safety: storage enforces `startsWith("http")` via Zod in `batch-add` API; render enforces `new URL()` + protocol allowlist in `contact-detail.tsx`. Old records with bad URLs render as nothing, not as broken links.
- `maximumScale: 5, userScalable: true` in `app/layout.tsx` — pinch-to-zoom re-enabled. `userScalable: false` is a WCAG violation. Do not revert.
- `h-[100dvh]` used in `app/(app)/layout.tsx` — not `h-screen`. Required for correct mobile viewport height (avoids iOS Safari toolbar overlap). Do not revert.
- Contacts API has a `HARD_LIMIT` constant — response includes `truncated: boolean` when results are capped. `overdue_days` NaN guard added; search wildcard sanitization applied.
- Auth check in `app/api/geocode/route.ts` is before body parse — do not reorder.

- `CompanyMarkerData` is the canonical marker type (renamed from `ContactMarkerData` — alias removed). `ContactMarkerData` no longer exists anywhere in the codebase. Do not re-introduce it.
- `useCompanies()` is the hook name (file remains `lib/hooks/use-contacts.ts` — filename unchanged, only function renamed). Do not rename the file.
- `BuilderStop.company` is the field name (was `BuilderStop.contact`). `BuilderStop.contactId` params renamed to `companyId`. Do not revert.
- `updateStopStatus` returns a typed result: `{ visit_activity: { status, reason?, company_id? } } | { __error: true } | null | void`. The `__error: true` sentinel is intentional — callers check this instead of catching. Do not re-throw.
- `GET /api/visit-log` — returns last 50 visit activities with company name resolution, auth-gated. Lazy-loaded in Settings page (not auto-fetched on mount).
- Migration 020 applied to production: `field_updates.contact_id` is now nullable + CHECK constraint requires at least one of `contact_id` or `company_id`. Company field edits now correctly queue for CRM push.
- Auto-scroll after stop status change: after marking visited or skipped, smooth-scrolls to next pending stop; if none remain, scrolls to progress bar. Files: `app/(app)/routes/[id]/page.tsx`, `components/route/stop-list.tsx`.
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` removed from `.env.local.example` — still present in Vercel project settings (manual delete required — Vercel MCP has no env var delete endpoint).

## Commands
- `npm run dev` — Start dev server with Turbopack
- `npm run build` — Production build
- `npm run lint` — ESLint
