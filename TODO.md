# CareCompanion TODO

Generated from: /plan-eng-review + /design-review + /qa + /audit Chat+Notifications + /audit Integrations  
Branch: preview/trials-impeccable  
Date: 2026-05-02

---

## Integrations Audit — 2026-05-02 (all fixed ✅)

Full audit: Google Calendar OAuth, HealthKit sync, connected apps management, disconnect/revoke, token refresh, error handling.

- [x] **[CRITICAL] `decryptToken` missing — Google Calendar sync always 401** — `token-encryption.ts` — `encryptToken` stored tokens as `enc:v1:...` but no decrypt function existed. Sync route passed the encrypted string as a Bearer token to Google API; every Calendar API call failed with 401. Added `decryptToken()` using AES-256-GCM and applied it at `sync/google-calendar/route.ts:45,56`.

- [x] **[CRITICAL] Token refresh stored plaintext after decrypt** — `sync/google-calendar/route.ts:67` — After a successful token refresh, the new `access_token` (plaintext from Google) was written to DB without re-encrypting. Next refresh attempt would call `decryptToken()` on a plaintext string, bypassing the `enc:v1:` prefix check. Fixed: wrap with `encryptToken()` before the DB update.

- [x] **[CRITICAL] Initial post-OAuth sync always failed (CSRF deadlock)** — `sync/google-calendar/route.ts:8` — OAuth callback called sync route server-side with `x-internal-secret`. CSRF check ran first (before auth check) and rejected all server-side calls with 403 — so the initial calendar import never ran after connecting. Fixed: check `x-internal-secret` before CSRF; skip CSRF for validated internal calls only.

- [x] **[CRITICAL] Calendar dedup matched on event title only** — `sync/google-calendar/route.ts:116` — Dedup query matched `doctorName = event.summary` with no date check. Recurring events (e.g. weekly "Doctor checkup") all share the same summary — only the first occurrence was ever imported; all later dates silently skipped. Fixed: added `dateTime` to dedup `WHERE` clause using `eq(appointments.dateTime, dateTime)` + `isNull` fallback for all-day events.

- [x] **[SECURITY] `signState` silently unsigned in production** — `token-encryption.ts:88` — If `OAUTH_STATE_SECRET` env var was missing in production, `signState()` only logged a warning and returned unsigned state. OAuth CSRF protection was completely absent without any visible failure. Changed `console.warn` → `throw Error` so a missing secret hard-fails instead of silently degrading.

- [x] **[SECURITY] `/api/sync/status` leaked encrypted access/refresh tokens to client** — `sync/status/route.ts:11` — `db.select()` without column projection returned full rows including `accessToken` and `refreshToken` fields (encrypted but still sensitive). Fixed: explicit column selection — `id`, `source`, `lastSynced`, `expiresAt`, `createdAt`, `metadata` only.

- [x] **[SECURITY] Sync route IDOR — `user_id` in body not validated for browser callers** — `sync/google-calendar/route.ts` — Previous code checked session ownership only when a session existed; unauthenticated paths fell through to the internal-secret branch. Restructured: browser callers always go through session auth; `user_id` body param is optional and overridden by session (prevents IDOR); internal calls bypass session only.

- [x] **[MISSING] No disconnect/revoke endpoint** — No API route existed to remove a connected app. Users had no way to revoke Google Calendar access. Created `DELETE /api/integrations/[source]/route.ts` — validates CSRF, verifies session ownership, deletes the `connectedApps` row, writes audit log.

- [x] **[MISSING] No Integrations UI in Settings** — `SettingsPage.tsx` had no section for connected apps. Users couldn't connect, disconnect, or sync Google Calendar from the web app. Added full Integrations section: connect button for unauthenticated state, sync + disconnect buttons for connected state, last-synced timestamp, expired-token warning banner, Apple Health (informational — iOS only).

- [x] **[MISSING] Re-auth flow on token expiry** — When `expiresAt` is in the past (expired token, no refresh), the UI now shows an orange "Token expired — reconnect to resume syncing" warning. `handleSyncGoogle` also catches `reconnect` in the error message and shows a specific toast prompting the user to reconnect.

- [x] **[BUG] `handleSyncGoogle` sent connectedApp row ID as `user_id`** — `SettingsPage.tsx` — Sync call sent `user_id: googleCalendar?.id` (the UUID of the `connectedApps` row) not the user's ID. Fixed the sync route to derive `user_id` from session when called from a browser; frontend no longer sends `user_id`.

- [x] **[DEAD CODE] `TimelineEvent` unused re-export** — `TreatmentTimeline.tsx:16` — `export type { TimelineEvent }` re-exported a type no external consumer imported. Removed.

- [x] **[DEAD CODE] `CheckinInput` unused export** — `checkin-validation.ts:11` — Type exported but imported nowhere outside the file. Changed to local `type`.

- [x] **[DEAD CODE] `EligibilityGap` unused re-export** — `gapAnalysis.ts:3` — Re-exported from `assembleProfile` but no consumer imported it from `gapAnalysis`. Removed re-export line.

- [x] **[DEAD CODE] `babel.config.js` + `babel-preset-expo`** — `apps/mobile/` — Config file and its package were unused (Expo no longer needs explicit Babel config). Deleted `babel.config.js`, removed `babel-preset-expo` from `package.json`.

---

---

## Chat AI & Notifications Audit — 2026-05-02 (all fixed ✅)

Full plan: `docs/superpowers/plans/2026-05-02-chat-notifications-audit.md`

- [x] **[SECURITY] CSRF missing in NotificationsView dismiss/markAllRead** — `NotificationsView.tsx:60,73` — POST to `/api/notifications/read` lacked `x-csrf-token` header; backend rejected all calls. Added CSRF header + error rollback.
- [x] **[SECURITY] CSRF missing in NotificationBell dismiss/markAllRead** — `NotificationBell.tsx:88,99` — Same missing header; silent failures. Added CSRF header + rollback.
- [x] **[BUG] "Ask AI" prompt never auto-sent from NotificationsView** — `NotificationsView.tsx:145` — Used `"Tell me more about: {title}"` which doesn't match `isAllowedPrompt()`. Changed to type-based prompts (`"Help me manage my medication refills"` etc) that all match allowlist.
- [x] **[BUG] getChatPrompt() patterns in NotificationBell didn't match allowlist** — `NotificationBell.tsx:36-55` — Prompts like `"Explain this lab result: {title}"` never auto-sent. Replaced all with type-based allowlist-compatible patterns.
- [x] **[SECURITY] PHI in chat URL params from notification links** — `NotificationsView.tsx:145`, `NotificationBell.tsx:162` — Notification titles (med names, lab values) were URL-encoded into `?prompt=`. Removed titles from URLs; now use generic type prompts.
- [x] **[BUG] Soft-deleted medications/appointments generated spurious notifications** — `notifications.ts:84,87` — Missing `isNull(deletedAt)` filters. Added to both queries.
- [x] **[BUG] markAllRead shows success toast on API failure** — `NotificationsView.tsx:71-79` — No `res.ok` check. Fixed: rollback state and show error toast on failure.
- [x] **[BUG] NotificationBell dismiss had no error handling** — `NotificationBell.tsx:85-93` — Notification disappeared from UI but wasn't marked read on failure. Added rollback.
- [x] **[RELIABILITY] generateNotificationsForAllUsers timed out for large user bases** — `notifications.ts:371-376` — Serial loop failed at 120+ users (Vercel 60s cron limit). Replaced with batched `Promise.allSettled` (10 parallel).
- [x] **[BUG] Orchestrator rate limiter created new instance per request** — `orchestrator.ts:54` — `rateLimit()` called inside function body; per-process state never shared. Moved to module scope.
- [x] **[BUG] Orchestrator polluted memories table with system telemetry** — `orchestrator.ts:131-143` — Multi-agent queries logged as `category: 'other'` memory facts; memory extraction LLM then "saw" these as patient facts. Removed the insert block.

---

## P0 — Critical (breaks core user flow or clinical integrity)

- [x] **[QA] Silent fetch swallow on trials mount** — `TrialsTab.tsx:112` — `.catch(() => {})` on both `/api/trials/matches` and `/api/trials/saved` fetch errors. User sees empty tab with no error and no retry. Fix: catch, set error state, render error banner with retry button.

- [x] **[QA] `isCloseTrial` override misclassifies high-scoring matched trials** — `clinicalTrialsAgent.ts:109` — Claude scores a trial 95/100 as `'matched'` but `isCloseTrial` downgrade fires if any gap exists, reclassifying it to `'close'`. Fix: only apply `isCloseTrial` as fallback when `rawCat` is neither `'matched'` nor `'close'`, not on all matched results.

- [x] **[QA] Concurrent `runLive` race condition** — `TrialsTab.tsx:116-132` — `ProfileDataPrompt.onSaved` calls `void runLive()` while button-click can trigger a second concurrent POST. Two calls race; second overwrites state non-deterministically. Fix: add `useRef` guard or check `liveRunning` before entering `runLive`.

- [x] **[DESIGN] TrialMatchCard is a light-mode component in a dark app** — `TrialMatchCard.tsx:27-129` — All color tokens (`bg-white`, `text-gray-500`, `bg-green-100`, `bg-blue-600`, `border-gray-300`) are wrong for the dark design system. Every matched trial card renders broken. Fix: rewrite using `bg-[var(--bg-card)]`, `text-[var(--text)]`, Trust Indigo CTAs, and design system semantic colors throughout.

---

## P1 — High (degrades UX, misleads user, or violates design principles)

- [x] **[QA] `hasSearched` not set on `runLive` failure** — `TrialsTab.tsx:309-327` — After a failed live search (`liveError` set), `hasSearched` stays `false`. Empty state reads "Click Find trials now to search" directly below the error banner. Contradictory. Fix: set `hasSearched = true` in the catch block.

- [x] **[QA] Stale threshold 90 days is clinically misleading** — `matches/route.ts:20` — Trial enrollment status changes frequently; an 89-day-old result shows as fresh. Fix: lower to 30 days or show "last checked" label on every result regardless of stale flag.

- [x] **[QA] New user "All clear!" identical to onboarded user with no alerts** — `DashboardView.tsx:437-444` — New user with 0 data sees same green checkmark and "All clear!" as an onboarded user with nothing urgent. Fix: gate "All clear" on `onboardingComplete && (medications.length > 0 || appointments.length > 0)`. Show "Get started" heading for new users.

- [x] **[QA] `searchByEligibility` is a duplicate search** — `clinicalTrialsAgent.ts:38-39` — Function passes `age` but `tools.ts` ignores it; calls same CT.gov endpoint as broad search. Deduplication on line 51 collapses any benefit. Fix: pass age/sex as `query.term` to CT.gov or remove the duplicate call and use one search with `pageSize: 40`.

- [x] **[DESIGN] Hero metric grid in Analytics tab** — `AnalyticsDashboard.tsx:96-111` — Three identical centered stat cards with `text-2xl font-bold` numbers over `text-[10px] uppercase` labels — textbook AI slop hero metric template. Fix: remove grid; fold adherence rate inline into the adherence section below it.

- [x] **[DESIGN] Gradient CTAs throughout** — `DashboardView.tsx:183`, `DashboardView.tsx:595-617`, `TrialsTab.tsx:245` — `bg-gradient-to-r from-[#6366F1] to-[#A78BFA]` used on multiple buttons. DESIGN.md prohibits gradient fills outside primary button. Fix: replace all with solid `bg-[#6366F1] hover:bg-[#4F46E5]`.

- [x] **[DESIGN] Celebratory/gamified microcopy** — `DashboardView.tsx:419`, `ProfileCompleteness.tsx:309` — "Looking good!" on empty dashboard, "Profile complete!" with exclamation. Wrong emotional register for cancer caregivers. Fix: `"[name]'s care is up to date."` / `"Profile complete"` (no exclamation).

- [x] **[DESIGN] All symptom pills styled as alerts** — `AnalyticsDashboard.tsx:182` — `bg-red-500/10 text-red-400` applied to every reported symptom regardless of severity. Fatigue appears as alarming as a critical lab. Fix: use neutral `bg-white/[0.06] text-[var(--text-secondary)]`; reserve red for clinically flagged symptoms only.

- [x] **[ENG] weeklyUpdate error buried below fold** — `DashboardView.tsx:636-638` — Error state renders as small muted text after all action cards. No retry affordance. Fix: show error inline where the card would appear, with a retry button.

