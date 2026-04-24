# HELM App — Disaster Recovery

**Last Updated:** 2026-04-13

---

## Platform

**Hosting:** Vercel (Hobby plan)
**Live URLs:** https://helm-app-drab.vercel.app / https://route.sapicture.day
**Database:** Supabase project `qnfafwqjjbgiaygrdcoc` (`sapd-internal`, co-tenant with Portal, migrated 2026-04-24 from old ref `lufdqoilfgjjuohteyrs`)
**Repo:** github.com/coolbossov/helm-app (private)

---

## Deploy & Rollback

**Deploy trigger:** Push to `main` via CI squash-merge (GitHub Actions: check → auto-merge). No E2E tests — auto-merge fires after lint/tsc/build pass.

**Rollback procedure:**
1. Identify last known-good commit SHA via `git log origin/main`
2. Create `fix/rollback-to-<sha>` branch from that SHA → open PR
3. Alternatively: Vercel dashboard → Deployments → select previous deployment → Promote to Production (instant)

**Important — Squash-merge timing:** Commits pushed after CI begins merging may not be included in the squash. Always verify the merge SHA includes intended commits before closing a PR (`git fetch origin && git show origin/main:path/to/file | grep expected_change`). If change is confirmed present but PR still shows OPEN, close manually — GitHub UI may be lagging.

---

## Database Backup

**Supabase tables:** `synced_contacts`, `synced_companies`, `geocode_cache`, `saved_routes`, `route_stops`, `field_updates`, `contact_activities`, `sync_logs`

**Critical data:**
- `synced_companies` / `synced_contacts` — can be re-synced from Zoho Bigin (pull sync)
- `geocode_cache` — can be re-geocoded but takes time + Google API cost
- `saved_routes` / `route_stops` — cannot be recovered from Bigin; routes are HELM-only
- `field_updates` — pending CRM pushes; loss means untracked edits

**Manual backup:**
```bash
supabase db dump --linked --project-ref qnfafwqjjbgiaygrdcoc > helm_$(date +%Y%m%d).sql
```

**Re-sync from Bigin:** If `synced_companies`/`synced_contacts` is lost or corrupted, run a full pull sync from the Settings page. This re-imports all companies and contacts from Zoho Bigin. Geocoding must be re-run separately via `POST /api/geocode?target=companies&batch=true`.

---

## Migration State

**Current:** Migrations 001–020 all applied and tracked in `supabase_migrations.schema_migrations`.

**Important:** Migrations 012 and 013 were applied directly to production outside of `db push`. Sentinel rows were manually inserted. If running `supabase db push` on a fresh environment, verify migration tracking table alignment before pushing.

**If `supabase db push` fails:**
1. Check `schema_migrations` table for missing sentinel rows
2. For already-applied migrations that are missing from tracking: `INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('NNN', 'name', '{}') ON CONFLICT DO NOTHING`
3. Use `--yes` flag in non-interactive shells: `supabase db push --linked --yes`

---

## Monitoring

<!-- TODO: verify if Uptime Kuma monitor exists for route.sapicture.day -->
- Vercel provides deployment status and function logs
- Supabase dashboard shows database health

---

## Incident Response

**Scenario: Map shows no pins**
1. Check `/api/contacts` response in browser DevTools — should return companies array
2. Verify `synced_companies` table has rows: check Supabase dashboard
3. If empty: run pull sync from Settings page to re-import from Bigin
4. Check `HARD_LIMIT` — if `truncated: true` in response, companies are capped (orange banner in UI)

**Scenario: Zoho sync fails**
1. Check `lib/zoho/client.ts` token refresh — Zoho refresh tokens can expire
2. Verify `ZOHO_REFRESH_TOKEN` in Vercel env vars is current
3. If token expired: re-authorize via Zoho OAuth and update `ZOHO_REFRESH_TOKEN` in Vercel
4. Ensure `fields=` param is included on all GET calls — omitting causes 400 REQUIRED_PARAM_MISSING

**Scenario: Geocoding fails or produces wrong coordinates**
1. Check Google Maps API key billing status and quotas in GCP Console
2. Coordinate null guard: code uses `lat != null && lng != null` (not `lat && lng`) — valid `0` coordinates must not be falsy-dropped
3. Re-run geocode batch: `POST /api/geocode?target=companies&batch=true` — requires `?batch=true` to prevent accidental full-table run

**Scenario: Route stops not saving**
1. Check Supabase connectivity from Vercel function logs
2. Verify `route_stops.company_id` FK (migration 015) is applied
3. For stop ordering: `bulk_update_stop_order` RPC requires migration 018 applied to production
