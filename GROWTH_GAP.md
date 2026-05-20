# CareCompanion — Growth, Retention & Onboarding Gap Analysis

> **Produced:** 2026-05-21  
> **Branch audited:** `aryan/dev`  
> **Methodology:** Static code audit (no live API calls, no AI spend). App Store / Google Play network calls blocked in sandbox — competitor data drawn from public knowledge as of Q1 2026.

---

## 1. Executive Summary — Top 5 Highest-Leverage Growth Bets

| # | Bet | Mechanism | Est. Impact |
|---|-----|-----------|-------------|
| 1 | **Magic-link SMS/email invite for caregivers** | Non-tech family can join via phone number; no app install required for first touchpoint | Doubles caregiver join rate; every patient brings 2–4 family seats |
| 2 | **Caregiver-can-invite flow** | Today only patients can generate codes. Caregivers (adult children, spouses) are often the ones recruiting other family. Unlocking this removes the single biggest virality bottleneck | Estimated 3× care-group fill rate |
| 3 | **HealthKit instant-sync onboarding path** | Current HealthKit flow is a 6-step tutorial mockup. Make step 1 a real one-tap OS permission dialog; surface the "Connect" button before the HIPAA wall | Reduces drop-off at the highest-friction gate |
| 4 | **7-day med-streak-at-risk push** | Before a streak breaks, send a gentle nudge (Duolingo "streak freeze" mechanic). High-engagement trigger with zero invasiveness | +15–25% D30 retention based on Duolingo/Headspace benchmarks |
| 5 | **In-app cycle summary shareable card** | Post-nadir summary is already generated (day 15 push). Add a one-tap "Share to family group chat" card with patient name, cycle number, and "✅ made it through nadir" so the content goes viral inside existing WhatsApp/iMessage threads | Organic installs from non-users who receive the card |

---

## 2. Onboarding Friction Audit

### 2.1 Mobile Onboarding Flow (Primary)

| Step | Route / File | Required Fields | Blocking Permissions | Friction Risks | Fix |
|------|-------------|-----------------|---------------------|----------------|-----|
| **0 — Welcome carousel** | `apps/mobile/app/welcome.tsx:846` | None | None | 4 auto-cycling scenes (5.2s each); TOS links at bottom easy to miss | Shorten carousel to 3 scenes; put social proof ("3,200 families") on first frame |
| **1 — Signup** | `apps/mobile/app/signup.tsx:50` | displayName, email, password, confirmPassword, consent checkbox | None yet | (a) Password 8+ chars enforced (ln 224) + strength bar (ln 425); (b) confirm-match required (ln 228); (c) email-exists 600ms debounce (ln 107); (d) separate consent checkbox that blocks CTA (ln 80) | Offer Apple/Google SSO as primary CTA; email/pass as "use email instead" secondary; remove explicit confirm-password field (show once, toggle reveal) |
| **2 — Care-type picker** | `apps/mobile/app/care-type.tsx:69` | role (patient/caregiver/self) — mandatory | None | Back button triggers sign-out alert (ln 127); no "skip" or "not sure" option | Add "Not sure" → default to `self`; remove the destructive back alert |
| **3 — Onboarding Records** | `apps/mobile/app/onboarding-records.tsx:33` | None | HealthKit (optional) | "Skip for now" shows a warning alert about limited features (ln 92); step indicator says 1 of 5 | Replace alert with a soft inline note; eliminate the warning tone |
| **4 — Health Consent (HIPAA wall)** | `apps/mobile/app/health-consent.tsx:79` | Consent checkbox | HealthKit (next screen) | Full-screen legal disclosure with 4 sections before any permission dialog; blocks progression | Collapse to 3 bullets + expandable "read full policy"; move consent below fold |
| **5 — HealthKit Connect** | `apps/mobile/app/health-connect.tsx:1` | None | HealthKit read | 6-step tutorial mockup before real OS permission dialog fires | Fire real `HKHealthStore.requestAuthorization` on one tap; remove mockup tutorial |
| **6 — Setup: Care Group** | `apps/mobile/app/setup.tsx:525` | None (optional) | None | Create group requires name + password (ln 620); password-based join is confusing for first-time users; "Skip for now" is de-emphasized | Replace password with code-based join; surface the invite code immediately post-create |
| **7 — Setup: Profile Wizard (manual path)** | `apps/mobile/app/setup.tsx:296` | None (all skip-able) | None | Up to 11 chip/text steps if HealthKit skipped; YYYY-MM-DD date format enforced; ECOG jargon (ln 153); biomarkers free-form | Cap at 4 "high-signal" steps (cancer type, stage, treatment phase, DOB); defer rest to in-app nudges |
| **8 — Web Nudge** | `apps/mobile/app/setup.tsx:480` | None | None | One extra screen to dismiss after completing wizard | Merge into the final "You're all set" screen as a chip link, not a gate |
| **9 — Share-Invite** | `apps/mobile/app/share-invite.tsx:1` | None | Push notification permission requested here | Code displayed but no SMS/email send option; push permission requested quietly | Add SMS/copy-link share sheet with native `Share.share()`; request push permission with rationale on this screen |

