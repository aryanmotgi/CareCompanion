# CareCompanion Pre-Mortem
*Assumed: launched 6 months ago, growth stalled, team post-mortems.*

Ranked by **likelihood × impact** (5 = max each axis).

---

## #1 — Feature sprawl: no user ever had a "this is 10× better than a spreadsheet" moment
**L:5 × I:4 = 20**

**Cause:** Shipped with 15+ distinct features simultaneously (medications, labs, chat, trials, insurance appeals, scan docs, community, burnout tracker, analytics, calendar sync, visit prep, timeline, care group, HealthKit). No user is ever forced to complete a single workflow end-to-end before seeing the full dashboard.

**User impact:** Patient's family member downloads the app. Opens to `DashboardView.tsx:88` — "Everything about care" — 8 tiles stare back. Taps Medications: decent. Taps Trials: 3 matches, two hospitals are 200 miles away. Taps Chat: generic response. No single thing is 10× better than keeping a Google Doc. Deletes at day 4.

**Preventable?** Yes. A forced first-run flow — enter ≥1 medication + set ≥1 reminder — before showing the full sidebar would have created an activation event and a daily-return hook.

**Code change today:** In `apps/web/src/app/(app)/layout.tsx`, read `careProfiles.onboardingCompleted` (already in the DB schema). If `onboardingCompleted = false` after completing `/onboarding`, redirect to a `/first-run` page that requires one medication entry and one reminder before navigating to `/dashboard`. Hide the `BottomTabBar.tsx:57` Trials tab and `AppShell.tsx:62` Insurance menu item behind an "Advanced" toggle until week 2.

---

## #2 — Caregiver chicken-and-egg: they arrive first, but the app assumes the patient is already there
**L:4 × I:4 = 16**

**Cause:** `apps/web/src/lib/onboarding/phase-machine.ts:116–118` routes `role='caregiver'` directly to `{ kind: 'care-group-join', mode: 'code' }`. `CareGroupJoin.tsx:56` calls `/api/care-group/join-by-code`. The only alternative is email-based request-join — which also requires the patient to already have an account. In reality the caregiver is often the person who learns about CareCompanion first while the patient is too sick to self-enroll.

**User impact:** Caregiver signs up during hospital waiting room. Gets to "Enter your 5-character code." Patient has no phone and no account. Caregiver cannot proceed. Abandons. Later tells the patient "I tried that app, it didn't work."

**Preventable?** Yes, with a single new phase.

**Code change today:** In `phase-machine.ts`, add a `CREATE_PROFILE_FOR_PATIENT` action from `care-group-join` that transitions to `{ kind: 'wizard', step: 0 }` with `role='caregiver'`. In `CareGroupJoin.tsx`, add a third button: "Patient isn't on CareCompanion yet — I'll set up their profile." This creates a care profile owned by the caregiver, generates an invite link the patient can claim later. Mirrors how most family caregiving actually starts.

---

## #3 — Sync failures are invisible: stale data kills clinical credibility
**L:4 × I:4 = 16**

**Cause:** HealthKit sync (`apps/mobile/src/services/background-sync.ts`, `/api/healthkit/sync/route.ts`) fails silently under iOS background-refresh throttling and expired Cognito tokens. The route `/app/(app)/sync-status/page.tsx` — the natural place to surface this — is a 2-line stub that just redirects to `/settings`. No timestamp, no "sync now" button, no alert. Nothing in `DashboardView.tsx` shows last-synced age.

**User impact:** Patient brings the app to an oncology appointment. Doctor glances over, sees lab results from 6 days ago. Mutters "these aren't current." Patient feels embarrassed. The app was supposed to make them look organized; instead it made them look careless. Doctor never looks at it again. Patient uses the app less.

**Preventable?** Yes — the sync-status page existed as a placeholder, which means someone intended to build this.

**Code change today:** Implement `apps/web/src/app/(app)/sync-status/page.tsx` with last-sync timestamp per data source (HealthKit, FHIR, manual) and a "Sync Now" button calling `/api/healthkit/sync`. Add a yellow `SyncStaleWarning` banner to `DashboardView.tsx` when `lastSyncedAt > 24h`. On mobile, show a push notification from `apps/mobile/src/services/notifications.ts` when background sync hasn't run in 48h.

---

## #4 — Clinical trials matching surfaces ineligible trials; one bad match destroys trust in all AI features
**L:3 × I:4 = 12**

**Cause:** `apps/web/src/app/api/cron/trials-match/route.ts` runs AI matching using only `cancerType`, `cancerStage`, `zipCode`, and `patientAge` from `careProfiles`. The `gapAnalysis.ts` pipeline correctly identifies eligibility gaps and marks them as `"close"` matches — but `TrialsTab` renders both confirmed and close matches in the same list without surfacing the gap reason. A patient with NSCLC stage IV is shown a trial requiring "EGFR-mutation positive" with no visible warning that this criterion can't be verified from their profile.

**User impact:** Patient prints the match and brings it to their oncologist. Oncologist says "you're not EGFR-positive, this app doesn't know your case." Patient stops trusting the Chat AI too, assuming it similarly fabricates. The trial feature tanks retention for the chat feature — which is the app's highest-value capability.

**Preventable?** Yes — the gap analysis data already exists; it just isn't shown.

**Code change today:** In `apps/web/src/components/trials/CloseMatchCard.tsx`, render `eligibilityGaps` prominently above the CTA: "⚠ 2 criteria need verification with your oncologist." In `TrialsTab`, gate the match list behind a disclaimer modal on first view: "Matches are based on your diagnosis only. Confirm eligibility before contacting trial sites." Suppress any trial where `eligibilityGaps.length > 3` — the gap analysis already computes this in `gapAnalysis.ts`.

---

## #5 — Guest chat leaks value with no conversion gate; users "try before they buy" and never buy
**L:3 × I:3 = 9**

**Cause:** `/chat/guest` (`apps/web/src/app/chat/guest/page.tsx`) is linked from `LoginForm.tsx:360`, the `conditions/[regimen]/page.tsx` CTA, and `demo-walkthrough/page.tsx`. The guest chat route (`/api/chat/guest/route.ts`) allows unlimited, unauthenticated AI health conversations with no account prompt.

**User impact:** Organic visitor searches "chemo side effects folic acid." Lands on a conditions page. Taps "Ask AI." Has a full, useful 8-message conversation covering their exact situation. Gets their answer. Closes the tab. Never signs up. The app provided maximum value to this user at zero cost to them. Across 1,000 monthly guest sessions, conversion to signup sits at 3–5% and CLV from those users barely covers infrastructure.

**Preventable?** Yes — a soft gate after 3 messages would have converted enough to matter without destroying the top-of-funnel SEO value of the conditions pages.

**Code change today:** In `apps/web/src/app/chat/guest/page.tsx`, after 3 AI turns, show a `GuestGateModal` (new component): "You've had 3 free messages. Create a free account to continue — we'll save this conversation." Persist the guest conversation ID to `localStorage`; after signup, call `/api/conversations` to import it under the new user. The conversation import pathway already exists in `/api/conversations/route.ts`.
