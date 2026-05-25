# Route Helm — Changelog

## 2026-05-25
- ci: reduce Actions usage by changing Bigin push sync from every 15 minutes to every 6 hours, adding fail-fast curl behavior, CI concurrency, docs-only skips, 15-minute timeouts, and narrower infra advisory triggers.

## 2026-05-14

### Improvements
- Added the repo infra-doc advisory workflow and updated `AGENTS.md` so shared infrastructure changes point at `~/.ai-ops/docs/infrastructure.md` and `/infra-update`

## 2026-03-30

### Improvements
- Route optimization now saves all stop orders in a single atomic database call (faster, more reliable)
- Map correctly shows a warning when company list exceeds 10,000 records
- Cache headers added to route API responses for faster page loads
- Database indexes added for faster company and contact search

### Bug Fixes
- Optimize button spinner no longer freezes when an error occurs — error message now shown inline
- Deleting a route no longer removes it from the list if the server request fails
- Marking a stop visited/skipped now properly rolls back the UI if the server returns an error
- Company progress bar now counts the same stops as the list (was inconsistent)
- Setting strict time windows on a route now clears stale distance/time data
- Company names containing commas now search correctly
- Search input with `%` or `_` characters no longer causes unexpected filter results
- Website links with invalid URLs no longer crash the contact detail panel

### Mobile
- Fixed viewport height on iOS Safari (bottom toolbar no longer clips the app)
- Pinch-to-zoom re-enabled (was accidentally disabled)
- Status buttons (Visited / Skip / Reset) are now easier to tap on mobile
- App can now be installed as a PWA (web app) on mobile devices
- Directions button now links to Apple Maps on iPhone/iPad

### Security
- Fixed: Google Maps geocode API was accessible without login in certain cases
- Fixed: Malicious URLs in the website field are now blocked at both save and display time