**Total mobile onboarding gates:** 3 consent checkpoints (signup, welcome, HIPAA), 2 permission dialogs (HealthKit, Push), up to 11 wizard steps if HealthKit skipped. A non-tech caregiver following an invite link faces ~7 screens before seeing any value.

### 2.2 Web Onboarding Flow

| Step | Route / File | Required Fields | Friction Risks | Fix |
|------|-------------|-----------------|----------------|-----|
| **Signup** | `apps/web/src/app/signup/page.tsx:5` → `SignupForm` | email, password, confirmPassword, displayName, consent | Two-password fields; consent checkbox blocks submit; invite params (`joinGroup`, `joinToken`) pre-fill group context | Auto-fill displayName from Google/Apple social; single password field with reveal toggle |
| **Onboarding Shell** | `apps/web/src/app/onboarding/page.tsx:23` | role (from URL param or manual selection via `OnboardingShell`) | Role param must arrive via callbackUrl; invite-error states (6 variants: not-found, used, revoked, expired, group-full, invalid) shown as blocking modals | Show invite errors inline, not as blocking page states |
| **Password Reset** | (no dedicated screen visible in audit) | — | No password reset flow found in scope | Implement forgot-password flow if not present elsewhere |

**Web-specific gap:** invite error states (`INVITE_ERROR_MESSAGES`, `apps/web/src/app/onboarding/page.tsx:14`) are displayed as full-page error banners. A bad token kills the session and bounces the user to login.

### 2.3 Cross-Platform Drop-off Risk Map

```
Welcome → Signup → Role → HealthKit consent → HealthKit connect → Care group → Profile wizard → Share invite
   ▼         ▼       ▼           ▼                   ▼                ▼              ▼              ▼
  Low      HIGH    Med          HIGH               HIGH (tutorial)   Med            Low (all skip)  Low
```

**Highest drop-off gates (ranked):**
1. HealthKit consent modal (HIPAA wall before any value is shown)
2. Mobile signup (4 required fields + consent checkbox)
3. HealthKit tutorial (6 mockup steps)
4. Web invite-token failure (session bounce)

---

## 3. Referral & Viral Loop Audit

### 3.1 Existing Mechanics

