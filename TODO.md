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
