# HELM App — Database

**Last Updated:** 2026-04-13

**Supabase Project:** `lufdqoilfgjjuohteyrs` (displayed as "Booksa" in dashboard — correct project for HELM)

RLS enabled on all tables. Single admin user — no per-user data isolation needed. All "any authenticated user" access is by design (single-user app). Do not add per-user RLS or ownership checks.

Migration approach: SQL files in `supabase/migrations/001` through `020`. Applied sequentially via `supabase db push --linked --yes`. Migrations 012 and 013 were applied directly outside `db push` — sentinel rows inserted to restore tracking alignment.

**Current state:** All migrations 001–020 applied to production.

---

## Key Tables

### `synced_companies` (primary entity — migration 014)
Local mirror of Zoho Bigin Accounts module. One row per organization.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | HELM internal ID |
| `zoho_account_id` | text UNIQUE | Bigin Account ID |
| `company_name` | text | Organization name |
| `business_type` | text | Single string (Bigin Accounts picklist is single-select) |
| `billing_street` / `billing_city` / `billing_state` / `billing_zip` | text | Address for geocoding and navigation |
| `latitude` / `longitude` | double precision | Geocoded coordinates |
| `geocode_status` | text | `pending` / `success` / `failed` / `no_address` |
| `place_id` | text UNIQUE | Google Places ID (for Find Leads deduplication) |
| `visit_status` | text | Supabase-only — never synced to Bigin |
| `last_visit_date` | date | Supabase-only — never synced to Bigin |
| `priority` / `lifecycle_stage` / `contacting_status` | text | CRM-synced classification fields |
| `contacting_tips` / `prospecting_notes` | text | Notes from CRM |

**Note:** `business_type` on companies = single string. `business_type` on contacts = string[]. Do not conflate.

**RLS:**
- `"Authenticated users can read companies"` — SELECT for authenticated
- `"Service role can manage companies"` — ALL for service_role

---

### `synced_contacts` (legacy — migration 001)
Local mirror of Zoho Bigin Contacts module. Kept for legacy visit activity fallback (linked by `account_name`).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | — |
| `zoho_id` | text UNIQUE | Bigin Contact ID |
| `last_name` / `first_name` | text | — |
| `account_name` | text | Links to company (by name) |
| `business_type` | text[] | Multi-select array (Contacts picklist is multi-select) |
| `latitude` / `longitude` | double precision | Geocoded coordinates |
| `geocode_status` | text | `pending` / `success` / `failed` / `no_address` |

**RLS:** Same as synced_companies.

---

### `geocode_cache` (migration 002)
Caches Google Maps geocoding results to minimize API costs. Keyed by address string.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | — |
| `address` | text UNIQUE | Full address string |
| `latitude` / `longitude` | double precision | Geocoded result |
| `place_id` | text | Google place ID |
| `status` | text | `success` / `failed` |

---

### `saved_routes` (migration 003)
Planned driving routes. One route per planning session.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | — |
| `user_id` | uuid FK → auth.users | Single admin user |
| `name` | text | Route display name |
| `status` | text | `planned` / `in_progress` / `completed` |
| `planned_date` | date | Optional target date |

**RLS:** `"Users can manage own routes"` — authenticated user can only access their own routes.

---

### `route_stops` (migrations 004, 015, 017)
Ordered stops within a route. References companies (primary) and optionally contacts (legacy).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | — |
| `route_id` | uuid FK → saved_routes | — |
| `company_id` | uuid FK → synced_companies NULLABLE | Added migration 015 |
| `contact_id` | uuid FK → synced_contacts NULLABLE | Legacy fallback |
| `stop_order` | integer | Display/navigation order |
| `status` | text | `pending` / `visited` / `skipped` |
| `visit_notes` | text NULLABLE | — |

**Ordering:** `route_stops` company-first ordering (migration 017). Stops added via `POST /api/routes/[id]/stops` at `max_order + 1`.

---

### `field_updates` (migrations 006, 016, 020)
Queue of pending CRM field edits to push to Bigin.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | — |
| `contact_id` | uuid FK → synced_contacts NULLABLE | Migration 020: nullable + CHECK constraint |
| `company_id` | uuid FK → synced_companies NULLABLE | Added migration 016 |
| `field_name` | text | Bigin field name |
| `old_value` / `new_value` | text | Value change |
| `status` | text | `pending` / `pushed` / `failed` |

**Constraint (migration 020):** At least one of `contact_id` or `company_id` must be non-null. Company field edits route to `PUT /Accounts/{zoho_account_id}`. Contact field edits route to `PUT /Contacts/{zoho_id}`.

---

### `contact_activities` (migration 009)
Visit activity log. Records field visits, status changes.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | — |
| `contact_id` | uuid FK → synced_contacts NULLABLE | Resolved from company via account_name match |
| `company_id` | uuid FK → synced_companies NULLABLE | Direct company reference |
| `activity_type` | text | `visit` / `skip` etc. |
| `status` | text | Visit outcome |
| `reason` | text NULLABLE | Non-success resolution reason (all reasons surfaced, never swallowed) |
| `created_at` | timestamptz | — |

---

## Key RPCs

### `bulk_update_stop_order(stop_orders jsonb)`
Batch updates `stop_order` for multiple route stops atomically via `UPDATE … FROM jsonb_array_elements()`. Requires migration 018. All `SECURITY DEFINER` functions include `SET search_path = public`.

---

## Migration History

| Migration | Purpose |
|-----------|---------|
| 001 | `synced_contacts` table |
| 002 | `geocode_cache` table |
| 003 | `saved_routes` table |
| 004 | `route_stops` table |
| 005 | `sync_logs` table |
| 006 | `field_updates` table |
| 007 | `updated_at` trigger function |
| 008 | Fix priority constraint |
| 009 | `contact_activities` table |
| 010 | Coverage view |
| 011 | Route enhancements |
| 012 | Visit tracking columns (applied directly — sentinel row inserted) |
| 013 | `place_id` column (applied directly — sentinel row inserted) |
| 014 | `synced_companies` table (primary entity) |
| 015 | `route_stops.company_id` FK |
| 016 | `field_updates.company_id` FK |
| 017 | Route stops company-first ordering |
| 018 | `bulk_update_stop_order` RPC + GIN trigram indexes (must verify applied) |
| 019 | GIN trigram indexes on `company_name` / `account_name` for ilike search |
| 020 | `field_updates.contact_id` nullable + CHECK constraint |
