# Changelog

All notable changes to CareCompanion will be documented in this file.

## [0.3.1.0] - 2026-05-02

Security hardening, Care Tab reliability, dashboard fixes, trials engine improvements, design system polish, document scan/upload fixes, and Settings/Profile/Emergency Card audit.

### Fixed (Settings, Profile, Emergency Card)
- **Notification preferences never saved** — component sent camelCase keys (`quietHoursStart`, `refillReminders`) but the API checks snake_case (`quiet_hours_start`, `refill_reminders`); every save returned 400 silently
- **Notification preferences CSRF missing** — `PATCH /api/records/settings` called without `x-csrf-token`; all saves rejected by the API
- **AI personality never saved** — settings PATCH sent `{ aiPersonality }` but API expects `{ ai_personality }`; personality dropdown had no effect since launch
- **AI personality CSRF missing** — same endpoint, same issue
- **Change-password form missing current password field** — API requires `{ currentPassword, password }` but form only sent `{ password }`; every password change returned 400
- **Change-password CSRF missing** — POST to `/api/account/change-password` lacked `x-csrf-token`
- **Password min length mismatch** — frontend checked 6 chars but API requires 8; users could pass frontend validation then fail server validation
- **Import data CSRF missing** — POST to `/api/import-data` lacked `x-csrf-token`; imports silently failed
- **Edit Profile linked to /onboarding** — Settings "Edit Profile" button relaunched the onboarding wizard instead of navigating to `/profile/edit`
- **All profile mutations missing CSRF** — all 8 ProfileEditor write paths (save patient info, save conditions, add/remove medication, add/remove doctor, add/remove appointment) had no `x-csrf-token`; every edit was rejected by the API
- **Conditions & Allergies section always blank** — state initialized to `''` instead of `profile.conditions / profile.allergies`; users who clicked Save without re-entering would silently clear existing data
- **Profile edit showed soft-deleted records** — medications, doctors, and appointments queries lacked `isNull(deletedAt)`; removed records appeared in the edit form
- **Emergency card showed wrong profile for multi-profile users** — page used `WHERE userId = ? LIMIT 1` (creation order) instead of `getActiveProfile()`; care team members saw the wrong patient's emergency data
- **Emergency card share/clipboard had no error handling** — `navigator.share()` rejection and `clipboard.writeText()` throw on HTTP pages were uncaught; now wrapped with fallback

### Removed (Dead Code)
- Deleted 4 unused files: `apps/mobile/src/components/OnboardingJourney.tsx`, `apps/mobile/src/lib/feature-flags.ts`, `apps/video/remotion.config.ts`, `apps/video/src/components/CalloutLabel.tsx`
- Removed 3 unused dependencies from mobile: `@babel/runtime`, `@carecompanion/utils`, `expo-web-browser`
- Removed 2 unused devDependencies from root: `dotenv`, `tsx`
- Removed 4 unused `export` keywords: `trackEvent` (analytics.ts), `DetailContent` (TrialDetailPanel.tsx), `AgentMatchOutput` (clinicalTrialsAgent.ts), `SUPPORTED_HOSPITALS` (hospitals.ts)

### Added
- **knip dead-code scanner** — `npm run deadcode` now available via knip; catches unused exports across the monorepo

