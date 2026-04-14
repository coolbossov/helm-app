# Testing

> **Last Updated:** 2026-04-14

## Quick Tests (run after every commit)

```bash
npx tsc --noEmit
npm run lint -- --max-warnings 0
```

| Check | Command | What it catches |
|-|-|-|
| Type check | `npx tsc --noEmit` | Type errors, missing imports |
| Lint | `npm run lint -- --max-warnings 0` | Style violations |

## Deep Tests (run before PRs / after significant changes)

No test framework currently configured.

## Comprehensive E2E (run for releases / heavy testing sessions)

No E2E framework currently configured.

### E2E Prompt

> No E2E prompt yet. When a test framework is added, populate this section with a comprehensive prompt.

## Test Infrastructure

| Component | Detail |
|-|-|
| Framework | None |
| CI | `check` job in `.github/workflows/ci.yml` |

## Coverage Gaps (known)

| Area | Status | Notes |
|-|-|-|
| All functionality | Not tested | No test framework configured |