---

## P2 — Medium (polish, accessibility, consistency)

- [x] **[QA] `trialUrl` empty string instead of null** — `clinicalTrialsAgent.ts:123` — `String(t.url ?? '')` writes `""` to DB when LLM omits url; TrialMatchCard renders a broken empty anchor. Fix: `t.url ? String(t.url) : null`.

- [x] **[QA] Trials mount fetch has no timeout** — `TrialsTab.tsx:89-113` — If either fetch never resolves (network hang), spinner shows indefinitely. Fix: add `AbortController` with 10s timeout.

- [x] **[DESIGN] `text-[10px]` throughout** — `AnalyticsDashboard.tsx:99,103,109`, `PriorityCard.tsx:77` — Below WCAG AA minimum for body text. Fix: bump all to `text-xs` (12px) minimum.

- [x] **[DESIGN] Hardcoded hex instead of CSS vars** — `DashboardView.tsx:450,540`, `TrialsTab.tsx:166,245` — `text-[#64748b]`, gradient inline styles bypass the design token system. Fix: replace with `text-[var(--text-muted)]` and `bg-[#6366F1]` Tailwind classes.

- [x] **[DESIGN] Emoji in clinical data** — `TrialMatchCard.tsx:101` — `📍` for location is inaccessible and tone-inappropriate. Fix: SVG pin icon with `aria-hidden="true"` + visible text.

- [x] **[DESIGN] Trials loading overlay uses off-token background** — `TrialsTab.tsx:166` — `linear-gradient(135deg, #0a0814 0%, #110d24 100%)` diverges from design token `#0C0E1A`. Fix: `bg-[#0C0E1A]`.

- [x] **[ENG] Lab trend direction has no direction-semantics field** — `AnalyticsDashboard.tsx:215-219` — `↑`/`↓` are now neutral (fixed this session) but there's no `directionIsGood` field on `LabResult` type. Future dev could re-introduce red/green. Fix: add `directionIsGood: boolean | null` to `LabResult` schema and Aurora table.

- [x] **[DESIGN] `"Profile complete"` exclamation and `"Your care team has everything they need."` copy** — `ProfileCompleteness.tsx:309` — Remove exclamation. Keep supporting copy.

---

## Auth Audit — 2026-05-02 (preview/trials-impeccable)

- [x] **[AUTH] `consent/accept` used email instead of user ID** — `consent/accept/route.ts:27` — `eq(users.email, session.user.email!)` silently fails for Apple users where email may be null. Fixed to `eq(users.id, session.user.id)`.

- [x] **[AUTH] Open redirect via `//evil.com` callbackUrl** — `middleware.ts:90` — `cb.startsWith('/')` allows `//evil.com`. Fixed: added `!cb.startsWith('//')` guard.

- [x] **[AUTH] No rate limiting on `/api/auth/register`** — `register/route.ts` — attacker could create unlimited accounts. Fixed: 5 registrations/hour per IP.

- [x] **[AUTH] `set-role` session update used raw fetch with no error check** — `set-role/page.tsx` — `fetch('/api/auth/session', {})` not checked for failure; could leave JWT stale (role=null), causing middleware to redirect back to `/set-role` loop. Fixed: use `useSession().update()` from `next-auth/react`; check result before navigating.

- [x] **[AUTH] Hardcoded personal email in debug-auth** — `debug-auth/route.ts:13` — `'aryan.motgi1@gmail.com'` as default. Fixed: require `?email=` param; removed from `PUBLIC_PATHS`.

- [ ] **[AUTH] `pending_role` cookie dead code** — `auth.ts:94-104` — Cookie never set by any web UI. New Google/Apple users correctly land on `/set-role` via middleware redirect. Safe to remove the cookie-check branch when cleaning up.

- [ ] **[AUTH] Consent redirect loses original destination** — `consent/page.tsx:37` — Always redirects to `/dashboard` after acceptance. Store original URL in `sessionStorage` before consent redirect; restore after.

- [ ] **[AUTH] `debug-auth` route should be deleted** — `app/api/debug-auth/route.ts` — Marked TEMP. Self-gates on `NODE_ENV !== 'development'`. Delete when no longer needed.

- [ ] **[AUTH] Care group login lacks rate limiting** — `auth.ts:46-88` — No brute-force protection on the care-group Credentials provider. Add limiter by groupName.

---

## Onboarding Audit — 2026-05-02 (preview/trials-impeccable)

### FIXED

- [x] **[SECURITY] `join/page.tsx` careGroupId URL param not verified against invite** — `join/page.tsx:50` — Attacker could craft `/join?group=VICTIM_GROUP_ID&token=VALID_TOKEN_FOR_DIFFERENT_GROUP` to join any group using any valid token. Fixed: verify `invite.careGroupId === careGroupId` before processing; use `invite.careGroupId` (not URL param) for all member inserts.

- [x] **[SECURITY] `POST /api/onboarding/complete` no ownership check on careProfileId** — `onboarding/complete/route.ts:16` — Any authenticated user could mark any care profile as `onboardingCompleted: true` by sending a foreign `careProfileId`. Fixed: look up `dbUser` by email and verify `careProfiles.userId === dbUser.id` before update.

- [x] **[BUG] PatientWizard manual entry: medications and appointment never saved** — `PatientWizard.tsx:201` — `manualMeds` (array of 3 inputs) and `manualAppt` (date) collected but excluded from `patchProfile` call. Only `manualDiagnosis` was saved. Fixed: filter non-empty `manualMeds`, join as comma-separated text, save to `conditions` field with `fieldOverrides.conditions=true`. (Note: `nextAppointment` has no column in `careProfiles` — data was unrecoverable per schema; tracked below.)

- [x] **[BUG] Care profile creation failure silently redirects to dashboard → redirect loop** — `OnboardingShell.tsx:119` — When `/api/care-profiles` POST fails or returns no `id`, `wizardProfileId` is `null`; phase-complete fallback fires `window.location.href='/dashboard'`; `AppLayout` finds no completed profile and redirects back to `/onboarding`. Fixed: set `profileCreateError` state on failure; render actionable error with "Try again" instead of redirecting.

- [x] **[BUG] QR polling interval leaks on unmount** — `CareGroupScreen.tsx:79` — `setInterval` (3s) and `setTimeout` (30s) created in `startPolling` never cleared if component unmounts before timeout. Fixed: store refs in `pollingRef`; `useEffect` cleanup clears both on unmount; interval self-cleans on successful join.

### OPEN

- [ ] **[BUG] PatientWizard confirm screen: `nextAppointment` collected but never saved** — `PatientWizard.tsx:140-152` — Confirm screen shows "Next appointment" editable field, user edits it, patchProfile call (line 160) omits it. `careProfiles` has no `nextAppointment` column — needs schema column + PATCH allowlist entry.

- [ ] **[BUG] PatientWizard manual entry: `manualAppt` collected but not saveable** — `PatientWizard.tsx:197` — Same root cause as above. Date input appears but has nowhere to persist until `nextAppointment` column is added.

- [ ] **[BUG] PatientWizard "Connect Apple Health" button is misleading on web** — `PatientWizard.tsx:102` — Button says "Connect Apple Health" but on web it just fetches existing profile data from DB (HealthKit requires the iOS app). Label should read "Check my health data" or "Review profile data". No logic change needed.

- [ ] **[BUG] `self` role treated identically to `patient` in OnboardingWizard** — `OnboardingWizard.tsx:17` — Both go to `PatientWizard`. If `self` users are meant to track their own health proactively (not cancer patients), the caregiver wizard steps about patient name / relationship don't apply. No dedicated `self` wizard path exists — intentional gap or missing feature.

- [ ] **[SECURITY] `POST /api/auth/set-role`, `/api/care-group`, `/api/care-group/join`, `/api/onboarding/complete` have no CSRF token check** — Unlike `consent/accept` which uses `validateCsrf`. Session cookie is `sameSite: lax` so cross-site POSTs from attacker-controlled pages could trigger these on behalf of a victim. Either validate the `cc-csrf-token` header on all mutation endpoints or confirm `sameSite: strict` on session cookie.

- [ ] **[UX] Returning user who visits `/onboarding` re-enters wizard on completed profile** — `OnboardingShell.tsx:48` — If user has a completed profile and navigates to `/onboarding`, phase starts as `'wizard'` and the wizard opens on the completed profile. Should redirect to `/dashboard` or show "You're all set" state.

---

## Dashboard Flow Audit — 2026-05-02 (preview/trials-impeccable)

### FIXED

- [x] **[SECURITY] `GET /api/checkins` missing careProfileId ownership check** — `checkins/route.ts:241` — Any authenticated user could read any care profile's check-in data and streak by passing an arbitrary `careProfileId`. Fixed: verify caller owns profile (`careProfiles.userId === dbUser.id`) or is a care team member before returning data.

- [x] **[BUG/HIGH] Energy enum mismatch — `CheckinModal` sends `'med'`, server validates `'medium'`** — `CheckinModal.tsx:22`, `checkin-validation.ts:6` — `ENERGY_OPTIONS = ['low', 'med', 'high']` but server schema is `z.enum(['low', 'medium', 'high'])`. Every check-in with Med energy returned 400 Validation error. Fixed: changed modal value to `'medium'`, display still reads `'Med'`. Also added `med: 2` to `SymptomRadarCard.ENERGY_MAP` for backward compat with any existing DB rows.

- [x] **[BUG] Appointment cards showed past same-day appointments as "Today"** — `DashboardView.tsx:206` — `daysUntil = Math.ceil(...)` rounds negative fractions up to 0, so a 2-hour-past appointment shows as "Today at X". Fixed: added `if (apptDate.getTime() <= now.getTime()) return` guard before the daysUntil check.

- [x] **[BUG] Analytics page `session.user.email!` non-null assertion** — `analytics/page.tsx:15` — Apple Sign-In users can have a null email; the `!` assertion caused DB query with `undefined`, returning no user and silently redirecting. Fixed: added `if (!userEmail) redirect('/login?error=session')` guard.

- [x] **[UX] CheckinCard returned `null` during loading, causing layout shift** — `CheckinCard.tsx:59` — The 200–500ms fetch for today's check-in status rendered nothing, causing the dashboard to jump when the card appeared. Fixed: replaced `null` with an animated skeleton placeholder matching the card's dimensions.

- [x] **[BUG] NotificationsView dismiss not rolled back on API error** — `NotificationsView.tsx:57` — Optimistic removal fired before fetch; on failure the notification was gone from UI but still unread in DB (would reappear on next page load inconsistently). Fixed: snapshot previous state, restore on non-ok response, show toast.

### OPEN

- [ ] **[BUG] MorningSummaryCard `medicationCount` shows total active meds, not today's scheduled** — `DashboardView.tsx:122` — `todayMedCount = medications.filter(m => !m.deletedAt).length` counts all active meds. Morning card shows "Meds: 5 scheduled" but some may be weekly or PRN. Fix: cross-reference with `reminderLogsData` (already fetched in page.tsx) to count today's scheduled reminders, pass as `medicationCount` to `DashboardView`.

- [ ] **[UX] MorningSummaryCard `dismissed: true` default causes pop-in** — `MorningSummaryCard.tsx:21` — Initial state is `true` (hidden); useEffect sets `false` after localStorage check. Users on fast connections see a layout pop on every page load. Fix: render a fixed-height placeholder while `useEffect` hasn't run, or use a CSS `visibility: hidden` approach so space is reserved.

- [ ] **[DEAD CODE] `CheckinModal` milestone overlay never triggers** — `CheckinModal.tsx:67` — Client checks `data.data?.milestone` but the POST `/api/checkins` response never includes `milestone`. `MilestoneCelebration` component is unreachable. Either implement milestone calculation in the API (e.g., streak milestones at 7/30/100 days) or remove the dead branch.

- [ ] **[BUG] `CheckinModal.handleMilestoneClose` hardcodes streak=0** — `CheckinModal.tsx:115` — When milestone closes, calls `onComplete(null, 0)` — streak momentarily shows 0 until `fetchStatus()` corrects it. Fix: once milestone API is implemented, return `streak` in milestone response and pass it through.

- [ ] **[SECURITY] POST-only mutation endpoints missing CSRF check** — Already tracked in Onboarding Audit open items. Applies to `POST /api/checkins` as well — it validates body but has no `validateCsrf` call unlike `notifications/read`.

---

## Adversarial Review — 2026-05-02 (preview/trials-impeccable)

