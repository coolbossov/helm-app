# HELM App — Environment Variables

**Last Updated:** 2026-04-13

Copy `.env.local.example` to `.env.local` and fill in real values. Never commit `.env.local`.

**Note:** No `.env.example` file exists in repo root — refer to CLAUDE.md and this file for the complete variable list.

| Variable | Service | Purpose | Required |
|----------|---------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Project API URL (client + server) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Anon key for browser client | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Service role key — server-only | Yes |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps | Maps JS API key for map rendering + Places API | Yes |
| <!-- TODO: verify Zoho env var names --> `ZOHO_CLIENT_ID` | Zoho Bigin | OAuth client ID for Bigin API access | Yes |
| `ZOHO_CLIENT_SECRET` | Zoho Bigin | OAuth client secret | Yes |
| `ZOHO_REFRESH_TOKEN` | Zoho Bigin | OAuth refresh token (long-lived) | Yes |
| `ZOHO_ACCOUNT_URL` <!-- TODO: verify --> | Zoho Bigin | Bigin API base URL (e.g. `https://www.zohoapis.com/bigin/v2`) | Yes |
| `READ_ONLY` | Maintenance | When set to `true`, `middleware.ts` returns 503 for all non-GET/HEAD/OPTIONS requests (write-freeze). `/api/sync/cron` is excluded from the matcher so the daily cron still runs. Dormant guard — unset in normal operation, set to `true` during DB migration cutover. | No |

**Not present / removed:**
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` — deleted from Vercel settings 2026-03-31, no longer needed