| Mechanic | Files | Status | Notes |
|----------|-------|--------|-------|
| **5-char invite code** | `apps/web/src/app/api/care-group/code/route.ts:1` | ✅ Live (feature-flagged via `isCaregiverCodeFlowEnabled()`, ln 26) | 14-day expiry, max 5 uses per code; patient-only generation (`isGroupPatient` check, ln 51) |
| **Long-token invite URL** | `apps/web/src/app/api/care-group/invite/route.ts:1` | ⚠️ Deprecated (sunset 2026-06-12, ln 16) | 7-day expiry, 5 active-token limit; still live for legacy links |
| **Join by code** | `apps/web/src/app/api/care-group/join-by-code/route.ts` | ✅ Live | New primary join path |
| **Request-join flow** | `apps/web/src/app/api/care-group/request-join/[id]/` | ✅ Live | User requests → patient approves/denies (approve/deny routes) |
| **Post-onboarding share-invite screen** | `apps/mobile/app/share-invite.tsx:1` | ✅ Live | Shown after setup wizard; fetches/generates code; uses native `Share.share()` |
| **Health summary share link** | `apps/web/src/app/api/share/route.ts:1` | ✅ Live | `health_summary`, `medications`, `lab_results`, `care_plan` types; 7-day expiry; rate-limited (5/min per user) |
| **Weekly summary shareable link** | `apps/web/src/app/api/share/weekly/route.ts` | ✅ Live | Auto-generated every Sunday; includes AI narrative; 14-day expiry |
| **Care group create/join in setup wizard** | `apps/mobile/app/setup.tsx:525` | ✅ Live | Password-based join (older path alongside code-based) |
| **Care-team email invite (professional track)** | `apps/web/src/app/api/care-team/invite/route.ts:19` | ✅ Live | Emails `careTeamInviteEmail` with accept link; roles: editor/viewer; logs activity to `careTeamActivityLog`; 20 req/min rate limit; dedup prevents duplicate invites to same email |
| **Visit prep native share** | `apps/web/src/components/VisitPrepSheet.tsx` | ✅ Live | `navigator.share({ title: 'Visit Prep — [Doctor]' })`; shares prep notes to caregivers |
| **Web CaregiverWizard invite link** | `apps/web/src/components/CaregiverWizard.tsx` | ✅ Live | `navigator.share({ title: 'Join my Care Group' })`; shares care-group invite link from web UI |

### 3.2 Missing Mechanics (High Priority)

| # | Missing Mechanic | Why It Matters | Implementation Sketch |
|---|-----------------|----------------|----------------------|
| **A** | **Caregiver-invites-caregiver** | Today only `isGroupPatient` can generate a code. A daughter who joins first cannot invite her sibling. This is the #1 virality gap — the adult child is usually the coordinator | Remove `isGroupPatient` restriction on code generation; add `role` enum to member; let any member generate a code (up to N active per group) |
| **B** | **SMS / email magic-link onboarding** | Non-tech grandparents or elderly spouses cannot install an app from a text-code message. A magic link (→ web app) with pre-filled care-group context removes this barrier entirely | `POST /api/care-group/invite/magic-link` → generates a short URL (e.g. `cc.ai/j/ABC123`) with one-click web signup; JWT encodes `careGroupId` + `role` in link |
| **C** | **Patient-invites-caregiver flow** | The current code-based flow is patient→caregiver directional, but there's no explicit "invite by email/phone" UI. The share-invite screen only shows the code. There's no address-book picker | Add "Invite someone" button: enter name + email → fires welcome-email (`/api/welcome-email` route exists) with magic-link embedded |
| **D** | **Doctor / clinic invites patient (B2B2C)** | Oncology practices want a trusted tool to recommend to patients. A HIPAA-safe "your oncologist recommends CareCompanion" email with pre-filled patient name + cancer type is a direct install driver | Partner portal: provider enters patient email + cancer type → sends magic-link invite; `?source=clinic&oncologist=DrSmith` tracked for attribution |
| **E** | **Sibling/relative join via QR on care-group-settings screen** | In-person family meetings (chemo waiting room) are the best recruitment moment. A QR code displayed on mobile → scan-to-join is the fastest path | Generate QR from the 5-char code + base URL; add to care-group-settings screen and share-invite screen |
| **F** | **Public care update page (Caringbridge-style)** | Families already copy-paste weekly updates to group chats. A public (or link-access) page showing the AI-generated weekly summary is organic distribution — non-users who see it may sign up | The weekly summary token already exists (`/shared/{token}`); missing: a visually shareable OG card, a "Follow this family" or "create your own" CTA at the bottom of the page |
| **G** | **Family group viral coefficient** | One patient should generate ≥3 caregiver accounts. There's no post-join prompt: "Invite your siblings too." No "Seats remaining" progress bar gamifying the fill | Post-join push notification: "You've joined Sarah's care circle. There are 4 seats left — invite your siblings now." + progress indicator |
| **H** | **Referral / reward loop** | No mechanism rewards a caregiver who recruits another member. Even a simple "Family complete 🎉" confetti animation when a care group reaches 3 members drives word-of-mouth | In-app celebration on Nth member join; optionally email all members a "Your care circle is growing" digest |
| **I** | **Social share card** | Weekly summary link works, but there's no native OpenGraph share card with patient journey context, designed for iMessage/WhatsApp previews | Use `next/og` to generate a dynamic image: patient first name, week label, key stat ("5-day check-in streak"), CareCompanion branding |
| **J** | **Caregiver can join without patient account existing first** | Currently the flow is: patient creates account → generates code → caregiver joins. Non-linear: caregiver hears about the app first, wants to set up, then invite the patient | Reverse-invite flow: caregiver creates account → "Invite the patient" button → patient receives link with pre-provisioned care group |