### Fixed (Care Tab)
- **Lab trends status never matched UI** — `overall_status: 'warning'` and `'stable'` from the API had no entry in `STATUS_CONFIG`; any user with warning-level labs crashed the Trends UI. Now maps to `'concerning'` and `'monitor'` respectively
- **Doctor name always blank on new appointments** — frontend sent `doctorName` (camelCase), API reads `doctor_name` (snake_case); all appointments saved with a null doctor since the feature launched
- **Drug interactions checked against deleted medications** — soft-deleted medications were included in the interaction check query; users could see warnings for drugs they had already removed
- **Refill status showed deleted medications** — same missing `isNull(deletedAt)` filter; removed medications still appeared with overdue refill alerts
- **Treatment cycle divide-by-zero** — `totalCycles: 0` or `cycleLengthDays: 0` in notes caused `Infinity%` progress; both now guarded with `Math.max(1, ...)`
- **Day-in-cycle overflow when refill overdue** — `dayInCycle` could exceed `cycleLengthDays` when next infusion date was past; now clamped to `[1, cycleLengthDays]`
- **Cycle tracker vanished with no message** — when no medication notes matched the cycle regex, the whole component returned null; now shows an empty state with setup instructions
- **Medication add/edit/delete failures were silent** — all three mutation flows swallowed errors and closed their UI without feedback; each now shows an inline error message
- **Saving one refill date disabled all rows** — `savingRefill` was a single boolean shared across all medications; replaced with `savingRefillId` (string | null) so only the affected row is disabled
- **Lab value exponential notation parsed wrong** — `1.5e-3` was stripped to `1.5` (the `e` was removed), producing values 1000× too large for any sub-1 lab result
- **Lab trend rapid-rise of tumor markers misclassified** — CEA/PSA/CA-125 rising 20%+ showed as "Declining" instead of "Rapid Decline"; higherIsWorse flip logic now checks `changePercent` magnitude directly
- **Lab 1-point chart rendered as invisible line** — Recharts draws nothing with a single data point; now shows a message asking for more results
- **Lab sparkline gradient ID collision** — all `stable` sparklines shared the same SVG gradient ID; one overwrote the other's color. Fixed with `useId()` per instance
- **Lab change_percent null when exactly 0%** — `changePercent ? ... : null` treated zero as falsy, hiding the `0.0%` indicator
- **Lab date UTC off-by-one in Recent filter** — bare `YYYY-MM-DD` strings parsed as UTC midnight fell on the previous day in US timezones; now appended with `T00:00:00` for local-time parsing
- **Lab date heading showed "Invalid Date"** — malformed `dateTaken` values fell through to `toLocaleDateString()` which returned the literal string "Invalid Date"; now guarded
- **No DELETE endpoint for treatment cycles** — cycles could only be deactivated via PATCH; a true DELETE handler is now available at `DELETE /api/cycles/[id]`
- **Medication API: no input length limits** — name, dose, frequency, and notes fields were unbounded; now capped (name 200, dose 100, frequency 200, notes 2000 chars)
- **Medication API: unvalidated refill_date** — any string including `"injection attempt"` was written to the DB; now validated against `YYYY-MM-DD` format before insert/update
- **Medication API: bulk PUT stored literal "undefined"** — `String(undefined)` when `m.name` was missing silently inserted rows with name `"undefined"`; now filtered before insert
- **Medication API: soft-deleted medication editable** — PATCH and DELETE ownership lookups didn't filter `deletedAt IS NULL`, allowing updates to already-deleted records
- **Interaction check skips LLM when no other meds** — previously fired a paid LLM call even with 0 current medications to compare against; now returns early
- **Appointment add errors were silent** — failed POSTs closed the form with no message; error now shown inline

### Security (post-adversarial review)
- **debug-auth route deleted** — `GET /api/debug-auth` exposed a password-reset-via-query-param endpoint active on Vercel preview deployments; route removed entirely
- **CSRF added to 5 mutation routes** — `POST /api/trials/save`, `POST /api/trials/match`, `PATCH /api/trials/saved/[nctId]`, `POST /api/care-group`, and `POST /api/auth/set-role` lacked `validateCsrf()` guards, making group creation and role assignment exploitable via cross-site POST; all now consistent with the rest of the codebase
- **Care group join race condition fixed** — `POST /api/care-group/join` checked membership then inserted in two separate queries; concurrent requests could both pass the check and double-join; wrapped in a `db.transaction()` 
- **Cron profile scan capped at 500** — `GET /api/cron/trials-match` loaded every care profile with no `LIMIT`; would OOM Lambda at scale
- **Cycles rate-limit IP hardened** — `DELETE/PATCH /api/cycles/[id]` used leftmost `x-forwarded-for` (attacker-controlled); now uses `x-real-ip` with rightmost XFF fallback, matching the register route fix
- **Drug interaction safe default on LLM parse failure** — `checkDrugInteractions()` and `checkAllInteractions()` returned `undefined` when structured output parsing failed; now return a conservative safe default (`safe_to_combine: false`)

