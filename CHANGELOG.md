# Changelog

All notable changes to CareCompanion will be documented in this file.

## [0.3.1.0] - 2026-05-02

Security hardening, dashboard reliability fixes, trials engine improvements, and design system polish.

### Security
- **Check-in API now verifies ownership** — `GET /api/checkins` returned any profile's check-in data to any authenticated user; fixed: caller must own the profile or be a care team member
- **Consent route uses user ID not email** — `POST /api/consent/accept` used `WHERE email =` which silently skips Apple Sign-In users with null email; fixed to use `WHERE id =` matching session user ID
- **Open redirect in login callback URL blocked** — `//evil.com` passed the `/` startsWith check; added `!startsWith('//')` guard
- **Registration rate limited** — `POST /api/auth/register` now enforces 5 attempts/hour per IP, returning 429 on excess
- **Trials search rate limited** — `POST /api/trials/match` now enforces 3 live searches/hour per user; unguarded endpoint was an LLM cost-amplification attack vector
- **Onboarding complete uses user ID throughout** — `POST /api/onboarding/complete` looked up the user by email (breaking Apple Sign-In) and used `session.user.id` instead of the DB-resolved ID for care group membership lookup; both fixed
- **Care group join validates token ownership** — `/join` page used the URL `group` param for inserts; an attacker with a valid token for one group could join any group by crafting the URL; now uses `invite.careGroupId`
- **Onboarding complete route verifies profile ownership** — any authenticated user could mark any care profile as complete by sending a foreign `careProfileId`; ownership check added

### Fixed
- **Daily check-in "Med" energy always returned 400** — `CheckinModal` sent `energy: 'med'` but the server validates `z.enum(['low', 'medium', 'high'])`; every medium-energy check-in silently failed since launch
- **Appointment cards no longer show past same-day visits** — `Math.ceil()` on a small negative fraction rounds to 0, so a 2-hour-past appointment showed as "Today at X"
- **Analytics page null email guard** — `session.user.email!` non-null assertion caused DB query with `undefined` for Apple Sign-In users, silently redirecting them away
- **Notification dismiss rolls back on API error** — optimistic removal fired before the fetch; on failure the notification was gone from the UI but still unread in the DB
- **CheckinCard skeleton during load** — card previously returned `null` while fetching today's status, causing a layout shift when it appeared
- **dismissTrial rolls back on API failure** — trial was removed from the UI immediately; on fetch error it now restores the previous matched/close arrays
- **Manual health entry in patient wizard now saves medications** — medications collected in "Enter manually" step were excluded from the API call
- **Care profile creation failure shows an error, not a redirect loop** — silent dashboard redirect with no completed profile caused AppLayout to bounce back to onboarding
- **QR polling interval cleaned up on unmount** — `setInterval` and `setTimeout` in CareGroupScreen leaked when the user navigated away before the 30s timeout
- **Trials search surfaces CT.gov API errors** — timeouts and rate-limit responses silently returned empty results; errors now shown in the UI with retry
- **CT.gov search now fetches up to 100 results** — was capped at 20 despite the higher limit request
- **TEST suffix stripped from cancerType in Claude scoring prompt** — the system prompt was seeing raw test strings after CT.gov search already stripped them
- **Trial phase field propagates to UI** — Haiku scoring output now includes the phase value
- **Dark design system applied to TrialMatchCard** — all color tokens rewritten; cards were rendering with light-mode colors in the dark app
- **Dashboard microcopy** — gradient CTAs replaced with solid tokens, celebratory language replaced with clinical register, symptom pills use neutral styling

### Changed
- **staleThreshold reduced from 90 to 30 days** — trial match results older than 30 days are flagged as stale (enrollment status changes frequently)
- **Trials agent refactored to single-call search** — removed duplicate `searchByEligibility` call; single search with `pageSize: 100` is faster and avoids dedup overhead

## [0.3.0.0] - 2026-04-29

Full clinical trials matching feature. Caregivers can now search thousands of active trials against a patient's real medical profile, see what they're close to qualifying for, get notified when an eligibility gap closes, and share a clinical-tone summary with their oncologist.

