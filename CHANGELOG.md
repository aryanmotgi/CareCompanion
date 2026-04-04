# Changelog

All notable changes to CareCompanion will be documented in this file.

## [0.1.1.0] - 2026-04-03

Backend hardening, test coverage, and new API endpoints. The extraction engine is now unified, sync routes are locked down, and 84 tests catch regressions before they ship.

### Added

- **Unified document extraction engine** — single Zod-validated pipeline powers all scanning (prescriptions, labs, insurance, EOBs, doctor notes). Now extracts appointments and diagnoses too.
- **Rate limiting** on extraction and medication import APIs (10 req/min per user)
- **Cron endpoint security** — all cron routes verify CRON_SECRET Bearer token in production
- **Health check endpoint** (`GET /api/health`) — tests DB connectivity and env var status, returns 200 or 503
- **Chat history API** (`GET/DELETE /api/chat/history`) — paginated message retrieval with cursor-based pagination
- **Journal delete** (`DELETE /api/journal`) — remove symptom entries by date
- **Health summary caching** — generated summaries are saved and retrievable via `GET /api/health-summary`
- **84 unit tests** covering FHIR parsing, conflict detection, extraction schema, rate limiting, cron auth, system prompt building, and reminder utilities

### Fixed

- **Auth on sync routes** — `/api/sync/google-calendar`, `/api/sync/health-system`, and `/api/sync/insurance` previously had zero auth checks. Now require authentication and verify user_id ownership.
- **Visit prep ownership** — appointment must belong to the authenticated user's care profile
- **Medication import validation** — max 50 medications per import, array required
- **Document extraction duplicates** — medications and lab results are checked against existing records before importing
- **Higher confidence threshold** (0.85) for auto-importing safety-critical data (medications, labs)
- **Memory extraction guards** — skips greetings and trivial messages, 60-second dedup window, capped at 150 memories loaded

### Changed

- **Tool input validation** — all AI chat tool schemas now have `.min()/.max()` length constraints
- **Env validation** — ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY warn in production if missing
- **Memory loading** capped at 150 most-recent memories (was unlimited)

## [0.1.0.0] - 2026-04-02

Scan a medical document and get structured data back. Delete a medication without worrying you'll accidentally lose it. See a spinning gradient border on urgent refill cards. The frontend now tells you what's happening while it works.

### Added

- **AI Document Extraction** — scan prescriptions, lab reports, insurance cards, and EOBs with Claude Vision. Auto-imports extracted data into your care profile with a confidence threshold.
- **Confirmation dialogs** on all destructive actions (delete medication, remove appointment, delete account). No more accidental data loss.
- **Loading spinners** on every async operation — adding medications, appointments, saving settings, exporting data, changing passwords.
- **Visual upgrades** — spinning gradient borders on urgent cards, material-style ripple on buttons, animated greeting gradient on dashboard, enhanced ambient background with 4 floating orbs, upgraded skeleton loading animations, page blur-in transitions.
- **CI/CD pipeline** — GitHub Actions running lint, typecheck, test, and build on every push. Husky pre-commit hooks with lint-staged.
- **E2E tests** — Playwright tests for auth flow, navigation, and dashboard rendering.
- **Environment validation** — fail-fast on missing env vars with clear error messages.
- **Notification engine** respects user settings toggles (refill reminders, appointment reminders, lab alerts, claim updates).

### Changed

- **DashboardView** cards array memoized with `useMemo` — no longer rebuilds every render.
- **MessageBubble** markdown now handles inline code, code blocks, and italic text. Tool loading uses proper spinner instead of emoji.
- **MedicationsView** refetches from Supabase after scan instead of reloading the entire page.
- **SettingsPage** debounce timeout cleaned up on unmount. Password form shows inline validation. Toggle switches have proper `aria-label`. Clickable rows support keyboard navigation.
- **error.tsx** matches app dark theme instead of jarring light background.
- **PriorityCard** urgent variant gets pulsing dot and spinning gradient border.
- **Button** component adds hover shadows and ripple effect on click.
- **ExpandableCard** and **PriorityCard** use consistent `·` separator instead of `•`.

### Fixed

- Greptile review findings — ownership check on document extraction, input size limit (10MB), improved test assertions.
