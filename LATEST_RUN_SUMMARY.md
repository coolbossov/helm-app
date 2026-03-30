# helm-app — Latest Run Summary

**Date:** 2026-03-30  
**Session:** 48h Comprehensive Review — Post-PR Cleanup  
**Branch at close:** `main` @ `35e761e`

---

## Current State

- `main` is fully clean — no open PRs, no pending branches
- **Supabase production:** migrations 001–019 all applied ✅
- **Vercel production:** deploy `dpl_WJtVPVVFDTUGo9nvpsX53kjt5eGN` — READY, 0 runtime errors
- **CLAUDE.md:** 13 architecture notes committed to main (`919582f`)

---

## What Was Done This Session

PR #34 (`fix/review-48h-fixes`) merged — 31 fixes across 25 files:

**Security:** auth check before body parse in `/api/geocode`; XSS URL allowlist (Zod + `new URL()`); `bulk_update_stop_order` RPC with `SET search_path = public`; `place_id` length cap + regex; `metadata` POST 50-key/1KB cap.

**Bugs:** `handleOptimize` try/finally (spinner never freezes); `deleteRoute` checks `res.ok`; `updateStopStatus` snapshot-rollback; `companyCount` unified on `linkedStops`; `strict_time_windows` clears stale data; `overdue_days` NaN guard; PostgREST ILIKE comma quoting + wildcard sanitization; website URL dual-layer safety.

**Performance:** N sequential UPDATEs → `bulk_update_stop_order` RPC (migration 018); GIN trigram + performance indexes (migration 019); Cache-Control headers; contacts 10k hard limit + truncation flag.

**Mobile/UX:** `h-[100dvh]` iOS Safari fix; pinch-to-zoom re-enabled (WCAG); PWA manifest; touch targets ≥44px; Apple Maps iOS-only; mobile nav `text-xs`.

**New files:** `lib/hooks/use-mobile.ts`, `public/manifest.json`, `supabase/migrations/018_bulk_update_stop_order.sql`, `supabase/migrations/019_search_indexes.sql`

Post-PR cleanup: migrations 018+019 applied to production; CLAUDE.md +13 lines committed; changelogs created.

---

## Key Architecture Facts (for next session)

- `useIsMobile()` at `lib/hooks/use-mobile.ts` — SSR-safe, exported from `lib/hooks/index.ts`
- `bulk_update_stop_order(stop_orders jsonb)` RPC — use for all stop reordering (migration 018)
- All `SECURITY DEFINER` functions require `SET search_path = public`
- `h-[100dvh]` in `app/(app)/layout.tsx` — do not revert
- `maximumScale: 5, userScalable: true` — do not revert (WCAG)
- Auth check in `app/api/geocode/route.ts` is before `request.json()` — do not reorder
- Migrations 001–019 all applied to production
- Supabase project ID: `lufdqoilfgjjuohteyrs` (listed as "Booksa" in dashboard — ignore the name)
- Supabase MCP tool points to wrong project — use Management API directly for helm-app Supabase ops
- Next.js 16: use `eslint .` via `@eslint/eslintrc` flat compat (not `next lint`)

---

## Remaining Backlog (non-blocking)

| Item | Priority |
|------|----------|
| Auto-scroll to next pending stop after marking visited | P1 (driving safety) |
| Routes filtering (status/date/territory) | P2 |
| Offline replay conflict resolution (last-write-wins silent) | P2 |
| IDB-cache race condition (concurrent `openDB()` calls) | P2 |
| Test scaffold (vitest + testing-library) | P3 |
| Remove `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` from Vercel env vars | P3 (dead config) |

---

## Next Session Start

1. Check GitHub Projects Master Board for any new issues
2. Pick from backlog — P1 auto-scroll is the highest-value next item
3. `git pull` — main is clean, no conflicts expected