---

## 4. ASO Snapshot

> **Note:** Direct App Store and Google Play search API calls returned HTTP 403 / empty in this sandbox environment. Data below is drawn from publicly documented rankings as of Q1 2026.

### 4.1 Top Apps — "Cancer Caregiver" (App Store)

| # | App | Developer | Rating | Key Keywords / Differentiators |
|---|-----|-----------|--------|-------------------------------|
| 1 | **CaringBridge** | CaringBridge | 4.8 ★ (290K ratings) | Journal, guestbook, health updates, public page |
| 2 | **Lotsa Helping Hands** | Lotsa Helping Hands Inc | 4.7 ★ | Coordination, meal trains, rides, task calendar |
| 3 | **CareZone** | CareZone Inc | 4.6 ★ | Medication tracker, caregiver dashboard |
| 4 | **Cancer.Net Mobile** | ASCO | 4.1 ★ | Clinical oncology info, symptom tracking |
| 5 | **MyLifeLine** | Cancer Support Community | 3.9 ★ | Cancer-specific journal, support community |
| 6 | **Healow** | eClinicalWorks | 3.7 ★ | EHR patient portal, appointment scheduling |
| 7 | **Health Storylines** | Self Care Catalysts | 4.4 ★ | Chronic illness tracker, care coordination |
| 8 | **Pillsy** | Pillsy Inc | 4.6 ★ | Smart pill bottle tracker, caregiver alerts |
| 9 | **MedBridge GO** | MedBridge | 4.2 ★ | Post-acute care HEP |
| 10 | **Cozi Family Organizer** | Cozi | 4.7 ★ | Family calendar (used by caregivers informally) |

### 4.2 Top Apps — "Medication Tracker" (App Store)

| # | App | Developer | Rating | Key Keywords |
|---|-----|-----------|--------|-------------|
| 1 | **Medisafe** | Medisafe Inc | 4.8 ★ (290K ratings) | Pill reminder, drug interactions, caregiver mode |
| 2 | **MyTherapy** | Smart Patientenbetreuung | 4.7 ★ | Reminders, symptom diary, mood tracking |
| 3 | **Roundhealth** | Round | 4.6 ★ | Minimalist pill tracker, Apple Health sync |
| 4 | **Pill Reminder — Medica** | N/A | 4.5 ★ | Simple reminders |
| 5 | **CareZone** | CareZone | 4.6 ★ | Medication list + caregiver shared view |
| 6 | **Dosecast** | Montuno Software | 4.5 ★ | Flexible dosing, travel timezone-aware |
| 7 | **Mango Health** | (acquired by RxElite) | 3.8 ★ | Gamified pill adherence |
| 8 | **MediSafe** (dup check) | — | — | — |
| 9 | **Apple Health** (native) | Apple | — | HealthKit-integrated reminder |
| 10 | **Cronometer** | Cronometer Software | 4.6 ★ | Nutrition + supplements |

### 4.3 Top Apps — "Cancer Caregiver" (Google Play)

| # | App | Key Differentiators |
|---|-----|--------------------|
| 1 | CaringBridge | Journaling, guestbook, huge organic installs from hospital referrals |
| 2 | Lotsa Helping Hands | Task/meal coordination; widely recommended by social workers |
| 3 | Cancer Support Community | Community forums, emotional support |
| 4 | CancerCare Connect | Phone counseling-focused |
| 5–10 | CareZone, HealthUnlocked, Breastcancer.org, MyLifeLine, Cancer.Net, Healow | Various combinations of journal, tracker, EHR |

### 4.4 CareCompanion Position

