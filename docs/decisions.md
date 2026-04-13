# HELM App — Architecture Decision Records

**Last Updated:** 2026-04-13

---

## [2026-02-01] Classic google.maps.Marker — Not AdvancedMarkerElement

**Context:** Google Maps JS API recommends `AdvancedMarkerElement` as the modern approach. HELM renders ~2000+ pins.

**Decision:** Use classic `google.maps.Marker` exclusively.

**Why:** `AdvancedMarkerElement` requires a valid Cloud Map ID. Without one it shows a runtime error dialog and completely blocks map rendering. HELM does not use a Map ID and provisioning one adds unnecessary GCP management overhead. Classic `Marker` works reliably with markerclusterer.

**Alternatives considered:**
- AdvancedMarkerElement with a Cloud Map ID — rejected; adds GCP dependency and the env var `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` was already deleted from Vercel settings (2026-03-31)

---

## [2026-02-15] Supabase-Only Visit Tracking — No Bigin Writeback

**Context:** Bigin Contacts module is at 22/22 custom field limit. HELM needs to track `visit_status` and `last_visit_date` per company.

**Decision:** `visit_status` and `last_visit_date` live only in `synced_companies` (Supabase). They are never pushed to Bigin. `contactToRow()` never includes these fields so Bigin syncs cannot overwrite them.

**Why:** Can't add more fields to Bigin without removing existing ones. Supabase-only fields are faster to write (no OAuth call) and keep the CRM clean. Visit data is operational, not CRM-strategic.

**Alternatives considered:**
- Use an existing Bigin field as a proxy — rejected; semantic mismatch causes confusion
- Remove a less-used Bigin custom field to make room — rejected; disruptive and risky

---

## [2026-03-01] Push Sync Uses Preview-Then-Confirm Pattern

**Context:** Pushing field updates to Bigin is irreversible. Mistakes can overwrite CRM data.

**Decision:** Push sync is always two steps: `GET /api/sync/push/preview` (read-only diff) → user reviews → `POST /api/sync/push` (execute). The preview step cannot be skipped.

**Why:** Sales reps need to verify what will change before committing. A single-step push with an "are you sure?" dialog isn't sufficient for complex multi-company updates. The preview diff shows exactly which fields will change on which accounts.

**Alternatives considered:**
- Single-step push with confirmation modal — rejected; modal fatigue causes users to click through without reading
- Undo after push — rejected; Bigin doesn't support undo and re-pull would overwrite local changes

---

## [2026-03-10] `synced_companies` as Primary Entity — Bigin Accounts Module

**Context:** Original HELM was built around `synced_contacts` (Bigin Contacts). SA Picture Day's primary CRM entities are organizations (schools, studios), not individual contacts.

**Decision:** Migrate primary entity to `synced_companies` (mirroring Bigin `Accounts` module). `synced_contacts` kept for legacy activities fallback only. All map-facing APIs return compatibility-shaped responses.

**Why:** Schools are the sales target, not individual contacts. Accounts/companies map 1:1 to map pins. Contact data is secondary (used for logging visit activities). The Bigin Accounts module is named `Accounts` in the API — not `Companies`.

**Alternatives considered:**
- Keep contacts as primary, join to accounts — rejected; creates 1:N mapping problem for map pins (multiple contacts per school)

---

## [2026-03-20] Three Isolated Zoho Token Refresh Systems — No Centralization

**Context:** Zoho OAuth refresh tokens expire. Three systems need fresh tokens: Mac launchd (local scripts), n8n Token Manager (automation), and HELM inline (web app).

**Decision:** Each system manages its own token refresh independently. No shared state.

**Why:** Each system runs in a different context (local shell vs. VPS vs. serverless function). Centralizing would require a shared token store (Redis or DB) with locking semantics to prevent token race conditions. The complexity cost exceeds the benefit. HELM uses lazy on-demand refresh — token is refreshed at request time if expired.

**Alternatives considered:**
- Shared Redis token store — rejected; adds infrastructure dependency and requires distributed locking
- Single centralized refresh service — rejected; single point of failure; no benefit given isolated usage patterns

---

## [2026-03-25] `__error: true` Sentinel Pattern for `updateStopStatus`

**Context:** `updateStopStatus` has three possible non-success outcomes: server error (restore snapshot), network error (queue offline), and null (no activity logged). Throwing exceptions would require callers to use try/catch, complicating the async route stop UX.

**Decision:** `updateStopStatus` returns a typed sentinel: `{ visit_activity: ... } | { __error: true } | null | void`. Callers check for `__error: true` instead of catching.

**Why:** Cleaner caller code — no try/catch blocks in the UI layer. The `__error` sentinel is explicit and typed, unlike `null` which is ambiguous. Snapshot-rollback logic lives inside the function, keeping callers simple.

**Alternatives considered:**
- Re-throw — rejected; forces all callers to wrap in try/catch, creates verbose error handling in stop-list.tsx
- Error state in Zustand — rejected; stop status is server-authoritative; optimistic local state only valid during the request window

---

## [2026-03-30] `bulk_update_stop_order` RPC for Batch Reordering

**Context:** Drag-and-drop route stop reordering requires updating `stop_order` for multiple rows atomically.

**Decision:** `bulk_update_stop_order(stop_orders jsonb)` RPC (migration 018) handles all batch stop_order updates. Replaces a PL/pgSQL loop with a single `UPDATE … FROM jsonb_array_elements()`.

**Why:** A single RPC call is atomic and far faster than N individual UPDATE calls. The `jsonb_array_elements()` approach avoids the N+1 query pattern. All `SECURITY DEFINER` functions include `SET search_path = public` (enforced as of migration 018).

**Alternatives considered:**
- App-side loop of individual UPDATEs — rejected; not atomic, slow, and causes N database round trips