### FIXED

- [x] **[SECURITY] `POST /api/onboarding/complete` used `email!` in new ownership-check code** — `onboarding/complete/route.ts:16` — The ownership-check fix that was just applied looked up `dbUser` using `session.user.email!` — the same null-assertion pattern fixed in analytics and consent. Apple Sign-In users get 404 and can never complete onboarding. Fixed: changed to `WHERE id = session.user.id`.

- [x] **[SECURITY] `POST /api/trials/match` had no rate limit** — Any authenticated user could loop this endpoint to drain Anthropic API budget; `maxDuration = 300` and scoring 100 trials per call. Fixed: added `rateLimit({ interval: 3600000, maxRequests: 3 })` per user ID.

- [x] **[BUG] `dismissTrial` had no rollback on API failure** — Trial removed from UI optimistically; fetch error swallowed silently; trial permanently gone until next page load (clinical data loss). Fixed: snapshot arrays before mutation, restore on non-ok response.

- [x] **[SECURITY] `POST /api/onboarding/complete` used `session.user.id` not `dbUser.id` for care group lookup** — Line 36 used the JWT claim, not the DB-resolved ID; care group email may fail for migrated accounts. Fixed: changed to `dbUser.id`.

### OPEN

- [ ] **[SECURITY] In-memory rate limiter per-serverless-instance** — `rate-limit.ts:25` — `buckets = new Map()` is per-function-instance in Vercel serverless. Without Redis env vars, 5-registration limit is not enforced globally across cold starts. Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set in Vercel production.

- [ ] **[BUG] `set-role` page: `update()` null check may block valid Apple Sign-In flow** — `set-role/page.tsx:35` — NextAuth `update()` can legitimately return null if the JWT wasn't expired; the `if (!updated)` guard would show an error to users who successfully set their role. Verify behavior with Apple Sign-In in staging.

- [ ] **[BUG] Join page TOCTOU on invite token** — `join/page.tsx:38-64` — `usedBy` check and insert are three separate DB ops with no transaction; two simultaneous joins could both pass the check. Wrap in a transaction or use conditional UPDATE.

- [ ] **[BUG] LLM JSON extraction regex matches wrong array on truncated response** — `clinicalTrialsAgent.ts:76` — Greedy regex picks first `[...]` in response; truncated output silently returns 0 trials. Add logging when fallback fires; test with pre-result example arrays.

---

---

## Care Tab Full Audit — 2026-05-02 (preview/trials-impeccable)

Legend: ✅ Fixed | ⬜ Pending | [C] Critical | [H] High | [M] Med | [L] Low

### MEDICATIONS — Backend (`app/api/records/medications/route.ts`)

- ✅ [C] No string length limits on any text field (name/dose/frequency/notes/refill_date) — POST lines 47-55
- ✅ [C] `refill_date` stored as raw unvalidated string (no format/range check) — POST:53, PATCH:129
- ✅ [H] PUT bulk: `String(undefined)` → literal `"undefined"` stored as medication name — line 162
- ✅ [H] PUT bulk: unbounded array length, no cap — line 148
- ✅ [H] DELETE/PATCH ownership lookup doesn't filter soft-deleted records — lines 76-80, 111-115
- ✅ [H] PATCH can update `refillDate` on a soft-deleted medication — lines 127-131
- ✅ [M] Whitespace-only name (`"   "`) passes `!name` check — POST line 25
- ✅ [M] DELETE fires `triggerMatchingRun` with wrong reason `'new_medication'` — line 93
- ✅ [L] `refill_date` schema column is `text` not `date` type — schema.ts:91

### MEDICATIONS — Frontend (`components/MedicationsView.tsx`)

- ✅ [H] Silent failure on POST — no user-facing error state — lines 44-69
- ✅ [H] Silent failure on DELETE — dialog closes with no error — lines 72-85
- ✅ [H] Silent failure on PATCH refill — editor closes, date change lost silently — lines 87-101
- ⬜ [M] No loading state during post-scan re-fetch — lines 111-117
- ⬜ [M] `handleScanSaved` fetch failure is completely silent — lines 111-117
- ✅ [M] `savingRefill` is global state — disables all rows while one saves — line 29
- ⬜ [M] No client-side or server-side duplicate name detection
- ✅ [M] Date input has no `min`/`max` bounds — line 220-224

### LABS — Frontend (`components/LabTrends.tsx`, `LabTrendChart.tsx`, `lib/lab-trends.ts`)

- ✅ [C] STATUS_CONFIG mismatch — `'warning'`/`'stable'` from API crash UI (no key in STATUS_CONFIG) — LabTrends.tsx:41-45, lab-trends.ts:240
- ⬜ [H] Chart date sort wrong across year boundaries (year always = current year) — LabTrendChart.tsx:186-192
- ✅ [H] 1-point chart renders as degenerate invisible line with no message — LabTrendChart.tsx:211-213
- ✅ [H] Rapid rise of tumor markers misclassified as "Declining" not "Rapid Decline" — lab-trends.ts:109-113
- ⬜ [H] No error boundary for DB failure on labs page — page.tsx:21-25
- ⬜ [H] `care_profile_id` accepted but ownership never verified — records/labs/route.ts:12-31
- ✅ [M] Date UTC parsing off-by-one in "Recent" filter — LabsView.tsx:33
- ✅ [M] SVG gradient ID collides across multiple sparklines — LabTrends.tsx:166
- ✅ [M] `change_percent: null` when value is exactly 0.0% (falsy zero bug) — lab-trends.ts:179
- ⬜ [M] Multi-test chart uses first trend's reference range for all lines — LabTrendChart.tsx:215-216
- ⬜ [M] No retry / stale-data indicator after 429 rate limit — LabTrends.tsx:417-418
- ✅ [L] `formatDateHeading` renders "Invalid Date" heading for malformed dateTaken — LabsView.tsx:10-17
- ✅ [L] Exponential notation (e.g., `1.5e-3`) stripped → wrong float — lab-trends.ts:66-71
- ✅ [L] Chat prompt sends lab value without unit — LabTrends.tsx:297-300

### APPOINTMENTS — Backend + Frontend

- ✅ [H] Field name mismatch: sends `doctorName` (camelCase), API reads `doctor_name` — AppointmentsView.tsx:34
- ⬜ [H] No edit capability — delete + re-add only
- ⬜ [M] No past-date guard on form (no `min` attribute on datetime-local)
- ⬜ [M] UTC ISO string parsed in browser local time — appointment can appear in wrong day
- ⬜ [M] No deduplication — double-tap inserts duplicate appointments

### TREATMENT CYCLES — Backend + Frontend

- ✅ [C] No DELETE endpoint for cycles — [id]/route.ts only has PATCH
- ⬜ [H] Side effects stored in localStorage only — lost on device switch/incognito — TreatmentCycleTracker.tsx:169-186
- ✅ [H] Divide-by-zero when `totalCycles` is 0 or `cycleLengthDays` is 0 — lines 209-210
- ✅ [H] `dayInCycle` can exceed `cycleLengthDays` when refill date is past — lines 58-59
- ✅ [M] Whole tracker hidden with no fallback when no meds match cycle regex — line 207
- ⬜ [M] Cycles GET doesn't filter soft-deleted profiles — route.ts:35-43
- ⬜ [M] `isActive` stays true after final cycle completes — route.ts:88-92

### DRUG INTERACTIONS — Backend + Frontend

- ⬜ [C] Severity mismatch: API produces `major/moderate/minor`, component has `critical` key — never reachable — InteractionWarning.tsx:6 + drug-interactions.ts:12
- ⬜ [H] Unhandled rejection if `generateText` throws / `output` undefined — drug-interactions.ts:36,59
- ✅ [H] Soft-deleted meds included in interaction check (missing `isNull(deletedAt)`) — interactions/check/route.ts:44
- ✅ [M] Single-medication LLM call still fires with 0 other meds — route.ts:61-74

### REFILL STATUS — Backend + Frontend

- ✅ [H] Soft-deleted medications included in refill calculations — refill-tracker.ts:23-33
- ⬜ [H] `days_until_refill` is negative for overdue meds (semantic bug) — refill-tracker.ts:60
- ⬜ [M] No rate limit on `/api/refills/status` GET endpoint
- ✅ [L] Ambiguous JSON shape double-fallback — RefillStatus.tsx:118
- ✅ [L] No "last updated" timestamp on refill card

### MANUAL ENTRY & UPLOAD — Backend + Frontend

- ⬜ [C] No server-side MIME type check — any file type accepted — documents/extract/route.ts:122
- ⬜ [C] File fully buffered BEFORE size check — OOM risk on large uploads — documents/extract/route.ts:56-58,122
- ⬜ [C] Empty form can be submitted with no client-side validation — CategoryUploadCard.tsx:214
- ⬜ [H] No field-level error feedback — only generic "Failed" toast — CategoryUploadCard.tsx:227
- ⬜ [H] Date fields not validated — invalid strings persisted to DB — EditableFieldList.tsx:19,39,52
- ⬜ [H] Number → NaN silently sent as JSON number — CategoryUploadCard.tsx:128-138
- ⬜ [H] No upload timeout / AbortController — UI hangs indefinitely — CategoryUploadCard.tsx:192-203
- ⬜ [H] Insurance deductible/OOP never pre-populated from OCR — CategoryUploadCard.tsx:81-82
- ⬜ [H] Rate limit by IP not user ID in save-scan-results — route.ts:67-70
- ⬜ [M] `document_id` update lacks ownership check (IDOR) — documents/extract/route.ts:80-85
- ⬜ [M] Category hint allowlist mismatch client vs server
- ⬜ [M] Manual form stays open after successful save — CategoryUploadCard.tsx:224-226
- ⬜ [M] PDF renders as broken image in preview — CategoryUploadCard.tsx:325
- ⬜ [M] Cancel button enabled during save — state corruption risk — CategoryUploadCard.tsx:375
- ⬜ [M] Appointment `location` dropped from OCR extraction — CategoryUploadCard.tsx:56-60
- ✅ [L] Conditions not trimmed/deduped after extraction — CategoryUploadCard.tsx:44-45
- ✅ [L] Insurance "Unknown" provider fallback silently saved — CategoryUploadCard.tsx:124

### KNIP

- ✅ Installed `knip@6.11.0` — added `"deadcode": "knip"` to root `package.json` scripts

---

## Already fixed this session (do not re-open)

- ~~Dashboard layout contract: action cards first, secondary surfaces below fold~~
- ~~Lab trend direction: neutral ↑↓ arrows instead of red/green~~
- ~~ProfileCompleteness: +11% gamification badges removed~~
- ~~PriorityCard: expand affordance chevron + "Action steps" label added~~
- ~~weeklyUpdate fetch: error state added (basic)~~
- ~~"AI ASSISTANT" label → "ASK ANYTHING"~~
- ~~CT.gov query: strips (TEST) suffix from cancerType~~
- ~~System prompt: strips (TEST) from cancer type shown to Claude~~
- ~~Phase field: added to Claude scoring output spec~~
- ~~LoginForm: window.location.href instead of router.push after signIn~~
- ~~AnalyticsDashboard: unused `changeStr` variable removed (ESLint)~~

---

## Clinical Trials Full Audit — 2026-05-02 (preview/trials-impeccable)

Legend: ✅ Fixed | ⬜ Pending | [C] Critical | [H] High | [M] Med | [L] Low

### REACT / FRONTEND

