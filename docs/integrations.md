# HELM App — Integrations

**Last Updated:** 2026-04-13

---

## Supabase

**Purpose:** Primary database. Stores local mirrors of Zoho Bigin data (`synced_companies`, `synced_contacts`), geocode cache, saved routes, route stops, field update queue, visit activity log, sync logs.

**Env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Client-side anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side service role key

**Client files:**
- `lib/supabase/client.ts` — Browser client
- `lib/supabase/server.ts` — Server component client (SSR)
- `lib/supabase/admin.ts` — Service role client

**Auth method:** Supabase Auth email/password for the single admin user. Service role for server-side data operations.

**Failure behavior:** Map data unavailable → empty map with error state. Route save fails → user sees error toast.

**Dashboard:** https://supabase.com/dashboard/project/qnfafwqjjbgiaygrdcoc

**Note:** Project `sapd-internal` on MyStartup.me org, us-east-2. Co-tenant with Portal since 2026-04-24 migration from old shared Booksa DB (`lufdqoilfgjjuohteyrs`).

---

## Zoho Bigin CRM

**Purpose:** Source of truth for SA Picture Day leads (schools, studios, organizations). HELM syncs company and contact data from Bigin into local Supabase tables. CRM push writes field updates back to Bigin Accounts module.

**Env vars:**
- <!-- TODO: verify exact Zoho env var names — likely ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN -->
- All Zoho credentials are server-side only — never exposed to client

**Webhook URL:** None (polling sync only — manual trigger from settings page)

**Auth method:** OAuth 2.0 with refresh token. Lazy on-demand refresh at request time. Tokens managed in `lib/zoho/` — isolated from Mac launchd and n8n token refresh systems.

**API version:** Bigin v2 REST API

**Critical notes:**
- `fields=` param REQUIRED on all GET list calls — omitting returns 400 or all fields (performance hit)
- `CONTACT_FIELDS` constant in `lib/zoho/client.ts` lists all 20 required contact fields
- Companies module API name is `Accounts` — not `Companies`
- Bigin Contacts is at 22/22 custom field limit — `visit_status` and `last_visit_date` are Supabase-only

**Failure behavior:** Sync fails → error shown in settings page. Map data is stale but still usable from local cache.

**Dashboard:** https://bigin.zoho.com

---

## Google Maps JavaScript API

**Purpose:** Interactive map displaying ~2000+ CRM leads as pins. Supports filtering, clustering, and route visualization.

**Env vars:**
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` <!-- TODO: verify exact env var name -->

**Features used:**
- Maps JavaScript API — raster map with inline styles (POI/transit/road-icon suppressed)
- @googlemaps/markerclusterer — pin density management
- Places API (New) — viewport-bounded lead discovery (`/api/leads/discover`)

**Auth method:** API key in JavaScript Maps loader.

**Critical:** Classic `google.maps.Marker` only — NOT `AdvancedMarkerElement` (requires Cloud Map ID, causes runtime error dialog without one).

**Failure behavior:** Map fails to load → blank page. Check API key and Maps JS API billing status in Google Cloud Console.

**Dashboard:** https://console.cloud.google.com

---

## Vercel

**Purpose:** Hosting + CI/CD. Auto-deploys from `main` branch. Hobby plan — daily cron only (no sub-daily schedules).

**Deploy trigger:** Push to `main` via CI squash-merge.

**Note:** `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` was deleted from Vercel project settings (2026-03-31) — do not re-add.

**Dashboard:** https://vercel.com
