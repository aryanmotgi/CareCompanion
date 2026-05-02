fx# CareCompanion TODO

Generated from: /plan-eng-review + /design-review + /qa  
Branch: preview/trials-impeccable  
Date: 2026-05-02

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
- ⬜ [L] `refill_date` schema column is `text` not `date` type — schema.ts:91

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
- ⬜ [L] Chat prompt sends lab value without unit — LabTrends.tsx:297-300

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
- ⬜ [L] Ambiguous JSON shape double-fallback — RefillStatus.tsx:118
- ⬜ [L] No "last updated" timestamp on refill card

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
- ⬜ [L] Conditions not trimmed/deduped after extraction — CategoryUploadCard.tsx:44-45
- ⬜ [L] Insurance "Unknown" provider fallback silently saved — CategoryUploadCard.tsx:124

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
- ⬜ [L] **TrialsTab: cancerStage, patientAge, patientName props unused** — `TrialsTab.tsx:37` — Props accepted but never destructured or used inside the component. Fix: either wire them into display hints or remove from Props type.

### BACKEND — SECURITY

- ✅ [H] **No NCT ID validation in 4 API endpoints** — `save/route.ts`, `saved/[nctId]/route.ts`, `[nctId]/route.ts`, `[nctId]/detail/route.ts` — `nctId` accepted as any string; passed directly to CT.gov API and DB queries. Fixed: `/^NCT\d{4,}$/` regex check, returns 400 for invalid IDs.
- ⬜ [M] **LLM prompt injection surface** — `clinicalTrialsAgent.ts:62` — CT.gov trial data embedded raw into Claude prompt via `JSON.stringify`. CT.gov is trusted, but adversarially-crafted trial records could inject instructions. Fix: add system-prompt-level instruction to ignore embedded directives; strip known injection patterns from trial text before embedding.
- ⬜ [L] **`/api/trials/matches` category param unvalidated** — `matches/route.ts:14` — `category` query param used in where-clause condition with no enum check. Falls through to "all" for unknown values — functionally OK but leaks query structure in logs. Fix: validate against `['matched', 'close', 'all']` or ignore unknown values explicitly.

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
- ⬜ [L] **searchByEligibility is dead code** — `tools.ts:128` — Function exists but ignores its `age` and `sex` params; calls same endpoint as `searchTrials`. No callers since the agent was refactored to a single search. Safe to delete.

### KNIP / DEAD CODE

- ✅ Created `knip.json` ignoring `.claude/**`, `.clone/**`, `.context/**` — reduced false-positive "unused files" from 20 → 5.
