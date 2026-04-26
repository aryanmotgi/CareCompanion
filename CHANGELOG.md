# Changelog

All notable changes to CareCompanion will be documented in this file.

## [0.2.1.1] - 2026-04-26

Two polish fixes from the post-ship QA scan: chat markdown now renders `---` as a visual divider instead of literal text, and the Contact link is in the footer alongside the header nav.

### Fixed
- **Chat `---` rendering** — AI responses using `---` as section dividers now render as a styled `<hr>` instead of literal dashes in the message bubble
- **Contact link missing from footer** — footer now has About / Contact / Privacy / Terms, matching the header nav

## [0.2.1.0] - 2026-04-26

Production bug fixes across mobile rendering, auth flow, and the guest chat experience — all found and fixed via automated QA testing.

### Fixed
- **Mobile login blank** — login, signup, and reset-password pages were invisible at 375px; moved `@keyframes loginFadeUp` from JSX inline style tags to `globals.css` so the animation runs before hydration
- **Mobile home hero invisible** — the 360×720px phone mockup was stacking above the hero text on mobile, pushing the headline and CTAs off-screen; now hidden below the `lg` breakpoint
- **Interactive demo stuck on role screen** — demo users were always redirected to `/set-role` because the edge auth config had no session callback to surface `isDemo` from the JWT; added callbacks so the middleware can correctly detect demo sessions
- **Console MIME error on every page** — Next.js was prefetching `/login` as an RSC payload, middleware redirected it to `/dashboard`, browser logged a MIME type error; added `isPrefetch` guard using the official `Next-Router-Prefetch` header
- **Chat response showing literal `---` separator** — forced intro instruction in the guest chat system prompt caused the AI to prepend a preamble and markdown separator before every answer; removed the instruction
- **Contact link missing from home page nav** — Contact was in the login/signup nav but not the marketing page nav; added to both desktop and mobile menu

### Changed
- **JWT type declarations** — extended the NextAuth JWT interface with `isDemo`, `dbUserId`, and `displayName` fields that were being written to tokens but not declared in the TypeScript types
- **Auth session shape** — edge auth config now maps `id` and `displayName` from token to session, matching the server-side auth config

## [0.2.0.0] - 2026-04-25

Complete redesign of the auth and onboarding experience. Caregivers and patients now select their role at signup, connect through a shared Care Group, and get a personalized onboarding wizard with role-aware AI from day one.

### Added
- **Role selection at signup** — users pick Caregiver, Patient, or Self-care on the signup form; role persists through Google/Apple OAuth via short-lived cookie
- **Care Group** — family name + shared password to link accounts; create (generates QR + invite link) or join (name + password); ConnectedCelebration screen when second member joins
- **QRCodePanel** — 10-minute countdown, blur-on-expiry overlay, tap-to-regenerate, Share + Copy link buttons
- **CaregiverWizard** (6 steps) — patient info, relationship, caregiving experience, primary concern (personalizes AI), Apple Health invite explainer, diagnosis placeholder, priorities, notifications
- **PatientWizard** (4 steps) — hospital search, Apple Health connect → confirm records (with field overrides), manual entry fallback, priorities, notifications
- **WizardProgressBar** — segmented step indicator with clickable back-navigation on completed steps
- **Role-aware AI** — `buildRoleContext()` prepends role, primaryConcern, and caregivingExperience to every `/api/chat` system prompt
- **Onboarding recap email** — `POST /api/onboarding/complete` marks completion and sends branded HTML summary with diagnosis, care group name, and dashboard link
- **Care Group API routes** — create, join (with 10-member cap), invite (with 5-token cap and 7-day expiry), status polling, deep-link `/join` page
- **`/set-role` page** — role selector for pre-existing users with no role; middleware redirects them there before any authenticated page
- **Care Group login tab** — LoginForm now has an Email / Care Group toggle; group login resolves to the owner's account
- New DB tables: `care_groups`, `care_group_members`, `care_group_invites`; new columns: `role` on users, `caregivingExperience`, `primaryConcern`, `fieldOverrides` on care_profiles

### Changed
- `OnboardingWizard` reduced to a thin role router delegating to `CaregiverWizard` or `PatientWizard`
- `OnboardingShell` now shows Care Group setup as the first phase before the wizard
- `SignupForm` includes `RoleSelector` above name/email; role validates before credential or OAuth submit
- HealthKit sync insert loop wrapped in per-record try/catch — one bad FHIR record no longer aborts the entire batch

## [0.1.2.0] - 2026-04-06

Complete onboarding overhaul. New users now get a guided tour, personalized dashboard, and a unified setup flow that replaces three separate paths.

### Added

- **Post-onboarding guided tour** — 5-step spotlight walkthrough covering dashboard cards, AI chat, care tab, scan tab, and navigation. CSS mask-based cutout with pulse animation.
- **Profile completeness indicator** — SVG circular progress ring scoring 11 weighted fields. Shows top 3 "next steps" action cards linking to relevant pages. Celebration state at 100%.
- **Priorities-driven dashboard** — cards reorder based on onboarding priorities. "Priority" badges on matched cards. Quick-ask prompts personalized per selection.
- **Re-engagement nudges** — dismissable and snoozeable cards for users who skipped adding health records, medications, appointments, emergency contacts, or scans. 1-day grace period after onboarding. 3-day snooze option.
- **Structured cancer type picker** — 13 tappable pill buttons replacing free-text input. "Other" reveals custom text field. Cancer-specific contextual tips on selection.
- **Unified 6-step onboarding wizard** — merged wizard, data connection, and manual setup into one flow with inline data entry (medications, doctors, appointments) and summary/welcome screen.

### Changed

- Manual setup page now redirects to onboarding for users who haven't completed it
- Bottom tab bar has data-tour attributes for guided tour targeting
- Dashboard page fetches additional profile data (doctors count, connected apps, emergency contacts, scanned documents) for completeness scoring and nudge logic

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