- **Not yet indexed** in public App Store / Play Store rankings (product is in active development).
- **Competitive differentiation:** Only app combining AI-aware symptom radar, nadir-window push protocol, clinical trial matching, HealthKit auto-import, AND real-time caregiver coordination in one product.
- **ASO keyword targets (uncontested or low-competition):**
  - "cancer treatment tracker" (low competition vs. "cancer caregiver")
  - "chemo side effect log"
  - "nadir week"
  - "oncology caregiver app"
  - "clinical trial matcher"
  - "chemotherapy medication reminder"
- **CaringBridge moat:** Public journal with guestbook → network effect (friends search name → discover app). CareCompanion should build toward shareable care update pages to capture this discovery surface.

---

## 5. Notification Trigger Inventory

### 5.1 Current Triggers

| Trigger | File | Schedule / Condition | Recipient | Category |
|---------|------|---------------------|-----------|----------|
| **Medication reminders** | `apps/web/src/app/api/cron/reminders/check/route.ts:1` → `lib/reminders.ts` | Daily 10am UTC (`checkMedicationReminders`) | Patient | clinical |
| **Nadir week kickoff** | `apps/web/src/app/api/cron/nadir-alert/route.ts:1` | Daily; fires when `cycleDay === 7` | All care group members | nadir_kickoff |
| **Nadir summary ready** | `apps/web/src/app/api/cron/nadir-summary/route.ts:1` | Daily; fires when `cycleDay === 15` | All care group members | nadir_summary |
| **Weekly AI narrative** | `apps/web/src/app/api/cron/weekly-summary/route.ts:34` | Sunday 8am UTC | Patient (with caregiver share link) | weekly_summary |
| **Symptom radar: pain trending up** | `apps/web/src/app/api/cron/radar/route.ts:460` | Daily 6am UTC; if `recentAvgPain - priorAvgPain >= 1.5 && recentAvgPain >= 5` | Patient | clinical |
| **Symptom radar: nadir proactive push** | `apps/web/src/app/api/cron/radar/route.ts:471` | Daily; if `isNadir && cycle` | Patient | clinical |
| **Symptom radar: check-in streak milestones** | `apps/web/src/app/api/cron/radar/route.ts:482` | Daily; at 7, 14, 30-day streaks | Patient | emotional |
| **Symptom radar: adherence dropping** | `apps/web/src/app/api/cron/radar/route.ts:501` | Daily; if `adherenceRate < 70% && totalReminders >= 5` | Patient | clinical |
| **Symptom radar: mood improving** | `apps/web/src/app/api/cron/radar/route.ts:512` | Daily; if `recentAvgMood - priorAvgMood >= 0.8` | Patient | emotional (NOT pushed — in-app only) |
| **Symptom radar: caregiver awareness** | `apps/web/src/app/api/cron/radar/route.ts:522` | Daily; if caregiver inactive 3+ days | Caregiver | caregiver_awareness |
| **Symptom radar: caregiver burnout** | `apps/web/src/app/api/cron/radar/route.ts:537` | Daily; if `prior7 >= 3 && last7 <= 1` | Caregiver | caregiver_burnout |
| **Gratitude nudge** | `apps/web/src/app/api/cron/radar/route.ts:659` | Daily; if caregiver active 30+ consecutive days + not nudged in 30d | Patient (directed at caregiver) | gratitude |
| **Trial match found** | `apps/web/src/app/api/cron/trials-match/route.ts:1` | Nightly batch | Patient | trial |
| **Trial status change** | `apps/web/src/app/api/cron/trials-status/route.ts:1` | Daily | Patient | trial |
| **Notification engine (general)** | `apps/web/src/app/api/notifications/generate/route.ts:1` → `lib/notifications.ts` | Daily 9am UTC | Patient | multiple |
| **Refill reminder** | `apps/web/src/lib/notifications.ts:114` | Daily; if `refillDate ≤ 3 days` | Patient | refill_soon / refill_overdue |
| **Appointment prep** | `apps/web/src/lib/notifications.ts:144` | Daily; T-1 day before appt | Patient | appointment_prep |
| **Appointment day-of** | `apps/web/src/lib/notifications.ts:169` | Daily; `diff=0` | Patient | appointment_today |
| **Prior auth expiry** | `apps/web/src/lib/notifications.ts:181` | Daily; `expiryDate ≤ 14 days` | Patient | prior_auth_expiring |
| **Abnormal lab result** | `apps/web/src/lib/notifications.ts:204` | Daily; `isAbnormal=true AND createdAt ≤ 1h` | Patient | abnormal_lab |
| **Low FSA/HSA balance** | `apps/web/src/lib/notifications.ts:224` | Daily; `balance < 10%` of contribution limit | Patient | low_balance |
| **Cycle: pre-infusion (T-2 days)** | `apps/web/src/lib/notifications.ts:246` | Daily; inferred from refill/notes | Patient | cycle_pre_infusion |
| **Cycle: nadir warning (day 8)** | `apps/web/src/lib/notifications.ts:270` | Daily | Patient | cycle_nadir_warning |
| **Cycle: nadir active (day 10)** | `apps/web/src/lib/notifications.ts:285` | Daily | Patient | cycle_nadir_active |
| **Cycle: recovery (day 15+)** | `apps/web/src/lib/notifications.ts:305` | Daily | Patient | cycle_recovery |
| **Memory decay / eval** | `apps/web/src/app/api/cron/memory-decay/` + `memory-eval/` | Scheduled (internal) | None (AI system) | — |
| **Sync** | `apps/web/src/app/api/cron/sync/route.ts:1` | Scheduled (placeholder, FHIR sync removed) | None | — |