### Security
- **Check-in API now verifies ownership** — `GET /api/checkins` returned any profile's check-in data to any authenticated user; fixed: caller must own the profile or be a care team member
- **Consent route uses user ID not email** — `POST /api/consent/accept` used `WHERE email =` which silently skips Apple Sign-In users with null email; fixed to use `WHERE id =` matching session user ID
- **Open redirect in login callback URL blocked** — `//evil.com` passed the `/` startsWith check; added `!startsWith('//')` guard
- **Registration rate limited** — `POST /api/auth/register` now enforces 5 attempts/hour per IP, returning 429 on excess
- **Trials search rate limited** — `POST /api/trials/match` now enforces 3 live searches/hour per user; unguarded endpoint was an LLM cost-amplification attack vector
- **Onboarding complete uses user ID throughout** — `POST /api/onboarding/complete` looked up the user by email (breaking Apple Sign-In) and used `session.user.id` instead of the DB-resolved ID for care group membership lookup; both fixed
- **Care group join validates token ownership** — `/join` page used the URL `group` param for inserts; an attacker with a valid token for one group could join any group by crafting the URL; now uses `invite.careGroupId`
- **Onboarding complete route verifies profile ownership** — any authenticated user could mark any care profile as complete by sending a foreign `careProfileId`; ownership check added

### Fixed (Trials)
- **Vercel build crash on 9 API routes** — `DYNAMIC_SERVER_USAGE` error during static page generation; 9 authenticated routes missing `export const dynamic = 'force-dynamic'` (`chat/search`, `compliance/*`, `cycles/current`, `notifications/preferences`, `refills/status`, `search`, `share/weekly`)
- **Trial detail panel fetched in render body** — `fetch()` call was inside the React render function, firing twice per mount in Strict Mode and leaking the in-flight request on unmount; moved to `useEffect` with `cancelled` flag
- **saveTrial had no rollback on API error** — optimistic `setSaved` updated UI before the request; `.catch(()=>{})` swallowed failures permanently; now rolls back to previous state (mirrors dismissTrial pattern)
- **Trial phase always showed "Phase N/A" from cache** — `phase` field was in the in-memory `TrialMatchResult` type but not persisted to `trial_matches` DB table; added column + migration
- **NCT ID not validated in 4 API endpoints** — `save`, `saved/[nctId]`, `[nctId]`, and `[nctId]/detail` routes accepted any string and passed it to CT.gov API + DB; now validates `/^NCT\d{4,}$/`
- **Cron close-trials query unbounded** — `SELECT * FROM trial_matches WHERE matchCategory='close'` loaded all rows with no limit; OOM risk at scale; capped at 200 per cron run
- **Trial status change notifications fired on every cron run** — no dedup; oscillating enrollment status spammed users; added 24h dedup matching `matchingQueue.ts` pattern
- **Trial load lost matches when saved-trials fetch failed** — `Promise.all([matches, saved])` discarded all results if either fetch threw; replaced with `Promise.allSettled` (saved badge absence on failure, not full error screen)
- **Lab date was blank string in trial scoring prompt** — `dateTaken ?? ''` sent empty string to Claude; changed to `'Date unknown'`
- **ContactBlock fallback linked to `href="#"`** — scroll-to-top instead of trial page; now uses `trial.url`

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
- **CT.gov search now fetches up to 40 results** — was capped at 20; CT.gov API cap raised to 100 for future use
- **TEST suffix stripped from cancerType in Claude scoring prompt** — the system prompt was seeing raw test strings after CT.gov search already stripped them
- **Trial phase field propagates to UI** — Haiku scoring output now includes the phase value
- **Dark design system applied to TrialMatchCard** — all color tokens rewritten; cards were rendering with light-mode colors in the dark app
- **Dashboard microcopy** — gradient CTAs replaced with solid tokens, celebratory language replaced with clinical register, symptom pills use neutral styling