- ✅ [C] **TrialDetailPanel: fetch() in render body** — `TrialDetailPanel.tsx:115` — Direct `setLoading(true)` + `fetch()` inside render function violates React rules; fires twice per mount in Strict Mode, leaks request on unmount. Fixed: moved to `useEffect` with `cancelled` flag and `[nctId, isCloseMatch]` deps.
- ✅ [H] **saveTrial: no rollback on API error** — `TrialsTab.tsx:140` — Optimistic `setSaved` fired before request; `.catch(()=>{})` swallowed failures. UI showed trial as saved even when save failed. Fixed: snapshot prev state, rollback on `!res?.ok` (mirrors existing dismissTrial pattern).
- ✅ [H] **TrialsTab initial load: `Promise.all` fails both on single fetch error** — `TrialsTab.tsx:92` — If saved-trials fetch threw, trial matches were also discarded and error screen shown even if matches loaded fine. Fixed: `Promise.allSettled` with graceful degradation (saved badges simply absent on failure).
- ✅ [M] **TrialMatchCard: city/state renders "undefined, undefined"** — `TrialMatchCard.tsx:105` — `{nearestSite.city}, {nearestSite.state}` renders literal "undefined, undefined" when CT.gov omits location fields. Fixed: `[city, state].filter(Boolean).join(', ') || 'Location not listed'`.
- ✅ [M] **CloseMatchCard: empty eligibilityGaps renders broken UI** — `CloseMatchCard.tsx:72` — `eligibilityGaps = []` shows "What's blocking eligibility" header with nothing below it. Fixed: added empty-state message.
- ✅ [M] **ContactBlock: dead `href="#"` fallback link** — `TrialDetailPanel.tsx:73` — `<a href="#">visit the trial page directly</a>` navigates nowhere. Fixed: thread `trialUrl` prop through; render external link or plain text.
- ⬜ [M] **TrialDetailPanel uses hardcoded light-theme colors** — `TrialDetailPanel.tsx` throughout — `text-gray-700`, `bg-gray-50`, `border-gray-200` hardcoded against the dark design system. Rest of app uses `var(--text)`, `var(--bg-card)`. Fix: replace with CSS variable equivalents.
- ⬜ [M] **Retry on initial load does full page reload** — `TrialsTab.tsx:178` — "Retry" button calls `window.location.reload()` instead of re-running the fetch function. Fix: extract load logic into a function, call on retry without full reload.
- ✅ [L] **TrialsTab: cancerStage, patientAge, patientName props unused** — `TrialsTab.tsx:37` — Props accepted but never destructured or used inside the component. Fix: either wire them into display hints or remove from Props type.

### BACKEND — SECURITY

- ✅ [H] **No NCT ID validation in 4 API endpoints** — `save/route.ts`, `saved/[nctId]/route.ts`, `[nctId]/route.ts`, `[nctId]/detail/route.ts` — `nctId` accepted as any string; passed directly to CT.gov API and DB queries. Fixed: `/^NCT\d{4,}$/` regex check, returns 400 for invalid IDs.
- ⬜ [M] **LLM prompt injection surface** — `clinicalTrialsAgent.ts:62` — CT.gov trial data embedded raw into Claude prompt via `JSON.stringify`. CT.gov is trusted, but adversarially-crafted trial records could inject instructions. Fix: add system-prompt-level instruction to ignore embedded directives; strip known injection patterns from trial text before embedding.
- ✅ [L] **`/api/trials/matches` category param unvalidated** — `matches/route.ts:14` — `category` query param used in where-clause condition with no enum check. Falls through to "all" for unknown values — functionally OK but leaks query structure in logs. Fix: validate against `['matched', 'close', 'all']` or ignore unknown values explicitly.

### BACKEND — CORRECTNESS

- ✅ [C] **trialMatches schema missing `phase` column** — `schema.ts:582` — `phase` existed in `TrialMatchResult` and in-memory objects but was never persisted to `trial_matches`. Cached results (GET `/api/trials/matches`) always returned `phase: undefined`, showing "Phase N/A" even when phase was known. Fixed: added `phase text` column to schema, updated `upsertTrial` to persist it, created migration `002-trial-matches-phase.sql`.
  - **⚠️ ACTION REQUIRED**: Run `apps/web/src/lib/db/migrations/002-trial-matches-phase.sql` against production DB.
- ✅ [M] **assembleProfile: empty string for missing lab date** — `assembleProfile.ts:119` — `resultDate: l.dateTaken ?? ''` sent blank string to LLM as a date field. Fixed: `l.dateTaken ?? 'Date unknown'`.
- ⬜ [M] **triggerMatchingRun blocks caller for 2s** — `matchingQueue.ts:36` — `await new Promise(r => setTimeout(r, 2000))` adds 2s latency to every awaiting caller. Comment says "fire-and-forget" but function is awaitable. Fix: callers should `void triggerMatchingRun(...)`. Or remove the sleep and let the cron handle debouncing.

### CRON / NOTIFICATIONS

- ✅ [H] **cron/trials-match: no LIMIT on close-trials query** — `cron/trials-match/route.ts:54` — `db.select().from(trialMatches).where(matchCategory='close')` loaded all close-match rows. At scale this is an OOM risk in a 300s function. Fixed: `.limit(200)`.
- ✅ [H] **cron/trials-status: no dedup on status-change notifications** — `cron/trials-status/route.ts:44` — Inserted new notification on every status-change detection without any 24h dedup. A trial oscillating between statuses would spam user. Fixed: 24h dedup check on `userId + type + nctId`, matching the pattern in `matchingQueue.ts`. Message now includes NCT ID and new status.
- ⬜ [M] **Gap-closure cron skips profiles silently on LLM error** — `cron/trials-match/route.ts:97` — `catch { /* skip profile, continue */ }` swallows all LLM errors with no logging. Profile never gets gap-checked until next cron. Fix: `console.error(profileId, err)` at minimum.
- ⬜ [M] **`Output.object` structured output may throw on malformed LLM response** — `cron/trials-match/route.ts:72` — If `output.resolved` is undefined (model returns wrong shape), the `for...of` throws. Currently caught by the profile-level try/catch. Fix: add `output?.resolved ?? []` defensively.

### PRODUCT / UX

- ⬜ [M] **Trial search only fetches 40 results from CT.gov** — `clinicalTrialsAgent.ts:37` — `pageSize: 40` may miss relevant trials for common cancers (Breast, Lung Cancer). CT.gov supports up to 1000. Tradeoff: more results = higher LLM cost + latency. Consider 100 with condition-specific pre-filtering.
- ✅ [L] **searchByEligibility is dead code** — `tools.ts:128` — Function exists but ignores its `age` and `sex` params; calls same endpoint as `searchTrials`. No callers since the agent was refactored to a single search. Safe to delete.

### KNIP / DEAD CODE

- ✅ Created `knip.json` ignoring `.claude/**`, `.clone/**`, `.context/**` — reduced false-positive "unused files" from 20 → 5.

---

## Scan & Document Upload Flow Audit — 2026-05-02 (preview/trials-impeccable)

Legend: ✅ Fixed | ⬜ Pending | [C] Critical | [H] High | [M] Med | [L] Low

### CRITICAL — Backend Security

- ✅ [C] **CSRF token missing in all scan/save fetch calls** — `DocumentScanner.tsx:100,122`, `CategoryScanner.tsx:113,135`, `CategoryUploadCard.tsx:193,218` — All three components POST to `/api/scan-document` and `/api/save-scan-results` without `x-csrf-token` header. Both endpoints call `validateCsrf` first; every scan returned 403 silently swallowed as "Failed to analyze the document." Fixed: added `useCsrfToken()` hook to all three components; pass header in all fetch calls.

### HIGH — Functional Gaps

- ✅ [H] **Bulk delete is a no-op** — `DocumentOrganizer.tsx:387` — Delete button called `exitBulkMode()` with a "// In a real app..." comment — no API call, no actual deletion. Fixed: now calls `DELETE /api/documents/:id` for each selected document in parallel; shows success/failure toast; calls `onDocumentsChanged()` to refresh.

- ✅ [H] **No DELETE endpoint for documents** — No route existed to soft-delete a document. Fixed: created `app/api/documents/[id]/route.ts` with ownership-verified soft-delete (sets `deletedAt`).

- ✅ [H] **Document list doesn't refresh after scan+save** — `ScanCenter.tsx` — After saving scan results, `onSaved` callback was not wired. Documents list remained stale until manual reload. Fixed: `ScanCenter` now calls `router.refresh()` on save in both `DocumentScanner` and `CategoryScanner`.

- ✅ [H] **No client-side file size validation** — `DocumentScanner.tsx`, `CategoryScanner.tsx`, `CategoryUploadCard.tsx` — User got no feedback until server returned 413 after full upload. Fixed: check `file.size > 10MB` before scan; show error toast immediately.

- ✅ [H] **PDFs rejected despite "Upload photo or PDF" UI copy** — `DocumentScanner.tsx:232`, `CategoryScanner.tsx:241` — `accept="image/*"` on file inputs. CategoryUploadCard correctly had `application/pdf`. Fixed: changed both to `accept="image/*,.pdf,application/pdf"`.

### HIGH — Backend (scan-document)

- ⬜ [H] **`/api/scan-document` passes base64 image but Claude API gets `type: 'image'` for PDFs** — `extract-document.ts:17` — `generateText` message uses `{ type: 'image', image: base64 }` for all inputs. PDFs encoded as base64 won't decode correctly this way — Claude Sonnet expects `{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }` for PDFs. Fix: detect `file.type === 'application/pdf'` in the scanner components, pass `media_type` to the API; update `extractDocument()` to accept a `mediaType` param.

### MEDIUM — UX / Edge Cases

- ✅ [M] **`dead code` `apps/mobile/src/lib/network-simulator.ts`** — Not imported anywhere. Deleted.

- ⬜ [M] **Bulk re-categorize is a no-op** — `DocumentOrganizer.tsx:370` — Re-categorize dropdown closes but makes no API call. No backend endpoint exists to update a document's `type` field. Fix: add a `PATCH /api/documents/:id` endpoint accepting `{ type: string }`; wire up the UI handler to call it per selected document.

- ⬜ [M] **Scan result error messages don't surface API error details** — `DocumentScanner.tsx:108`, `CategoryScanner.tsx:122` — Rate limit (429), size limit (413), and AI config errors (503) all show the same "Failed to analyze the document" message. Users hitting rate limits get no wait-time guidance. Fix: parse `error` from API response body and show specific messages (e.g. "Too many scans. Try again in 60 seconds.").

- ⬜ [M] **Save button shows when `hasData=false` in edge case** — `DocumentScanner.tsx:385` — If scan returns an empty result with `notes` text but no structured data, `hasData` is `false` (save button hidden) but notes are visible. User sees data but can't save it. Fix: include `result.notes` in `hasData` check.

### LOW — Polish

- ✅ [L] **DocumentScanner `accept="image/*"` also has `capture="environment"` which breaks desktop PDF uploads** — `DocumentScanner.tsx:234` — `capture="environment"` forces camera on mobile; on desktop it's ignored. But with PDF support now added, camera capture and file-picker conflict is more pronounced on some mobile browsers. Consider removing `capture` attribute or making it conditional.

- ✅ [L] **`DocumentOrganizer` re-categorize menu shows all 5 categories including current one** — Should filter out the document's current category from re-categorize options.

- ✅ [L] **Grid view "Scanned" source label is hardcoded** — `DocumentOrganizer.tsx:582` — All grid cards show "Scanned" regardless of source. The documents table has no `source` column. Minor; remove or add source tracking.

### KNIP FALSE POSITIVES (safe to ignore)
- `bcryptjs` at root — used in `apps/web/src/app/api/care-group/route.ts` + 3 others; knip reports it on root but it's a transitive workspace dep.
- `expo-image-picker` at root — dynamically `require()`d in `apps/mobile/app/(tabs)/scan.tsx`; knip can't detect dynamic imports.
- All 16 "unused exported types" for trials — public types exported for cross-package use; not dead code.

---

## Settings, Profile & Emergency Card Full Audit — 2026-05-02 (preview/trials-impeccable)

Legend: ✅ Fixed | ⬜ Pending | [C] Critical | [H] High | [M] Med | [L] Low

### SETTINGS — Frontend (`components/SettingsPage.tsx`, `components/NotificationPreferences.tsx`)

- ✅ [C] **Notification prefs never saved — camelCase vs snake_case key mismatch** — `NotificationPreferences.tsx:198-205` — Component sent `quietHoursStart`, `refillReminders`, etc. (camelCase) but `/api/records/settings` checks `body.quiet_hours_start`, `body.refill_reminders` (snake_case). Every save returned 400 "No valid fields" silently shown as "Failed to save" toast. Fixed: changed all payload keys to snake_case.

- ✅ [C] **Notification prefs missing CSRF header** — `NotificationPreferences.tsx:207` — No `x-csrf-token` on the settings PATCH; API has `validateCsrf` which rejects all saves. Fixed: added `useCsrfToken()` hook + CSRF header. Added `csrfToken` to `useCallback` dep array.

- ✅ [C] **AI personality never saved — camelCase vs snake_case key mismatch** — `SettingsPage.tsx:259` — Sent `{ aiPersonality: val }` but API checks `body.ai_personality`. Fix: changed to `ai_personality`.

- ✅ [H] **AI personality change missing CSRF header** — `SettingsPage.tsx:257` — inline `fetch` for personality dropdown had no `x-csrf-token`. Fixed.