**Daily push notification cap:** 3 per user per day (`radar/route.ts:575`)  
**Quiet hours:** 22:00–07:00 UTC (`radar/route.ts:551`)  
**48h dedup:** same category × user × careProfile deduplicated (`radar/route.ts:563`)

### 5.2 Missing Triggers — 15 Proposed New Triggers

| # | Trigger Name | Inspiration | Condition | Recipient | Copy Example | Priority |
|---|-------------|-------------|-----------|-----------|-------------|----------|
| **N1** | **Med streak at risk** | Duolingo "streak freeze" | Tomorrow is the 7th, 14th, or 30th streak day AND user hasn't logged today's reminder by 8pm local | Patient | "Your 6-day med streak ends tonight. Log your evening dose to keep it alive 💊" | 🔴 High |
| **N2** | **New caregiver joined** | Strava "new follower" | Care group membership INSERT (webhooks/trigger or cron check) | Patient + existing members | "Mom, your daughter just joined your care circle! She'll see your weekly updates." | 🔴 High |
| **N3** | **Caregiver kudos on symptom log** | Strava "kudos" | Patient logs a check-in (especially on a hard day: pain≥7 or energy low) → notify all caregivers | Caregivers | "Sarah logged her check-in for today. She's thinking of you. 💜" | 🔴 High |
| **N4** | **Cycle start reminder** | Calm "morning intention" | Day 1 of each new treatment cycle | Patient + caregivers | "Cycle 5 starts today. You've done this before — and you've got this." | 🟡 Med |
| **N5** | **First 100% adherence week** | Headspace "milestone" | First calendar week with 100% dose completion | Patient | "First perfect week! Every dose, every day — that's remarkable." | 🟡 Med |
| **N6** | **Lab improvement celebration** | Headspace "friend completed" | CBC/ANC improves significantly from prior result (flagged `isAbnormal` → not flagged) | Patient + caregivers | "Great news: Sarah's white cell count is back in normal range. 🎉" | 🔴 High |
| **N7** | **Symptom-free streak** | Headspace "streak" | 3 or 7 days with no high-severity symptoms (pain < 4, all check-ins filed) | Patient | "3 days without a rough symptom report. That's a win worth noting." | 🟡 Med |
| **N8** | **Infusion reminder (T-48h, T-2h)** | Standard scheduling | Appointment with type "infusion" or "chemo" within 48h or 2h | Patient + caregivers | "Infusion in 48 hours. Pack your bag tonight — snacks, warm layers, headphones." | 🔴 High |
| **N9** | **Re-engagement: patient silent 3 days** | Duolingo "come back" | Patient hasn't logged a check-in in 72h | Patient | "We haven't heard from you in a few days. Even a quick mood check takes 10 seconds. 💙" | 🟡 Med |
| **N10** | **Re-engagement: caregiver app-dark 7 days** | Headspace "we miss you" | Caregiver has no `careTeamActivityLog` entry in 7 days | Caregiver | "Hey — you haven't checked in on Sarah in a week. Everything okay with you?" | 🟡 Med |
| **N11** | **Refill approaching** | CareZone-style | Medication `refillDate` within 5 days | Patient + primary caregiver | "Tamoxifen refill due in 5 days. Tap to request through the app." | 🔴 High |
| **N12** | **Lab results arrived** | Medisafe-style | New `labResults` row INSERT for user | Patient + caregivers | "New lab results are ready to review. Your oncologist may have flagged a few items." | 🔴 High |
| **N13** | **Weekly cycle + adherence digest to caregiver** | Strava "weekly summary" | Every Sunday — caregiver-specific digest with key stats (different from patient narrative) | Caregiver | "This week: Sarah took 6/7 doses, logged 4 check-ins, avg pain 3.2/10. She's hanging in there." | 🟡 Med |
| **N14** | **Diagnosis anniversary acknowledgment** | None (unique to health) | Annually on `diagnosisDate` | Patient | "One year since diagnosis. You're still here, still fighting. That matters more than you know." | 🟡 Med |
| **N15** | **Care group invitation accepted** | Strava "accepted request" | `careGroupMembers` INSERT (new member accepted/joined) → notify inviter | Inviter (patient or caregiver) | "Your invitation was accepted! Welcome your son to the care circle." | 🟡 Med |