### Changed
- **staleThreshold reduced from 90 to 30 days** — trial match results older than 30 days are flagged as stale (enrollment status changes frequently)
- **Trials agent refactored to single-call search** — removed duplicate `searchByEligibility` call; single search with `pageSize: 40` is faster and avoids dedup overhead

### Security (Chat & Notifications audit)
- **CSRF missing on notification dismiss and mark-all-read** — `NotificationsView` and `NotificationBell` were POSTing to `/api/notifications/read` without the `x-csrf-token` header; backend CSRF check rejected every call silently; users could dismiss or mark notifications but changes never persisted
- **PHI in chat URL parameters from notification links** — "Ask AI" links embedded medication names, lab values, and appointment info in `?prompt=` URL query parameters, exposing patient data in server logs, browser history, and Referer headers; replaced with generic type-based prompts
- **CSRF missing on POST /api/care-group/join** — state-mutating endpoint added users to care groups without CSRF validation; now consistent with POST /api/care-group
- **LIKE wildcard injection in trials-status cron** — `nctId` was interpolated into a LIKE pattern without escaping `%` and `_` metacharacters; defensively escaped before interpolation

### Fixed (Chat & Notifications)
- **"Ask AI" from notifications never auto-sent** — `NotificationsView` used `"Tell me more about: {title}"` which doesn't match `isAllowedPrompt()`; all notification links now use type-based prompts that match the allowlist and auto-send
- **Soft-deleted items generated spurious notifications** — `generateNotificationsForUser` queried medications and appointments without `isNull(deletedAt)` filters; deleted medications still generated refill alerts, past appointments still generated prep reminders
- **markAllRead showed success toast on API failure** — `NotificationsView` called `showToast` before checking `res.ok`; state is now rolled back and an error toast is shown on failure
- **NotificationBell dismiss had no error handling** — notification disappeared from UI on failure with no rollback or feedback; now rolls back optimistic state on non-ok response
- **Notification cron timed out for large user bases** — `generateNotificationsForAllUsers` processed users in a serial loop; at ~500ms/user this hit Vercel's 60s cron limit at 120+ users; now runs in parallel batches of 10 via `Promise.allSettled`
- **Orchestrator rate limiter never enforced** — `rateLimit()` was instantiated inside `orchestrate()` per request, creating a fresh in-memory store each call; limit was never shared across requests; moved to module scope
- **Orchestrator polluted patient memory store** — multi-agent queries were logged as `category: 'other'` rows in the `memories` table; the memory extraction LLM treated these system events as patient facts; insert block removed

### Fixed (Document Scan & Upload)
- **Scan requests silently failing with 403** — DocumentScanner, CategoryScanner, and CategoryUploadCard were posting to `/api/scan-document` without the `x-csrf-token` header; the backend CSRF check rejected every scan. Now all three components read the CSRF cookie via `useCsrfToken()` and include the header
- **Bulk document delete was a no-op** — the Delete button in the document organizer ran `exitBulkMode()` and nothing else (a "// In a real app..." comment marked the gap). Now calls `DELETE /api/documents/:id` for each selected document and shows success/error counts
- **No delete endpoint for documents** — new `DELETE /api/documents/[id]` route with CSRF validation, auth check, ownership verification via care profile, and soft-delete (`deletedAt`)
- **Document list stale after scan+save** — after saving scan results the document list stayed frozen until a manual page reload. ScanCenter now calls `router.refresh()` on save to re-fetch from the server component
- **No client-side file size check** — users uploading files over 10 MB got no feedback until the server returned 413 after the full upload. Now validates `file.size > 10 MB` before the request and shows a toast immediately
- **PDFs rejected despite "Upload photo or PDF" UI text** — file inputs in DocumentScanner and CategoryScanner were `accept="image/*"` only; changed to `accept="image/*,.pdf,application/pdf"` to match the described capability
- **DELETE ownership TOCTOU** — the document ownership check and the soft-delete were two separate queries; added `careProfileId` to the UPDATE WHERE clause so the delete cannot affect documents that changed ownership between checks

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