- ✅ [H] **Change-password form missing `currentPassword` field** — `SettingsPage.tsx:161-173` — API (`change-password/route.ts:37`) requires `{ currentPassword, password }` but form only sent `{ password }`. Backend returned 400 "Current password is required" but the component had generic catch. Fixed: added `currentPassword` state + input field, wired into request body, surface error message from API response.

- ✅ [H] **Change-password missing CSRF header** — `SettingsPage.tsx:162` — POST to `/api/account/change-password` had no `x-csrf-token` despite endpoint calling `validateCsrf`. Fixed.

- ✅ [M] **Password min length mismatch: frontend 6 chars, API requires 8** — `SettingsPage.tsx:158,334` — `minLength={6}` and `if newPassword.length < 6` checks. API validates `password.length < 8`. Fixed: bumped both checks to 8.

- ✅ [M] **Import-data POST missing CSRF header** — `SettingsPage.tsx:132` — `/api/import-data` calls `validateCsrf`; import silently failed with 403. Fixed.

- ✅ [M] **"Edit Profile" links to `/onboarding` instead of `/profile/edit`** — `SettingsPage.tsx:221` — Clicking "Edit Profile & Preferences" relaunched the onboarding wizard. Fixed: changed href to `/profile/edit`.

- ✅ [L] **Hardcoded app version `0.1.2`** — `SettingsPage.tsx:388` — Current version is `0.3.1.0`. Fixed.

### PROFILE — Frontend (`components/ProfileEditor.tsx`, `app/(app)/profile/edit/page.tsx`)

- ✅ [C] **All profile mutations missing CSRF header** — `ProfileEditor.tsx:95,118,136,158,170,192,205,228` — Every `fetch` call (savePatientInfo, saveConditions, addMedication, removeMedication, addDoctor, removeDoctor, addAppointment, removeAppointment) had no `x-csrf-token`. All 8 write paths were rejected by the API with 403. Fixed: added `useCsrfToken()` hook + CSRF header to all 8 calls.

- ✅ [H] **Conditions & Allergies section always blank on open** — `ProfileEditor.tsx:63-64` — State initialized to `''` instead of `profile.conditions || ''` / `profile.allergies || ''`. Users opening the section saw empty inputs and could accidentally clear existing values by hitting Save. Fixed: initialize from profile props.

- ✅ [M] **Profile edit page shows soft-deleted medications, doctors, appointments** — `profile/edit/page.tsx:18-21` — Queries had no `isNull(deletedAt)` filter. Removed records appeared in edit form. Fixed: added `and(..., isNull(deletedAt))` to all three queries.

### EMERGENCY CARD — Frontend + Backend (`components/EmergencyCard.tsx`, `app/(app)/emergency/page.tsx`)

- ✅ [H] **Emergency page ignores active profile — always shows first profile by creation date** — `emergency/page.tsx:15` — Used `WHERE userId = ? LIMIT 1` ordered by insertion. Multi-profile users see wrong profile. Fixed: replaced with `getActiveProfile(dbUser.id)` (respects `userPreferences.activeProfileId`).

- ✅ [M] **Share button clipboard fallback has no error handling** — `EmergencyCard.tsx:48-50` — `navigator.clipboard.writeText()` throws on HTTP pages and some browsers. Silent uncaught promise rejection. Fixed: wrapped in try/catch; no-op gracefully (user can screenshot).

- ✅ [M] **`navigator.share` rejection not caught (non-AbortError)** — `EmergencyCard.tsx:46-47` — If system share sheet fails (e.g., no apps installed), the promise throws. Fixed: wrapped in try/catch with AbortError exclusion; falls back to clipboard on share failure.

- ⬜ [M] **"Last updated" shows profile creation date, not last edit** — `emergency/page.tsx:37` — `careProfiles` table has no `updatedAt` column, so `createdAt` is shown as last-updated. **Schema fix required**: add `updatedAt timestamp` column with `$onUpdate(() => new Date())` trigger; run migration; update all profile PATCH routes to set it.

### DEAD CODE CLEANUP (`knip`)

- ✅ **Deleted 4 unused files** — `apps/mobile/src/components/OnboardingJourney.tsx`, `apps/mobile/src/lib/feature-flags.ts`, `apps/video/remotion.config.ts`, `apps/video/src/components/CalloutLabel.tsx` — no imports found in any package.

- ✅ **Removed 3 unused deps from `apps/mobile/package.json`** — `@babel/runtime`, `@carecompanion/utils`, `expo-web-browser` — zero code usages.

- ✅ **Removed 2 unused devDeps from root `package.json`** — `dotenv`, `tsx` — not referenced by any scripts or code.

- ✅ **Removed 4 unused `export` keywords** — `trackEvent` in `analytics.ts`, `DetailContent` in `TrialDetailPanel.tsx`, `AgentMatchOutput` in `clinicalTrialsAgent.ts`, `SUPPORTED_HOSPITALS` in `hospitals.ts` — confirmed no external importers.

- ⬜ **`careProfiles` table needs `updatedAt` column** — `schema.ts:34-60` — No timestamp tracks when a profile was last edited. Emergency card "last updated" shows creation date. Fix: add `updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date())` and run migration.

- ⬜ **`searchByEligibility` is dead code** — `apps/web/src/lib/trials/tools.ts:128` — Exported but never called since agent refactor. Safe to delete with its param types `SearchTrialsParams` / `SearchByEligibilityParams`.

- ✅ **`checkinSchema` / `CheckinInput` unused exports** — `apps/web/src/lib/checkin-validation.ts:3,11` — Removed `export` keywords; confirmed no external importers.

---

## Care Groups, Care Team & Sharing Full Audit — 2026-05-02 (preview/trials-impeccable)

Legend: ✅ Fixed | ⬜ Pending | [C] Critical | [H] High | [M] Med | [L] Low

### CARE GROUPS — Backend

- ✅ [C] **`POST /api/care-group/invite` missing CSRF validation** — `care-group/invite/route.ts` — Mutating endpoint had no `validateCsrf` call; any page could forge invite requests. Fixed: added `validateCsrf(req)` as first gate.

- ✅ [H] **`GET /api/care-group/[id]/status` no membership check** — `care-group/[id]/status/route.ts` — Any authenticated user who guessed a valid group UUID could poll and observe when new members join. Fixed: membership check added; returns 403 if caller is not in the group.

- ✅ [H] **`mobile-care-group-login` rate limit key IP-only** — `auth/mobile-care-group-login/route.ts` — Rate limiter was `{ip}` only; attacker rotates IPs to brute-force group passwords (5 attempts/IP × unlimited IPs). Fixed: changed key to `{ip}:{groupName}` — limit now per-IP per-group.

- ✅ [H] **`join/page.tsx` race condition + missing member-limit on invite joins** — `app/join/page.tsx` — Membership insert and `usedBy` update were two separate DB writes; concurrent double-tap or two tabs both pass the check and double-insert. Also, the `MAX_MEMBERS` guard only existed on password-join, not invite-join. Fixed: wrapped existing-member check + count check + insert + invite mark-as-used in a single `db.transaction`; added `MAX_MEMBERS = 10` guard with redirect to `/onboarding?error=group-full`.

### CARE GROUPS — Frontend

- ✅ [H] **`CareGroupScreen.tsx` — all POST calls missing `x-csrf-token`** — Three fetch calls (`/api/care-group`, `/api/care-group/invite` ×2) had no CSRF header; every mutation was rejected with 403. Fixed: added `getCsrfToken()` helper (cookie-parsing pattern matching `NotificationsView`, `ChatInterface`, etc.) and applied header to all three calls.

- ✅ [M] **`QRCodePanel.tsx` — `navigator.share()` unhandled `AbortError`** — `QRCodePanel.tsx` — `navigator.share()` was awaited inside `async onClick` with no catch. User cancelling the native share sheet throws `AbortError` → unhandled promise rejection. Fixed: changed to `.catch(() => {})` on the share call.

### CARE GROUPS — Tests

- ✅ **`care-group/__tests__/route.test.ts` — trivial assertions** — Tests were checking hardcoded literals (e.g. `expect(10 >= 10).toBe(true)`). Expanded to cover: whitespace-only group names, member-limit boundary, expired/revoked/used/mismatched invite detection, rate-limit key construction.

### CARE TEAM — Backend

- ✅ [H] **`POST /api/care-team/accept` non-atomic — re-acceptable invite + no duplicate-member guard** — `care-team/accept/route.ts` — Member insert and invite-status update were separate `await`s; if the status update failed, the user became a member with a still-pending invite they could accept again. Also no duplicate-member check; a second accept would surface as a cryptic 500. Fixed: added existing-membership check (returns clean success if already joined); moved invite-status update inside the same try/catch as the insert.

### CARE TEAM — Frontend

- ✅ [H] **`CareTeamView.tsx` — `acceptInvite` missing CSRF header** — `CareTeamView.tsx:109` — The accept API validates CSRF on every POST; the client's `acceptInvite` callback omitted `x-csrf-token`; every invite-accept from the email link silently failed with 403. Fixed: added `'x-csrf-token': csrfToken` matching the pattern already used by `sendInvite` and `removeMember`.

### CARE TEAM — Clean (no issues)

- `apps/web/src/app/api/care-team/route.ts` — Auth first, batch user lookup (no N+1), safe `.catch(() => [])` on parallel queries.
- `apps/web/src/app/api/care-team/invite/route.ts` — CSRF + rate limit + auth in order; self-invite, duplicate-pending-invite, and already-a-member all blocked.
- `apps/web/src/app/api/care-team/remove/route.ts` — CSRF present; owner-removal blocked; non-owner can only remove self.
- `apps/web/src/app/(app)/care-team/page.tsx` — Server component; session checked; `searchParams` awaited per Next.js 14 App Router.

### SHARING — Backend

- ✅ [C] **`POST /api/checkins/share` missing CSRF + IDOR** — `checkins/share/route.ts` — (1) No CSRF check on a mutating endpoint. (2) Any authenticated user could pass any `checkinId` and trigger push notifications to a different patient's care team — ownership was never verified. Fixed: `validateCsrf(req)` added as first gate; ownership check added via `checkinId → careProfileId → careProfiles.userId` with 403 on mismatch.

### SHARING — Frontend

- ✅ [M] **`shared/[token]/page.tsx` — missing empty state** — When a profile has no medications, labs, appointments, or overview data, the page rendered only header and footer — an empty, confusing screen. Fixed: added `hasContent` flag across all data sections; renders "No health data has been added yet" card when all empty.

### SHARING — Clean (no issues)

- `apps/web/src/app/api/share/route.ts` — CSRF + rate limit + auth in order; ownership verified; token is `randomUUID()` (122-bit entropy); 7-day expiry; audit log written.
- `apps/web/src/app/api/share/[token]/route.ts` — Public endpoint by design; rate-limited per IP; expiry enforced; no IDOR risk (opaque UUID tokens).
- `apps/web/src/app/api/share/weekly/route.ts` — Auth verified; query scoped to `userId = user.id`; clean null return when no weekly share.

### DEAD CODE CLEANUP — 2026-05-02

- ✅ **Removed `bcryptjs` from root `package.json`** — Only used in `apps/web`; already resolved through workspace node_modules.
- ✅ **Removed `expo-image-picker` from root `package.json`** — Already listed in `apps/mobile/package.json`.
- ✅ **Added 4 unlisted mobile deps to `apps/mobile/package.json`** — `@sentry/react-native ^6.3.0`, `expo-system-ui ~4.0.7`, `posthog-react-native ^3.3.3`, `react-native-shake ^5.6.0` — all imported but missing from package.json.
- ✅ **De-exported 11 unused exports** — `TimelineCard`, `trackEvent`, `events`, `signOut` (mobile), `THEME_KEY`, `shared`, `hapticAbnormalLab`, `hapticScanSuccess`, `hapticCardLand`, `signIn` (web auth.ts), `checkinSchema` — confirmed no external importers; removed `export` keyword.
- ✅ **De-exported 11 unused exported types** — `OnboardingStep`, `OnboardingState`, `EmergencyWidgetData`, `GlowShadow`, `Theme` (mobile), `CheckinInput`, `BurnoutSignal`, `MutationConfidence`, `LabResultEntry`, `PriorTreatmentLine`, `SearchTrialsParams`, `SearchByEligibilityParams` — all confirmed internal-only; removed `export` keyword.
- **KEPT (false positives)** — `babel.config.js` (Metro implicit), `babel-preset-expo` (Metro implicit), `EligibilityGap` (imported by gapAnalysis + clinicalTrialsAgent + tests), `TimelineEvent` (imported by timeline/page.tsx), `postcss-load-config` (JSDoc @type only), `.context/**` knip ignore (directory contains retro notes).

