# HELM App — Architecture

**Last Updated:** 2026-04-13

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js 15 (App Router) | ^16.1.6 |
| Language | TypeScript | ^5.8.3 |
| Styling | Tailwind CSS v4 (mobile-first) | ^4.1.4 |
| Map | Google Maps JavaScript API + @googlemaps/markerclusterer | ^2.5.3 |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js ^2.49.4 + @supabase/ssr ^0.6.1 |
| CRM | Zoho Bigin REST API v2 (server-side only) | — |
| Validation | Zod | ^3.24.2 |
| Icons | Lucide React | ^0.474.0 |
| QR Codes | qrcode.react | ^4.2.0 |
| Hosting | Vercel | — |
| Live URLs | https://helm-app-drab.vercel.app / https://route.sapicture.day | — |
| Supabase Project | `qnfafwqjjbgiaygrdcoc` (`sapd-internal`, MyStartup.me org, us-east-2 — co-tenant with Portal since 2026-04-24 migration from old ref `lufdqoilfgjjuohteyrs` on Booksa DB) | — |
| PWA | Yes — `public/manifest.json`, theme `#ff0092`, start `/map` | — |

## Components

```
Route Groups
  (auth)/login          → Public login page (Supabase email/password)
  (app)/map             → Protected map view (main UI)
  (app)/routes/[id]     → Route detail + stop list
  (app)/settings        → Sync settings, visit log (lazy-loaded)

Key Client Components
  google-map.tsx        → Google Maps JS API wrapper, marker management
  filter-panel.tsx      → Business type, priority, lifecycle filters
  find-leads-panel.tsx  → Viewport-bounded lead discovery (Places API New)
  contact-detail.tsx    → Company/contact detail drawer
  route-builder.tsx     → Route planning UI
  stop-list.tsx         → Route stops with status controls + auto-scroll
  sync-panel.tsx        → Zoho Bigin pull/push sync controls

API Routes
  /api/contacts         → GET synced_companies (with filter params)
  /api/contacts/[id]    → GET single company detail
  /api/geocode          → POST geocode batch (requires ?batch=true for full run)
  /api/geocode?target=companies → POST geocode companies batch
  /api/leads/discover   → POST Places API (New) viewport search
  /api/sync/pull        → POST pull from Zoho Bigin
  /api/sync/push/preview → GET preview of pending CRM pushes (read-only)
  /api/sync/push        → POST execute CRM push (requires prior preview)
  /api/routes           → GET/POST saved routes
  /api/routes/[id]      → GET/PATCH/DELETE route
  /api/routes/[id]/stops → POST add stops to route
  /api/routes/[id]/stops/[stopId]/route.ts → PATCH update stop status
  /api/visit-log        → GET last 50 visit activities (auth-gated)
```

## Data Flows

### Map Load Flow
```
User opens /map
  → useCompanies() hook → GET /api/contacts (all companies, ~200 bytes per marker)
  → Companies loaded as classic google.maps.Marker (not AdvancedMarkerElement)
  → @googlemaps/markerclusterer handles density
  → Client-side filtering (business type, priority, lifecycle, visit status)
  → Marker click → GET /api/contacts/[id] (detail data, fetched on demand)
```

### Zoho Bigin Sync Flow (Pull)
```
Admin clicks "Pull from Bigin"
  → POST /api/sync/pull
    → Server-side Zoho OAuth token refresh (lib/zoho/)
    → GET /Accounts (Bigin companies) with explicit ?fields= param
    → Upsert to synced_companies
    → GET /Contacts (legacy) with explicit ?fields= param
    → Upsert to synced_contacts
    → Returns { created, updated, unchanged, details[] } with field-level diff
```

### Zoho Bigin Sync Flow (Push — preview-then-confirm)
```
Admin reviews field_updates queue
  → GET /api/sync/push/preview (read-only diff — REQUIRED before push)
    → Returns pending field updates grouped by company/contact
  → Admin confirms
  → POST /api/sync/push
    → company field updates → PUT /Accounts/{zoho_account_id}
    → contact field updates → PUT /Contacts/{zoho_id}
```