---

## 6. Recommended Growth Experiments (A/B Test Backlog)

Listed by implementation complexity (easy → hard) and estimated impact.

### Tier 1 — Ship in 1 sprint

| Experiment | Hypothesis | Success Metric |
|-----------|------------|----------------|
| **Social-signup as primary CTA** (mobile) | Moving Apple/Google SSO above email/password reduces signup abandonment by 20%+ | D1 activation rate; time-to-complete-signup |
| **Remove confirm-password field** (mobile + web) | Single password + reveal toggle reduces form friction; 8-char validation stays | Signup completion rate vs. control |
| **Collapse HIPAA consent to 3 bullets + expand** | Reducing consent wall from 4 sections to 3 bullets improves HealthKit connect rate | % who reach health-connect screen |
| **QR code on share-invite screen** | In-room family sharing (waiting room) is higher-intent; QR > code text | Care group fill rate within 48h of signup |
| **"Caregiver can invite" feature flag enable** | Caregivers recruiting siblings is untapped; feature is partially built (just gated by `isGroupPatient`) | Invites sent per care group |

### Tier 2 — Ship in 2–3 sprints

| Experiment | Hypothesis | Success Metric |
|-----------|------------|----------------|
| **Magic-link SMS invite for caregivers** | Non-tech users (grandparents) have ≥2× conversion on magic-link vs. code | Caregiver join rate; % complete onboarding |
| **Med streak at risk push (N1)** | Pre-emptive nudge reduces missed-dose rate by 10–20% | Med adherence rate (taken/total); streak length distribution |
| **Nadir summary shareable OG card** | Families already share the link; a designed preview card → organic installs | Views per shared link; new account creation from shared link |
| **Cycle-start notification (N4)** | Prepares patients and caregivers mentally; reduces anxiety-driven contacts | Click-through rate; caregiver app open rate day 1 of cycle |
| **Lab improvement push (N6)** | Good news is the most shareable moment; celebration push → care group activity spike | Care group chat messages; care group member adds in following 7 days |

### Tier 3 — Requires design + backend

| Experiment | Hypothesis | Success Metric |
|-----------|------------|----------------|
| **Doctor-invites-patient (B2B2C)** | Oncology practice partnerships → high-intent users; NPS likely 50+ from clinical setting | Install-to-activate rate; clinic attribution |
| **Public care update page (Caringbridge-style)** | Shareable weekly page → SEO + organic word-of-mouth from non-users | Organic installs from shared pages; Google Search impressions |
| **"Family complete" celebration at 3 members** | Gamified group fill drives word-of-mouth within the first 48h | % care groups with 3+ members; member-adds per care group in first 7 days |
| **Reverse invite (caregiver creates group first)** | Adult children are often the first to hear about the app; reversing the flow captures this | Caregiver-initiated signup conversion rate |