---

## Insurance, Financial, Compliance & HIPAA Full Audit — 2026-05-02 (preview/trials-impeccable)

Legend: ✅ Fixed | ⬜ Pending | [C] Critical | [H] High | [M] Med | [L] Low

### FIXED — CRITICAL

- ✅ [C] **`delete-account` wrong WHERE clause — accounts never actually deleted** — `app/api/delete-account/route.ts:32` — `eq(users.providerSub, user.id)` compared providerSub (Cognito sub text) against DB primary key UUID; for credential-based users providerSub is null so delete was a no-op. PHI retained indefinitely after "deletion". Fixed: changed to `eq(users.id, user.id)`.

- ✅ [C] **`delete-account` audit log written before DB delete** — `app/api/delete-account/route.ts` — Failed delete logged as success in audit trail. Fixed: moved `logAudit` to after `db.delete` succeeds.

- ✅ [C] **Audit log retention 1 year — HIPAA requires 6 years** — `app/api/cron/retention/route.ts:40` — Purging audit logs after 365 days violates HIPAA 45 CFR §164.530(j). Fixed: changed to `365 * 6` days; updated retention_policy response + comment.

- ✅ [C] **Stored XSS in PDF export — all DB PHI interpolated into HTML unescaped** — `app/api/export/pdf/route.ts` — `profile.patientName`, conditions, allergies, med names, lab values, etc. all interpolated raw into HTML template string. Any `<script>` tag in DB fields executes when user opens the export. Fixed: added `escapeHtml()` helper, applied to all DB-sourced values.

- ✅ [C] **`AppealGenerator` missing CSRF token — all appeals returned 403** — `components/AppealGenerator.tsx:40-44` — `fetch('/api/insurance/appeal')` had no `x-csrf-token` header; backend validates CSRF and rejected every request. Fixed: added `useCsrfToken()` hook, header, and dep array entry.

### FIXED — HIGH

- ✅ [H] **Soft-deleted claims shown in Insurance view** — `app/(app)/insurance/page.tsx:25` — No `isNull(claims.deletedAt)` filter. Deleted claims appeared in claim list, count, and stats. Fixed.

- ✅ [H] **Soft-deleted claims included in PDF export** — `app/api/export/pdf/route.ts:63` — Same missing filter. Fixed.

- ✅ [H] **`claim_id` not validated as UUID in appeal route** — `app/api/insurance/appeal/route.ts:39` — Raw string accepted with no format check; reached DB query directly. Fixed: added `z.string().uuid()` via Zod bodySchema.

- ✅ [H] **`additional_context` unbounded — prompt injection risk** — `app/api/insurance/appeal/route.ts:83` — Interpolated directly into AI prompt with no length limit; attacker could hijack LLM output or inflate API costs. Fixed: `z.string().max(2000)`.

- ✅ [H] **Negative monetary values accepted in insurance upload** — `app/api/upload/insurance/route.ts:14-17` — No `.nonnegative()` on `deductible_limit`, `deductible_used`, `oop_limit`, `oop_used`. Fixed.

- ✅ [H] **Claim `status` accepted any string** — `app/api/save-scan-results/route.ts:44` — `z.string().optional()` allowed `"APPROVED"`, `"REJECTED"` etc. which break filter tabs and sorting. Fixed: `z.enum(['paid','pending','denied','in_review'])`.

- ✅ [H] **Insurance scan always INSERT — duplicate rows on every re-scan** — `app/api/save-scan-results/route.ts:128-138` — Unconditional insert; re-scanning same card created multiple rows; insurance page always showed first (oldest). Fixed: upsert — check for existing row, update if found.

- ✅ [H] **Compliance tracker `worst_time` stored full ISO timestamp** — `lib/compliance-tracker.ts:96` — Stored `"2026-05-02T14:30:00.000Z"` but `formatTime24()` expected `"14:30"`. Rendered as `"NaN:05 AM"`. Fixed: `.substring(11, 16)`.

- ✅ [H] **CSV export had no audit log and no rate limiting** — `app/api/export/csv/route.ts` — PHI exported with no record, no throttle. Fixed: added `logAudit` + `rateLimit({ maxRequests: 5 })`.

- ✅ [H] **Audit log pagination `offset` not validated** — `app/api/compliance/audit-log/route.ts:25` — `parseInt('abc')` → NaN → Postgres OFFSET null → full table dump. Fixed: `Math.max(0, parseInt(...) || 0)`.

### FIXED — MEDIUM / LOW

- ✅ [M] **`eobUrl` rendered as raw `href` — `javascript:` URI risk** — `components/InsuranceView.tsx:367` — Stored URL used directly without scheme validation. Fixed: `startsWith('https://')` guard; non-https renders nothing.

- ✅ [M] **Share URL hardcoded to `https://carecompanionai.org`** — `app/api/share/route.ts:111` — Broken in staging/dev. Fixed: `process.env.NEXT_PUBLIC_APP_URL || 'https://carecompanionai.org'`.

- ✅ [M] **Compliance report/calendar access not audited** — `app/api/compliance/report/route.ts`, `calendar/route.ts` — PHI-derived adherence data accessed with no audit trail. Fixed: added `logAudit` to both.

- ✅ [M] **Consent acceptance not audited** — `app/api/consent/accept/route.ts` — Only `console.log`'d. Fixed: `logAudit('hipaa_consent_accepted')` with version in details.

- ✅ [M] **`console.error` in audit-log route instead of structured logger** — Fixed: `logger.error`.

- ✅ [M] **`parseFloat` on claim amounts produces NaN in AnalyticsDashboard totals** — `components/AnalyticsDashboard.tsx:66-68` — Non-numeric billedAmount strings silently NaN'd the total. Fixed: `(parseFloat(x ?? '0') || 0)`.

### OPEN — ARCHITECTURAL (requires design decisions)

- ⬜ [C] **HIPAA consent gate not enforced in API routes** — `lib/api-helpers.ts` — `getAuthenticatedUser()` never checks `hipaaConsent`; direct `/api/*` calls and mobile Bearer-token path bypass the consent gate entirely. **Fix needed:** add consent check to `getAuthenticatedUser()` or new `getAuthenticatedAndConsentedUser()` returning 403 when `hipaaConsent !== true`.

- ⬜ [C] **30+ PHI-serving API routes have no audit log entries** — HIPAA violation. Routes with zero audit: `api/records/medications`, `api/records/labs`, `api/records/appointments`, `api/records/doctors`, `api/records/profile`, `api/care-hub`, `api/care-profiles/**`, `api/timeline`, `api/search`, `api/triage`, `api/visit-prep`, `api/labs/trends`, `api/journal`, `api/checkins`, `api/documents/**`, `api/interactions/check`, `api/upload/allergies`, `api/import-data`, `api/import-medications`, `api/share/[token]`. **Fix needed:** middleware logging all PHI-path requests, or `logAudit` in each handler.

- ⬜ [C] **Public share token serves PHI with no audit log and no recipient ID** — `app/api/share/[token]/route.ts` — Full PHI (meds, labs, care plan) delivered to bearer of token with no record of who, when, or from where. **Fix needed:** `logAudit` on every access; record token + IP + timestamp.

- ⬜ [H] **`/api/chat` POST has no CSRF protection** — `app/api/chat/route.ts` — Chat triggers `save_insurance`, `estimate_cost`, and other mutating tools but has no `validateCsrf`. Cross-site form POST could trigger mutations on behalf of a logged-in victim.

- ⬜ [H] **`/api/health-summary` POST has no CSRF protection** — `app/api/health-summary/route.ts` — Same pattern.

- ⬜ [H] **`export-data` JSON export omits FSA/HSA, insurance, and priorAuths** — `app/api/export-data/route.ts` — HIPAA data portability export is incomplete. These tables contain PHI.

### OPEN — MEDIUM / LOW

- ⬜ [M] **Prior authorizations have no UI or CRUD API** — `lib/db/schema.ts:182-193` — `priorAuths` table exists and is included in AI context but users can't view/add/edit/delete. Only accessible via chat.

- ⬜ [M] **Appeal rate limit keyed by IP — spoofable** — `app/api/insurance/appeal/route.ts:31` — `x-forwarded-for` is attacker-controlled. Should use authenticated user ID as rate limit key.

- ⬜ [M] **FSA/HSA balance injected as raw numeric string** — `lib/system-prompt.ts:364` — `$150.0000000000` sent to LLM. Fix: `parseFloat(a.balance).toFixed(2)`.

- ⬜ [M] **Multiple insurance plans not displayed** — `app/(app)/insurance/page.tsx` — Upload allows `is_additional=true` but UI only shows first row. Additional plans silently ignored.

- ⬜ [M] **`plan_type` accepted in upload/insurance but silently dropped** — `app/api/upload/insurance/route.ts` — Parsed by Zod, never mapped to DB column. Either add the column or remove from schema.

- ⬜ [M] **Consent page doesn't redirect already-consented users** — `app/consent/page.tsx` — Re-accepting updates `hipaaConsentAt` timestamp, creating misleading consent records.

- ✅ [L] **`claims.userId` has no DB index** — `lib/db/schema.ts` — Full table scan on every insurance page load. Add `index('claims_user_id_idx').on(table.userId)`.

- ✅ [L] **`fsaHsa.accountType` unconstrained text** — Notification logic `=== 'fsa'` silently misses `'FSA'`. Enforce `z.enum(['fsa','hsa'])` at API layer.

- ✅ [L] **`logAudit` is fire-and-forget — audit failures not alerted** — `lib/audit.ts:44` — PHI access can proceed with broken audit trail. Wire logger.error to error tracking.

---

## Community Forum & Sharing Links Full Audit — 2026-05-03 (preview/trials-impeccable)

Legend: ✅ Fixed | ⬜ Pending | [C] Critical | [H] High | [M] Med | [L] Low

### COMMUNITY BACKEND — `app/api/community/`

- ✅ [C] **Reply POST bare `.returning()` leaked `userId` + `postId` to caller** — `community/[id]/route.ts` — `.returning()` with no column projection returned every column including `userId`. Server returned the poster's own userId on every reply. Fixed: explicit column projection (`id`, `cancerType`, `authorRole`, `body`, `upvotes`, `createdAt` only).

- ✅ [H] **No rate limiting on POST (create post)** — `community/route.ts` — Any authenticated user could flood the forum with unlimited posts. Fixed: `rateLimit({ interval: 60_000, maxRequests: 5 })` keyed on `user.id`.

- ✅ [H] **No rate limiting on POST (create reply)** — `community/[id]/route.ts` — Same gap for replies. Fixed: `rateLimit({ interval: 60_000, maxRequests: 10 })` keyed on `user.id`.

- ✅ [H] **No rate limiting on POST (upvote toggle)** — `community/[id]/upvote/route.ts` — Machine-speed toggle possible. Fixed: `rateLimit({ interval: 60_000, maxRequests: 30 })` keyed on `user.id`.

- ✅ [H] **No DELETE handler — users cannot retract posts** — Cancer patients/caregivers sharing sensitive medical details had no way to remove posts. Fixed: added `DELETE /api/community/[id]` with auth + UUID validation + ownership check + cascade delete.

- ✅ [H] **`communityUpvotes` missing unique DB constraint (race-condition double-upvote)** — `schema.ts:480-486` — Application-level SELECT-then-INSERT was not atomic; two concurrent requests could both pass the existence check and double-insert. Fixed: added `uniqueIndex('community_upvotes_user_target_unique').on(t.userId, t.targetId, t.targetType)` to schema.

- ✅ [M] **`cancerType` not validated against enum in POST body** — `community/route.ts` — `z.string().min(1)` accepted any string. Fixed: added `.refine(v => CANCER_TYPES.includes(v))` to `createPostSchema`.

- ✅ [M] **`cancerType` GET filter param not validated against allowlist** — `community/route.ts` — Arbitrary strings passed to DB WHERE clause. Fixed: added guard returning 400 for unknown `cancerType` values.

- ✅ [M] **`offset` param not guarded against NaN/negative** — Both community routes. Fixed: `Math.max(0, parseInt(...) || 0)`.

