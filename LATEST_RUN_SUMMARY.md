# helm-app — Latest Run Summary

**Date:** 2026-03-28
**Session:** PR #2 code review + merge confirmation

---

## Current State

**Branch:** `main` (PR #2 merged 2026-03-28T05:19:57Z)
**Live URL:** https://helm-app-drab.vercel.app
**Last merged:** PR #2 `fix/zoho-created-counter-mutable` (2026-03-28)

---

## What Was Done This Session

### Code Review: `@review-2-code-commit` — APPROVE, zero findings

PR #2 (`fix/zoho-created-counter-mutable`) reviewed and approved. Local checks passed: build, lint, tsc. CI auto-merge completed.

**Fix in `lib/zoho/contacts.ts`:**
- `const created = 0` → `let created` — counter was always 0, never incremented
- Added pre-upsert `select` per batch to identify existing vs new contacts
- `created` and `updated` counters now accurately reflect real creates vs updates
- Return value uses computed `updated` instead of hardcoded `contacts.length`

**PR #2:** https://github.com/coolbossov/helm-app/pull/2 — **MERGED**

---

## Open Items / Next Steps

1. Routes filtering — filter by status, date, or territory
2. Offline mode — cache contacts + map tiles for field use without connectivity
3. Performance — marker clustering, lazy loading for large contact sets
4. Bigin cleanup: review unused custom fields to free slots (currently at 22/22 limit)

---

## Key Architecture Notes

- `lib/zoho/contacts.ts` — Zoho Bigin contact sync; `contactToRow()` never includes visit fields
- Supabase project ID: `lufdqoilfgjjuohteyrs` (listed as "Booksa" in dashboard — ignore the name)
- Supabase MCP tool points to wrong project — use Management API directly for helm-app Supabase ops
- Bigin Companies module API name is `Accounts` — not `Companies`
- Maps JS API v3.56+: `mapId` not required — use `styles` array instead
- Next.js 16: use `eslint .` via `@eslint/eslintrc` flat compat (not `next lint`)
- Discovery contacts use `zoho_id = "place_<place_id>"` prefix — `SUPABASE_ONLY_FIELDS` prevents Bigin push