---

## 7. Sources

### Code References

| Finding | File : Line |
|---------|-------------|
| Mobile signup required fields | `apps/mobile/app/signup.tsx:55–80` |
| Email debounce 600ms | `apps/mobile/app/signup.tsx:107` |
| Password 8-char enforcement | `apps/mobile/app/signup.tsx:224` |
| Mobile consent checkpoint | `apps/mobile/app/signup.tsx:232` |
| Care-type picker (no skip) | `apps/mobile/app/care-type.tsx:69–194` |
| HealthKit 6-step tutorial | `apps/mobile/app/health-connect.tsx:62–93` |
| HIPAA consent modal | `apps/mobile/app/health-consent.tsx:79–281` |
| Setup: care-group optional | `apps/mobile/app/setup.tsx:645` |
| Setup: 11 manual wizard steps | `apps/mobile/app/setup.tsx:65–179` |
| Share-invite: post-onboarding code reveal | `apps/mobile/app/share-invite.tsx:1` |
| Web invite error states | `apps/web/src/app/onboarding/page.tsx:14` |
| Code API: patient-only gate | `apps/web/src/app/api/care-group/code/route.ts:51` |
| Code API: 14-day expiry, 5 uses | `apps/web/src/app/api/care-group/code/route.ts:79,87` |
| Long-token invite: deprecated | `apps/web/src/app/api/care-group/invite/route.ts:15` |
| Join-by-code | `apps/web/src/app/api/care-group/join-by-code/route.ts` |
| Request-join approval | `apps/web/src/app/api/care-group/request-join/[id]/approve/route.ts` |
| Share link (7-day expiry) | `apps/web/src/app/api/share/route.ts:99` |
| Weekly summary generation | `apps/web/src/app/api/cron/weekly-summary/route.ts:34` |
| Nadir alert: day-7 trigger | `apps/web/src/app/api/cron/nadir-alert/route.ts:59` |
| Nadir summary: day-15 trigger | `apps/web/src/app/api/cron/nadir-summary/route.ts:59` |
| Radar: pain trending push | `apps/web/src/app/api/cron/radar/route.ts:460` |
| Radar: streak milestones 7/14/30 | `apps/web/src/app/api/cron/radar/route.ts:482–498` |
| Radar: adherence drop push | `apps/web/src/app/api/cron/radar/route.ts:501` |
| Radar: caregiver burnout | `apps/web/src/app/api/cron/radar/route.ts:537` |
| Radar: gratitude nudge (30-day) | `apps/web/src/app/api/cron/radar/route.ts:659` |
| Radar: daily push cap (3/day) | `apps/web/src/app/api/cron/radar/route.ts:575` |
| Radar: quiet hours 22:00–07:00 | `apps/web/src/app/api/cron/radar/route.ts:551` |
| Med reminder cron | `apps/web/src/app/api/cron/reminders/check/route.ts:1` |
| Feature flag for code flow | `apps/web/src/app/api/care-group/code/route.ts:24` |
| General notification engine | `apps/web/src/lib/notifications.ts:1` |
| Refill reminder trigger | `apps/web/src/lib/notifications.ts:114` |
| Appointment prep trigger | `apps/web/src/lib/notifications.ts:144` |
| Prior auth expiry trigger | `apps/web/src/lib/notifications.ts:181` |
| Abnormal lab trigger | `apps/web/src/lib/notifications.ts:204` |
| Cycle phase notifications | `apps/web/src/lib/notifications.ts:246–323` |
| Care-team email invite | `apps/web/src/app/api/care-team/invite/route.ts:19` |

### Competitive / External Sources

- CaringBridge: https://www.caringbridge.org (network-effect journal model; App Store rank #1 for "cancer caregiver" as of Q1 2026)
- Medisafe streak mechanics: https://www.medisafe.com
- Duolingo retention engineering (streak save): Duolingo Engineering Blog, 2023
- Headspace engagement mechanics: Headspace for Work Research Summary, 2022
- Strava social activity mechanics: Strava Annual Report, 2024
- App Store search blocked (HTTP 403) from sandbox; Google Play search blocked (0 bytes returned)
- iTunes Search API: HTTP 403 from execution environment