- ✅ [M] **`request.json()` parse failure produced 500 instead of 400** — Fixed in both `community/route.ts` and `community/[id]/route.ts`: wrapped in try/catch, returns `apiError('Invalid request body', 400)`.

- ✅ [M] **`replyCount` increment ran outside transaction** — `community/[id]/route.ts` — If the increment failed after a successful insert, replyCount drifts. Fixed: wrapped insert + increment in `db.transaction()`.

- ✅ [M] **UUID not validated on `id` URL param** — `community/[id]/route.ts` and `upvote/route.ts` — Non-UUID caused DB error → 500 instead of 400. Fixed: `z.string().uuid()` check returns 400 on invalid format.

- ✅ [M] **Upvote did not verify target exists or is not moderated** — `community/[id]/upvote/route.ts` — Could upvote moderated (hidden) posts and phantom reply IDs. Fixed: pre-transaction existence + `isModerated=false` check for both post and reply targets.

- ✅ [M] **`createdAt` missing `.notNull()` on community tables** — `schema.ts:465,477` — Could produce null timestamps → `new Date(null)` crash in frontend. Fixed: added `.notNull()` to `communityPosts.createdAt` and `communityReplies.createdAt`.

- ⬜ [H] **No HTML/content sanitization on post/reply bodies** — No sanitization library (`sanitize-html`, `DOMPurify`, etc.) is called before storing or returning community content. A markdown renderer added in future would be vulnerable to stored XSS. **Fix needed:** install `sanitize-html` and strip HTML from `title` and `body` before DB insert in both community routes.

- ⬜ [H] **No report/flag mechanism** — Users cannot flag harmful content. `isModerated` column exists but is set via direct DB only. **Fix needed:** (1) add `communityReports` table with `(postId|replyId, reportedByUserId, reason, createdAt)`; (2) add `POST /api/community/[id]/report` endpoint; (3) auto-hide at report threshold or admin review.

- ⬜ [M] **No admin moderation API** — `isModerated` flag cannot be set via any API endpoint. **Fix needed:** add `POST /api/admin/community/[id]/moderate` gated by admin role/email check.

- ⬜ [M] **`authorRole` is client-controlled** — `community/route.ts:74` — Post body can claim `authorRole: 'patient'` regardless of actual user role. A caregiver can post as "Breast Cancer Patient". **Fix needed:** resolve `authorRole` server-side from care profile instead of trusting request body.

- ⬜ [M] **Reply `authorRole` defaults to `'caregiver'` regardless of actual user role** — `community/[id]/route.ts` — Reply author labels always show "Caregiver". Same fix as above.

- ✅ [L] **Replies capped at 100 with no pagination indicator** — `community/[id]/route.ts` — Posts with >100 replies silently drop older ones. **Fix needed:** return total reply count and support offset-based pagination.

### COMMUNITY FRONTEND — `app/(app)/community/`

- ✅ [M] **No error state on list fetch failure** — `community/page.tsx` — Fetch failure left posts array empty with no message. Fixed: added `error` state with inline banner and retry.

- ✅ [M] **No CSRF token on POST (create post)** — `community/page.tsx` — Backend validates CSRF but client omitted header. Fixed: reads `csrf-token` cookie and sends `X-CSRF-Token` header.

- ✅ [M] **POST submit failure silently swallowed** — `community/page.tsx` — Modal stayed open with no feedback. Fixed: added `submitError` state rendered inside the modal.

- ✅ [M] **No error state on detail page load failure** — `community/[id]/page.tsx` — Returned `null` on failure → blank page. Fixed: added `loadError` state with error UI and "Go back" link.

- ✅ [M] **No CSRF token on upvote or reply POST** — `community/[id]/page.tsx` — Both mutations omitted CSRF header. Fixed.

- ✅ [M] **Reply submit failure silently swallowed** — `community/[id]/page.tsx` — Fixed: added `replyError` state with inline message.

- ✅ [M] **Client-side length validation didn't match backend Zod schema** — Both pages. Fixed: enforced `title min 5 / max 200`, `body min 10 / max 2000`, `reply min 5 / max 1000` with inline error messages.

- ✅ [M] **Optimistic upvote not reverted on failure** — `community/[id]/page.tsx` — Fixed: snapshot `prevPost` before update, restore in catch.

- ✅ [L] **No pagination — only first 20 posts shown** — `community/page.tsx` — Fixed: added offset-based "Load more" button that appends results; hidden when fewer than page-limit returned.

### SHARING LINKS — Schema

- ✅ **Added `revokedAt` column to `sharedLinks` table** — `schema.ts:397` — Foundation for link revocation. Drizzle schema updated; run migration to apply.

### SHARING LINKS — Backend

- ✅ [H] **No link revocation mechanism** — Users could not cancel a mistaken share of PHI (cancer stage, medications, allergies, doctor contacts) before 7-day expiry. Fixed: (1) added `revokedAt` to schema; (2) created `POST /api/share/[token]/revoke` — auth + ownership check + sets `revokedAt`; (3) access check in `[token]/route.ts` now returns 410 Gone if `revokedAt` is set; (4) public page renders "Link Revoked" UI; (5) `GET /api/share` returns list of active non-revoked links.

- ✅ [H] **`db.select()` fetched all columns including `userId`/`careProfileId` on public endpoint** — `share/[token]/route.ts` — Any expansion of the handler would have leaked owner identity. Fixed: explicit projection (`title`, `type`, `data`, `createdAt`, `expiresAt`, `revokedAt`, `viewCount` only).

- ✅ [M] **`x-forwarded-for` not split on POST create route** — `share/route.ts` — Full comma-chain value used as rate limit key; same IP with different proxy chains got separate buckets. Fixed: `split(',')[0].trim()`.

- ✅ [M] **No per-user rate limit on share creation** — `share/route.ts` — IP-only limit allowed 20 links/minute per IP. Fixed: added `userShareLimiter` keyed on `user.id` (5/min).

- ✅ [M] **Raw `token` returned in POST response alongside URL** — `share/route.ts` — Token appeared twice; removed from response body (URL contains it).

- ✅ [M] **`uniqueTokenPerInterval` missing on public token rate limiter** — `share/[token]/route.ts` — Added `uniqueTokenPerInterval: 500` to match POST route.

- ✅ [M] **Weekly share URL was relative path** — `share/weekly/route.ts` — `/shared/${token}` would break in email notifications. Fixed: uses `NEXT_PUBLIC_APP_URL` base.

- ✅ [L] **Medications query in `buildShareData` had no limit** — `share/route.ts` — Patients with many medications produced very large share payloads. Fixed: added `.limit(50)`.

- ✅ [M] **Doctor phone numbers exposed publicly on share page** — `share/[token]/page.tsx:411-428` — `buildShareData` includes `phone: d.phone` for care team; phone numbers are rendered on the public page with no auth. **Decision needed:** either omit `phone` from public share payloads or add an explicit user acknowledgment before sharing.

- ✅ [M] **`/api/share/` middleware public path is broader than intended** — `middleware.ts:34` — All routes under `/api/share/` bypass middleware auth, relying on handler-level auth. Comment added to document this. **Consider:** rename public token route to `/api/shared/[token]` to separate it from the authenticated `/api/share` family.

### SHARING LINKS — Frontend / Public Page

- ✅ [H] **No loading state on public shared page** — `shared/[token]/page.tsx` — Blank screen during server DB fetch. Fixed: added `loading.tsx` with animated-pulse skeleton.

- ✅ [H] **`db.select()` on page fetched `userId`/`careProfileId` (present in RSC stream)** — `shared/[token]/page.tsx` — Fixed: explicit column projection excluding PII fields.

- ✅ [M] **No revoked-link UI** — `shared/[token]/page.tsx` — Fixed: renders "Link Revoked" state matching the expired-link styling.

- ✅ [M] **`weekly_summary` data cast unsafely** — `shared/[token]/page.tsx:276` — `link.data as WeeklyData` with no runtime check. Fixed: added `typeof link.data !== 'object'` guard with error UI fallback.

- ✅ [M] **Clipboard `writeText` had no error handling in ShareHealthCard** — `components/ShareHealthCard.tsx:34` — Throws on non-HTTPS or permission-denied. Fixed: try/catch with `setError('Could not copy — please copy the link manually.')`.

- ✅ [M] **ShareHealthCard created new link on every click with no dedup** — `components/ShareHealthCard.tsx` — Users accumulated many active links for the same data. Fixed: `useEffect` on mount calls `GET /api/share` and reuses existing active link if found; `handleShare` skips create if `existingLink` is set.

- ✅ [L] **No error boundary on shared page** — Fixed: created `shared/[token]/error.tsx` with "Something went wrong" UI and retry button.

- ✅ [L] **No confirmation/disclosure before generating share link** — `components/ShareHealthCard.tsx` — Disclosure note added listing what will be shared, but no confirmation modal for misclicks. Consider a "Are you sure?" gate for first share.

- ✅ [L] **No active share links management page** — Users can see active links via `GET /api/share` (now exists) and revoke via the new endpoint, but there is no dedicated settings UI showing all active links with revoke buttons. **Fix needed:** add "Active share links" section to Settings or ShareHealthCard.

---

## Cron Jobs, Production Monitor & Admin Routes Audit — 2026-05-03 (preview/trials-impeccable)

Legend: ✅ Fixed | ⬜ Pending | [C] Critical | [H] High | [M] Med | [L] Low

**Scope:** All 9 cron routes, `/api/health`, `/api/e2e/signin`, `/api/test/reset`, `/api/demo/start`, `/api/admin/provision-reviewer`, `/api/notifications/generate`, `/api/reminders/check`.

### FIXED — CRITICAL / HIGH

- ✅ [C] **`/api/health` leaks full diagnostic details when `CRON_SECRET` not set** — `health/route.ts:105` — `isAuthed = !cronSecret || ...` means any caller gets full DB column names, env var presence, memory usage when `CRON_SECRET` is unset. In production, an accidental missing secret would expose the entire check payload publicly. Fixed: in production, both `cronSecret` must be set AND must match — `isProd ? (!!cronSecret && auth === Bearer ${secret}) : (!cronSecret || auth === Bearer ${secret})`. Dev behavior unchanged.

- ✅ [C] **`/api/health` schema check used `sql.raw()` on table names** — `health/route.ts:59` — `sql.raw(tableNames.map(t => \`'${t}'\`).join(','))` interpolated strings directly into raw SQL. Table names are hardcoded so not directly exploitable, but the pattern is unsafe; any future change making `tableNames` dynamic would create an injection vector. Fixed: replaced with parameterized `${tableNames}` array binding.

- ✅ [H] **`/api/test/reset` environment guard used `NEXT_PUBLIC_TEST_MODE`** — `test/reset/route.ts:28` — `NEXT_PUBLIC_*` variables are bundled into the client-side JavaScript; every visitor can inspect the value. If `NEXT_PUBLIC_TEST_MODE=true` in a production deployment, the guard is bypassed for any authenticated `@test.carecompanionai.org` account. Fixed: changed to server-only `TEST_MODE` env var. **ACTION REQUIRED:** rename env var in Vercel dashboard from `NEXT_PUBLIC_TEST_MODE` to `TEST_MODE`.

- ✅ [H] **`/api/e2e/signin` GET liveness probe required no auth** — `e2e/signin/route.ts:29` — `GET /api/e2e/signin` returned `{ready:true, v:19}` with zero authentication. Any external scanner could confirm this endpoint exists in production, enabling targeted session-minting attacks. Fixed: GET now requires same `x-e2e-secret` header as POST; returns 401 without it. CI scripts that hit the GET probe must add the header.

- ✅ [H] **`/api/cron/weekly-summary` had no limit on profiles query** — `cron/weekly-summary/route.ts:49` — `db.select().from(careProfiles).where(onboardingCompleted=true)` with no `.limit()` loaded every user. Cron fans out a Claude call per user; at scale (1 000+ users) this would exhaust the 300s `maxDuration`, cause OOM, and flood Anthropic with concurrent requests. Fixed: added `.limit(200)`. **TODO:** implement cursor-based pagination like `trials-status` for full coverage at scale.

- ✅ [H] **`/api/cron/trials-match` enqueued all profiles including incomplete onboarding** — `cron/trials-match/route.ts:37` — `db.select().from(careProfiles).limit(500)` with no `onboardingCompleted` filter. Incomplete profiles have no cancer type, stage, or treatment data; the matching agent sends empty/garbage prompts to Claude for them, wasting budget and polluting `matchingQueue`. Fixed: added `.where(eq(careProfiles.onboardingCompleted, true))`.