### Added
- **Clinical Trials tab** — new bottom nav item (flask icon, between Care and Scan) routes to `/trials`
- **Profile data prompt** — inline form on the Trials tab to enter cancer type, stage, and age without leaving the page; auto-triggers a search on save
- **Inline zip code input** — replaced the amber banner linking to Settings with an in-place form that saves without navigation
- **Cache-first results** — trial matches load instantly from the DB on mount, showing the last-run results with a relative timestamp ("Updated 3h ago") before any live search
- **Full-screen loading overlay** — when "Find trials now" is clicked, a dark-gradient overlay with rotating phase messages ("Reviewing your medical profile…", "Scoring trial matches…") replaces the tab during the search
- **Gap closure notifications** — when a trial moves from "close" to "matched" (an eligibility gap was resolved), a push notification fires naming the specific criterion met; 24h dedup prevents repeat alerts
- **Oncologist share panel** — each matched trial's detail view includes a clinical-tone referral note (doctor-to-doctor language, ECOG/staging abbreviations, matching rationale) with a copy button and mailto link
- **16 new unit tests** — `clinicalTrialsAgent.test.ts` covers parallel fetch, dedup, JSON parse fallback chain, NCT ID validation, score clamping, and matched/close split; two additional `saveMatchResults` notification-branch tests

### Changed
- **5-10x speed improvement** — replaced sequential agentic tool-call loop with parallel CT.gov pre-fetch (`Promise.all`) + single Haiku scoring call; search time dropped from 60s+ to 5-15s
- **Switched to Haiku model** for trial scoring (`claude-haiku-4-5-20251001`), staying under the 30k TPM org limit while reducing cost ~20x vs Sonnet
- **Error surfacing** — match route now catches all errors and returns `{error, matched:[], close:[]}` instead of an empty 500 body; UI renders the error message inline
- **Enqueue safety** — `enqueueMatchingRun` uses UPDATE-first (resets any pending/claimed row to pending) instead of `onConflictDoNothing`, which was silently dropping trigger runs when the nightly cron had a row claimed
- **Duplicate notification guard** — `saveMatchResults` deduplicates gap-closed notifications with a 24h lookback before inserting

### Fixed
- **LLM nctId validation** — trial objects with malformed or hallucinated NCT IDs are now filtered before DB upsert (`/^NCT\d{8}$/`)
- **LLM output field validation** — `detail` route validates that parsed JSON fields are strings before returning to client; falls back to static defaults on type mismatch
- **Email header injection** — `\r\n` stripped from `clinical_summary` before embedding in `mailto:` body parameter

## [0.2.2.0] - 2026-04-27

Full security hardening pass based on an automated OWASP audit (5 findings, all resolved).

### Security
- **Rate limiting on mobile auth endpoints** — `POST /api/auth/mobile-login` and `POST /api/auth/mobile-care-group-login` now enforce 5 attempts per hour per IP, closing brute-force account takeover vectors against patient medical data
- **Memory prompt injection protection** — user-derived memories are now sanitized before injection into the system prompt: low-confidence facts are excluded, and facts matching AI behavioral directive patterns (`always recommend`, `never suggest`, `ignore`, etc.) are dropped before they reach Claude
- **CSP `unsafe-eval` removed** — `next.config.mjs` no longer includes `unsafe-eval` in `script-src`, tightening XSS defense for all users
- **`apps/mobile/.env` untracked** — removed from git history staging, `.gitignore` expanded to cover `.env` and `*/.env` patterns, `.env.example` added to document the public URL

## [0.2.1.4] - 2026-04-26

Third attempt at the MIME console error. Instead of rewriting to the login page (which Vercel's edge layer was overriding), unauthenticated RSC prefetch requests to protected routes now return 204 No Content. No content = nothing for the browser to parse as a script = no MIME error. Next.js falls back gracefully.

### Fixed
- **MIME console error (final fix)** — unauthenticated RSC prefetch to protected routes returns `204 No Content` instead of an HTML redirect; browser sees no content and logs no error

## [0.2.1.3] - 2026-04-26

Root cause fix for the MIME console error. The `authorized` callback was returning `false` for unauthenticated RSC prefetch requests, causing NextAuth to redirect before our middleware handler ran. Now prefetch requests pass through to the handler, which rewrites them to the login page as RSC payload.

### Fixed
- **MIME console error (root cause)** — `authorized` callback in `auth.config.ts` now returns `true` for `Next-Router-Prefetch` requests so the middleware handler can apply `NextResponse.rewrite()` instead of NextAuth applying a redirect

## [0.2.1.2] - 2026-04-26

Eliminates the MIME type console error for unauthenticated users. Protected routes prefetched by Next.js now get the login page served as RSC payload instead of an HTML redirect, which is what the browser expected.

### Fixed
- **MIME console error (unauthenticated prefetch)** — middleware now uses `NextResponse.rewrite()` instead of `NextResponse.redirect()` for RSC prefetch requests to protected routes, eliminating the "text/html is not executable" browser error

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
