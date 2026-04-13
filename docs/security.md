# HELM App — Security

**Last Updated:** 2026-04-13

---

## Authentication

HELM is a single-user application. One admin account via Supabase Auth (email/password). There are no multiple users, roles, or public-facing access.

**Login flow:**
1. User submits email/password to `app/(auth)/login`
2. Supabase Auth validates credentials
3. Session cookie set via `@supabase/ssr`
4. Protected `(app)` route group checks session on every request

**All API routes are auth-gated.** Unauthenticated requests return 401. Auth check in `app/api/geocode/route.ts` is explicitly before body parse — do not reorder.

---

## Route Group Protection

- `(auth)` group — public (login only)
- `(app)` group — protected; layout verifies active Supabase session before rendering

---

## Row Level Security (RLS)

RLS is enabled on all tables. However, because HELM is a single-user app, all "any authenticated user" policies are correct by design. Security review findings about "any authenticated user accessing global data" are false positives — do not add per-user ownership checks.

| Table | Policy |
|-------|--------|
| `synced_companies` | Authenticated users read; service role full |
| `synced_contacts` | Authenticated users read; service role full |
| `geocode_cache` | <!-- TODO: verify RLS on geocode_cache --> |
| `saved_routes` | `auth.uid() = user_id` — user owns their own routes |
| `route_stops` | <!-- TODO: verify RLS on route_stops --> |
| `field_updates` | Service role full access |
| `contact_activities` | Service role full access |

---

## Zoho API Token Security

- All Zoho OAuth credentials are server-side only (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`)
- Tokens never exposed to the browser client
- Token refresh is lazy on-demand (in `lib/zoho/client.ts`) — no background token refresh job in HELM
- Three isolated token refresh systems (Mac launchd, n8n, HELM inline) cannot share state by design

---

## Google Maps API Key

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is client-side (required for Maps JS SDK)
- Restrict this key in Google Cloud Console to specific referrer domains (booksa.sapicture.day, route.sapicture.day) and to Maps JavaScript API + Places API only

---

## Data Protection

- `synced_companies` / `synced_contacts` contain CRM contact PII (names, phone, email, address)
- Data is internal-only — no public endpoints expose this data
- `website` URLs validated: Zod `.startsWith("http")` at storage, `new URL()` + protocol allowlist at render. Old records with non-http URLs render as nothing, not broken links.
- Discovery leads use `zoho_id = "place_<place_id>"` prefix — `SUPABASE_ONLY_FIELDS` in sync handler prevents these from being pushed to Bigin

---

## PWA / Mobile

- `maximumScale: 5, userScalable: true` in `app/layout.tsx` — WCAG compliant; do not revert to `userScalable: false`
- Service Worker (`public/sw.js`) is a self-unregistering no-op — clears legacy `sapd-shell` caches on load
- PWA manifest at `public/manifest.json` — theme color `#ff0092`, start URL `/map`, `display: standalone`

---

## Secret Management

All secrets in Vercel environment variables. Never hardcoded in source. `SUPABASE_SERVICE_ROLE_KEY` and all Zoho credentials are server-only and never passed to the browser.