### OPEN — MEDIUM

- ✅ [M] **`/api/cron/weekly-summary` needs cursor pagination for full coverage** — `cron/weekly-summary/route.ts:49` — The new `.limit(200)` prevents OOM but users beyond the first 200 never get weekly summaries. The query has no ORDER BY so which 200 users are processed is non-deterministic. **Fix needed:** implement cursor approach like `trials-status` using a `weekly_summary_cursor` key in `cronState` table; process next 200 on each run; reset cursor to NULL_CURSOR when exhausted.

- ✅ [M] **`/api/cron/trials-match` gap-closure errors are fully silent** — `cron/trials-match/route.ts:97` — `catch { /* skip profile, continue */ }` swallows all LLM errors with no log. A misconfigured Anthropic key or model error silently skips all gap-closure for all profiles every night with no observable signal. **Fix needed:** `console.error('[trials-match] gap-closure failed', profileId, err)` minimum; ideally `logger.error`.

- ✅ [M] **`/api/cron/trials-match` gap-closure `output?.resolved` not guarded** — `cron/trials-match/route.ts:82` — `for (const nctId of output.resolved)` throws if `output.resolved` is undefined (malformed LLM response). Currently caught by profile-level catch but masks the real error. **Fix needed:** `for (const nctId of output?.resolved ?? [])`.

- ✅ [M] **`/api/cron/radar` caregiver-awareness loop is N+1** — `cron/radar/route.ts:323-350` — For each profile, queries `careTeamMembers`, then for each member queries `careTeamActivityLog` individually. With 20 profiles × N care team members this is many sequential DB calls inside a 300s function. **Fix needed:** batch-fetch activity status for all member+profile combos in one query before the per-profile loop, similar to how `allPushSubs` is pre-fetched.

- ✅ [M] **`/api/admin/provision-reviewer` returns generated password in response body** — `admin/provision-reviewer/route.ts:187` — `temporaryPassword: generatedPassword` is returned in the JSON response on account creation. The comment says "store securely — it cannot be recovered after this call." If this endpoint is ever called over an insecure channel or the response is logged, the password is exposed. **Consider:** log it server-side via `console.log` (goes to Vercel log only) and return `password: '[see server logs]'` in the response body.

### OPEN — LOW / NOTES

- ✅ [L] **`/api/e2e/signin` lacks `NODE_ENV` guard** — `e2e/signin/route.ts` — Unlike `/api/test/reset` which checks `NODE_ENV !== 'production'`, the e2e endpoint has no environment gate. It relies entirely on `E2E_AUTH_SECRET` being absent in prod to disable itself. If the secret is set in prod (required for CI against prod), the endpoint is live in prod by design. The security model is documented in the file header and acceptable, but worth auditing that `E2E_AUTH_SECRET` rotation is in the ops runbook.

- ✅ [L] **`/api/cron/sync` is a stub but still scheduled** — `cron/sync/route.ts` — Placeholder that always returns `{synced: 0}`. Still fires daily via Vercel cron (burns a cron invocation). Safe to leave; remove from `vercel.json` crons when confirmed unused.

- ✅ [L] **`/api/notifications/generate` and `/api/reminders/check` accept POST in addition to GET** — Both routes expose `POST` that calls `GET(req)` directly. Cron auth applies to both. Low risk but the POST methods exist without documentation — unclear if any caller uses them. Remove POST handlers if unused.

### CLEAN — No Issues Found

- `/api/cron/purge` — `verifyCronRequest` auth first; `purgeExpiredRecords` scoped to records with `deletedAt < 30 days ago`; no user-controlled input; error caught and returned as 500.
- `/api/cron/retention` — HIPAA-correct 90-day PHI + 6-year audit log retention; auth first; parallel deletes correct.
- `/api/cron/trials-status` — cursor-based pagination prevents OOM; 24h notification dedup correct; AT.gov errors isolated per-row.
- `/api/seed-demo` — requires auth + CSRF + `@test.carecompanionai.org` email; deletes only records tagged `notes='Demo data'` (scoped delete, not full wipe).
- `/api/demo/start` — rate-limited (10/min/IP); inserts with `isDemo=true` flag; session minted correctly with `maxAge=1h`; Cognito not required by design.
- `/lib/cron-auth.ts` — correct: dev bypasses only when `CRON_SECRET` unset; prod requires both presence and match; returns 500 (not 401) when secret missing in prod to distinguish misconfiguration from unauthorized access.
- `/lib/soft-delete.ts` — `purgeExpiredRecords` uses parameterized Drizzle queries; ownership enforced in `softDelete`/`restore` by userId/profileId; no user-controlled SQL.

---

## Auth Flow Review — 2026-05-03 (eng + design review)

Branch: preview/trials-impeccable
Reviewed: LoginForm, SignupForm, ResetRequestForm, ResetConfirmForm, RoleSelector, OnboardingShell, login/signup/reset-password pages

### SHIPPED — fixes applied this session ✅

- ✅ **[DX] Shared `AuthPageBackground` component** — auth page background HTML (glow orbs, dot grid, vignette) was duplicated verbatim across login/signup/reset-password pages. Extracted to `AuthPageBackground.tsx`. All 3 pages now import it.
- ✅ **[A11Y] `tabIndex={-1}` on password show/hide buttons** — keyboard users couldn't toggle password visibility; the button was skipped in tab order. Changed to `tabIndex={0}` in LoginForm, SignupForm, ResetConfirmForm.
- ✅ **[A11Y] Missing `role="alert"` + `aria-live` on reset form states** — ResetRequestForm and ResetConfirmForm had no ARIA announcements on error or success. Screen readers were silent. Added `role="alert" aria-live="polite"` to all error and success state divs. Added `aria-hidden="true"` to all decorative icons.
- ✅ **[A11Y] Error moved above submit button in LoginForm** — error was rendered below trust badges, forcing scroll to see it. Moved above submit button so it's visible without scrolling.
- ✅ **[COPY] 🤒 emoji removed from Patient role** — `RoleSelector.tsx` — using a sick-face emoji for cancer patients is inappropriate and unkind. Changed to 💙. Self-care changed from 👤 to 🌟.
- ✅ **[COPY] Role descriptions warmed up** — "Helping someone I love" → "Caring for someone I love", "Managing my own care, with a caregiver" → "Getting support from a loved one", "Managing my own care independently" → "Managing my care on my own".
- ✅ **[COPY] Cold page headlines replaced** — login page h1 "CareCompanion" → "Welcome back", subtitle "AI-powered cancer care for patients & caregivers" → "We're here whenever you need us." Signup h1 → "You're in good hands", subtitle → "Let's set up your account — it only takes a minute." Reset page h1 → "Forgot your password?", subtitle → "No problem — we'll send a reset link right away."
- ✅ **[COPY] Error messages warmed up** — "Invalid email or password. Please try again." → "That doesn't look right — please check your email and password." Care Group error → "We couldn't find that Care Group — double-check the name and password." Server errors warmed throughout.
- ✅ **[COPY] Reset success copy warmed** — ResetRequest sent state: added "Check your spam folder too." subtext. ResetConfirm success: "You're all set! Your password has been updated. Sign in to continue where you left off."
- ✅ **[UX] Spinner added to ResetRequestForm and ResetConfirmForm** — both forms showed only "Sending…" / "Resetting…" text during loading; now show animated spinner matching LoginForm/SignupForm.
- ✅ **[UX] Success state animations** — ResetRequestForm and ResetConfirmForm success screens snap-replaced with no animation. Added `loginFadeUp 0.4s ease both` on success card render.
- ✅ **[UX] Social login (Apple + Google) added to SignupForm** — LoginForm had Apple/Google buttons; SignupForm had email-only. Users on the signup page had no way to discover OAuth options. Added both buttons above the form with callbackUrl → `/onboarding`.
- ✅ **[UX] Error icon + support link parity in SignupForm** — LoginForm error showed icon + "Having trouble? Contact support" link. SignupForm had icon but no support link. Now consistent.
- ✅ **[DX] RoleSelector inline `<style>` tag removed** — responsive grid was implemented via a `<style>` tag with a media query. Replaced with Tailwind responsive classes.
- ✅ **[LINT] Unused `trialB` variable removed** — `clinicalTrialsAgent.test.ts:32`.

### OPEN — HIGH

- [ ] **[DRY] Extract FloatingInput + PasswordInput to shared component** — `LoginForm.tsx`, `SignupForm.tsx`, `ResetRequestForm.tsx`, `ResetConfirmForm.tsx` all contain identical copy-paste of `FloatingInput` and `PasswordInput`. Any change to label animation, focus ring, or placeholder must be made 4 times. Extract to `@/components/ui/FloatingInput.tsx` and `@/components/ui/PasswordInput.tsx`. **Why:** next time floating label behavior needs to change (e.g. for new form), it will be done incorrectly in at least one copy. **Start:** copy from LoginForm, replace all 4 imports, run lint.

- [ ] **[DRY] Extract shared `FormError` component** — Error display (icon + red message + optional support link) is copy-pasted across all 4 forms with slight inconsistencies. Extract to `@/components/ui/FormError.tsx`. **Props:** `message: string`, `showSupport?: boolean`. **Why:** ensures ARIA attributes, icon, and support link are always present and consistent.

- [ ] **[A11Y] Floating label contrast at `rgba(255,255,255,0.3)` fails WCAG AA** — inactive label is ~3:1 on `#05060F` background. WCAG 2.1 AA requires 4.5:1 for normal text. Bump to at least `rgba(255,255,255,0.5)` for inactive state. **Affects:** FloatingInput in all 4 auth forms.

### OPEN — MEDIUM

- [ ] **[UX] "Resend reset email" CTA on password reset sent screen** — ResetRequestForm success state has no way for the user to re-trigger the email if they didn't receive it. Add a "Resend email" button with a 60s cooldown. **Why:** cancer patients may be on mobile with unreliable email delivery; they'll hit Back and try again repeatedly otherwise, each attempt silently creating a new token.

- [ ] **[UX] Role collection for social (OAuth) signup** — When a new user signs up via Apple/Google, they hit `/onboarding` without a `role` set on their user record. `OnboardingShell` derives role from `userRoleProp` (null for OAuth users) and falls back to relationship — also null for brand-new users. The Care Group screen renders with `careGroupRole = 'patient'` as a hardcoded fallback. Add a role-selection step for new OAuth users before the Care Group screen. **Blocked by:** requires a small `set-role` API endpoint or inline wizard step.

- [ ] **[UX] Progress indicator on onboarding wizard** — `OnboardingShell` moves through phases (care-group → wizard → complete) with no visual indication of where the user is. For patients/caregivers who are anxious about setup time, a simple "Step 1 of 3" or progress bar reduces abandonment. **Depends on:** knowledge of total wizard steps from `OnboardingWizard`.

- [ ] **[UX] `window.location.href` in OnboardingShell should be documented** — `OnboardingShell.tsx:167` uses hard navigation to `/dashboard` on completion. This is intentional (full session refresh needed post-onboarding) but looks like a bug to a future reader. Add a one-line comment: `// Full reload to flush session state after onboarding`.

### OPEN — LOW

- [ ] **[COPY] Signup consent checkbox copy could be warmer** — "I agree to the Terms and Privacy Policy, and I understand CareCompanion will access and process my health information to provide the service." The second clause ("access and process") sounds clinical/legal. Consider: "…and I'm comfortable with CareCompanion storing my health information to provide personalized support."

- [ ] **[COPY] Care Group tab inputs lack `required` attribute** — `LoginForm.tsx:242-261` — group name and group password inputs have no `required` attribute. Client-side validation fires nothing when submitted empty; the server returns a generic credential error. Add `required` to both inputs for immediate feedback.

- [ ] **[A11Y] `RoleSelector` error message needs `role="alert"`** — `RoleSelector.tsx:92` — `<p className="mt-1 text-xs text-red-400">{error}</p>` has no ARIA role. Screen readers won't announce "Please select your role to continue" when it appears. Add `role="alert"`.

- [ ] **[DESIGN] Password strength labels feel clinical** — "Weak / Fair / Good / Strong" is neutral but cold for a cancer care app. Consider: "Keep going… / Almost there / Looking good / Strong ✓". Low priority — password strength is a functional concern, but the micro-copy still touches the user experience.