### Route Planning Flow
```
Admin creates route
  → POST /api/routes → saved_routes row
  → Add stops: POST /api/routes/[id]/stops { stop_ids: uuid[] }
    → Resolves company→contact links for visit activity logging
    → Appends at max_order + 1
  → Driving mode: PATCH /api/routes/[id]/stops/[stopId]
    → updateStopStatus (snapshot-rollback pattern)
    → On success: logs visit activity, auto-scrolls to next pending stop
```

### Find Leads Flow
```
Admin in Find Leads mode
  → Map viewport bounds captured
  → POST /api/leads/discover { bounds, businessType }
    → Places API (New) with locationRestriction rectangle
    → Returns new leads (not already in CRM) + existing CRM matches
    → Existing entries include contact_id for teal-pin click-to-open
  → Admin selects leads → batch-add to Bigin via sync
  → Route assignment: ConfirmState machine
    → "idle" → "route-prompt" → "new-route-form" | "existing-route-picker"
```

## File Structure

```
app/
  (auth)/
    login/page.tsx
  (app)/
    layout.tsx                 # Protected layout (h-[100dvh])
    map/page.tsx               # Main map view
    routes/[id]/page.tsx       # Route detail with stop list
    settings/page.tsx          # Sync + visit log (lazy)
  api/
    contacts/route.ts          # GET companies (HARD_LIMIT, truncated flag)
    contacts/[id]/route.ts
    geocode/route.ts           # Auth check BEFORE body parse
    leads/discover/route.ts    # Places API (New)
    sync/pull/route.ts
    sync/push/route.ts
    sync/push/preview/route.ts
    routes/route.ts
    routes/[id]/route.ts
    routes/[id]/stops/route.ts
    routes/[id]/stops/[stopId]/route.ts  # Sibling of stops/route.ts
    visit-log/route.ts
components/
  google-map.tsx
  filter-panel.tsx
  find-leads-panel.tsx
  contact-detail.tsx
  route/
    stop-list.tsx              # Auto-scroll after status change
lib/
  supabase/
    client.ts                  # Browser client
    server.ts                  # Server client
    admin.ts                   # Service role client
  zoho/
    client.ts                  # CONTACT_FIELDS constant, OAuth refresh
  hooks/
    use-contacts.ts            # useCompanies() hook (filename unchanged)
    use-mobile.ts              # useIsMobile() — window.matchMedia, SSR-safe
    index.ts                   # Hook exports
types/
  contacts.ts                  # CompanyMarkerData, BusinessType, BUSINESS_TYPE_COLORS
supabase/
  migrations/
    001_synced_contacts.sql through 020_field_updates_nullable_contact.sql
public/
  manifest.json                # PWA manifest
  sw.js                        # Self-unregistering service worker (no-op)
```

## Key Patterns

- **Single source of truth for business types:** `BusinessType` union + `BUSINESS_TYPE_COLORS` in `types/contacts.ts`. `filter-panel.tsx` derives its list from this constant — never hardcoded separately.
- **`CompanyMarkerData` is the canonical marker type.** `ContactMarkerData` alias removed.
- **`useCompanies()` hook at `lib/hooks/use-contacts.ts`** — filename unchanged from original `use-contacts.ts`.
- **Pin color semantics (Find Leads mode):** pink `#ff0092` = new lead, purple `#9749c1` = selected/queued, teal `#00c2cc` = already in CRM. Locked across 3 files: `google-map.tsx`, `find-leads-panel.tsx`, `types/contacts.ts`.
- **Classic Markers only.** AdvancedMarkerElement requires a valid Cloud Map ID; without one it shows a runtime error dialog and blocks rendering.
- **`h-[100dvh]`** in `app/(app)/layout.tsx` — not `h-screen`. Required for iOS Safari toolbar overlap fix.
- **`HARD_LIMIT` in contacts API.** Response includes `truncated: boolean`; orange banner shown when capped.
