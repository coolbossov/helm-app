# Testing

## Quick checks

Run these before every push:

```bash
npm run lint
npm run build
```

This repo does not currently expose a separate `typecheck` script, so rely on the build to catch TypeScript regressions.

## CI behavior

- GitHub Actions runs on push and pull request.
- CI covers lint, TypeScript via the production build, and the final Next.js build.
- Successful PRs are expected to auto-merge after checks pass.

## Manual verification

This repo does not currently have an automated E2E suite. For any UI, map, routing, or CRM-sync change, verify the affected flow manually before merge:

- load the changed page in a local build
- confirm the browser console is clean
- confirm the relevant API/network requests succeed
- validate the changed flow on at least one mobile-sized viewport

## Release gate

- Do not treat CI green as sufficient for behavior-heavy changes.
- If the change touches map rendering, Zoho sync, Supabase mutations, or route-building workflows, manual verification is required before merge.

## Known gaps

- No dedicated automated E2E coverage yet.
- No standalone local `typecheck` script yet.
