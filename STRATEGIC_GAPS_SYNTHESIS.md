# STRATEGIC GAPS SYNTHESIS
### CareCompanion — Overnight Batch 2026-05-21
**Read this first. 10am PT brief.**

---

## HEADLINE

You are technically the most capable oncology AI in a patient app — and you cannot legally onboard your first paying user. HIPAA blockers (no BAAs with Anthropic, Google, Vercel) exist in parallel with 38 CATASTROPHIC-severity clinical safety gaps that create direct patient death pathways. Both must move simultaneously. The good news: the highest-impact safety fixes are prompt-level changes measurable in hours, not sprints. Fix safety, execute BAAs, then flip the monetization switch — in that order.

---

## TL;DR RISK CALL-OUTS — LOOK AT THESE TODAY

> These are not roadmap items. These are founder-level decisions that block everything else.

### 🚨 RISK-1 — BAA BLOCKERS (Legal violation, active today)
PHI (patient name, diagnosis, medications, labs, chat history) is transmitted to **Anthropic, Google Gemini, and Vercel** on every single request with **no executed Business Associate Agreements**. This is an active HIPAA violation the moment any real patient uses the platform.

**Action required today:**
1. Email enterprise@anthropic.com — request BAA execution (Anthropic Enterprise plan)
2. Switch Gemini embeddings to Vertex AI (Google Cloud BAA covers it) — or de-identify memory facts before embedding
3. Contact Vercel sales for Enterprise BAA
4. Fix privacy policy (`apps/web/src/app/privacy/page.tsx:141`) — says "Supabase (SOC 2 Type II)"; actual DB is AWS Aurora. This is a material misrepresentation. **2-hour fix.**

*Source: COMPLIANCE_GAP.md §REM-001, REM-002, REM-003, REM-012, REM-035*

### 🚨 RISK-2 — SUICIDALITY PROTOCOL ABSENT
The platform serves a population with 15–25% depression prevalence and elevated suicide rates. The current system has a 988 number buried in the Wellness specialist's resource list and zero structured protocol. A cancer patient expressing suicidal ideation may receive an empathetic response that continues the conversation without any hard stop.

**Action required today:** Add the crisis protocol from `CLINICAL_SAFETY_GAP.md §5.1` verbatim to `apps/web/src/lib/system-prompt.ts` BASE_PROMPT. This is a one-commit prompt addition. It takes 2 hours.

*Source: CLINICAL_SAFETY_GAP.md GAP-SUI (6 CATASTROPHIC scenarios), AI_EVAL_GAP.md SUI-001/002*

### 🚨 RISK-3 — NEUTROPENIC FEVER ROUTING KILLS PEOPLE
The system currently says **"call your oncology team"** for fever during nadir. The correct instruction for ANC <500 + fever is **"go to the ER immediately — do not wait for a callback."** This word-choice gap could delay IV antibiotics by 2-4 hours, crossing the window for preventing septic shock.

**Action required today:** Add the neutropenic fever ER escalation protocol from `CLINICAL_SAFETY_GAP.md §5.2` to BASE_PROMPT. 2-hour prompt change.

*Source: CLINICAL_SAFETY_GAP.md GAP-NAD-01 (CATASTROPHIC), USER_PAIN_QUOTES.md §Cluster 7*

---

## TOP 20 BETS — RANKED BY IMPACT × EASE × DIFFERENTIATION

**Scoring:** Impact (1–5: safety/revenue/moat) × Ease (1–5: S=5 days, M=3 weeks, L=1 month+) × Differentiation (1–5: unique=5, few competitors=4, some=3, most=2, table stakes=1)

| Rank | Bet | Score | Impact | Ease | Diff | Sources | One-Sentence Pitch | Owner | Effort | Blocker |
|------|-----|-------|--------|------|------|---------|-------------------|-------|--------|--------|
| **1** | **Neutropenic fever → ER routing (prompt)** | **125** | 5 | 5 | 5 | CLINICAL_SAFETY, USER_PAIN | Replace "call oncologist" with "go to the ER now" in BASE_PROMPT — prevents septic shock deaths from a delayed response. | Aryan | S (2h) | None |
| **2** | **Nadir-week proactive push notification** | **125** | 5 | 5 | 5 | USER_PAIN, GROWTH, WEARABLE | Fire a push on day 5 post-infusion: "Entering nadir — fever >100.4°F = ER, not a callback"; treatment cycle tracker + push infra already exist. | Aryan | S (1 day) | None |
| **3** | **Emergency Siri Intent + SOS watch screen** | **125** | 5 | 5 | 5 | VOICE_GAP, WEARABLE | `ShowEmergencyCardIntent` + one-tap SOS watch screen opens full allergy/med emergency card via voice or wrist — could save a life at an ER when the patient can't navigate the phone. | Shreyash | S (2-3 days) | Add `com.apple.developer.siri` entitlement + `NSSiriUsageDescription` |
| **4** | **Suicidality crisis protocol (prompt)** | **100** | 5 | 5 | 4 | CLINICAL_SAFETY, AI_EVAL | Add CRISIS SIGNALS detection + 988 escalation + one direct safety question to BASE_PROMPT — closes the most glaring absolute gap in a platform serving 15–25% depression-prevalence patients. | Aryan | S (2h) | None |
| **5** | **Pregnancy/lactation contraindications (prompt)** | **100** | 5 | 5 | 4 | CLINICAL_SAFETY | Add Category X/D medication flags (tamoxifen, methotrexate, letrozole) to BASE_PROMPT — zero code; zero test coverage; currently a CATASTROPHIC gap for any reproductive-age patient. | Aryan | S (2h) | None |
| **6** | **Caregiver-invites-caregiver (1-line code fix)** | **100** | 5 | 5 | 4 | GROWTH, COMPETITIVE | Remove the `isGroupPatient` restriction on code generation in `care-group/code/route.ts:51` — unlocks the single biggest virality bottleneck where adult children can't invite siblings. | Aryan | S (30 min) | None |
| **7** | **`safe_to_combine` DDI field fix** | **80** | 5 | 4 | 4 | CLINICAL_SAFETY | Rename `safe_to_combine: boolean` to `no_major_interactions_detected` + add confidence field — eliminates the explicit false safety signal where a missed interaction returns `safe_to_combine: true`. | Aryan | S-M (1-2 days) | None |
| **8** | **Med streak-at-risk push notification** | **80** | 4 | 5 | 4 | GROWTH | Before a streak breaks, send "Your 6-day streak ends tonight — log your dose" at 8pm local; `userUsage` table already tracks streaks; Duolingo mechanic proven at +15–25% D30 retention. | Aryan | S (1 day) | None |
| **9** | **"Is This Normal?" persistent triage widget** | **80** | 4 | 5 | 4 | USER_PAIN, CLINICAL_SAFETY | Quick-tap symptom widget (Fever / Shortness of Breath / Severe Pain / Bleeding) → instant routing: "Call oncology on-call NOW" vs. "Monitor and log"; triage API already exists. | Aryan + Shreyash | S (2-3 days) | None |
| **10** | **Lab improvement celebration push** | **80** | 4 | 5 | 4 | GROWTH | When ANC/WBC improves from abnormal → normal range, push "Great news: her WBC is back in normal range 🎉" to the whole care group — highest shareability moment, drives care group fills. | Aryan | S (1 day) | None |
| **11** | **QT prolongation + Beers Criteria prompts** | **80** | 4 | 5 | 4 | CLINICAL_SAFETY | Add QT prolongation drug list and Beers Criteria age-gate to Medication Specialist system prompt — closes two SEVERE-class clinical gaps in pure-prompt additions. | Aryan | S (3h combined) | None |
| **12** | **Post-visit summary + plain-language decoder** | **64** | 4 | 4 | 4 | USER_PAIN | After an appointment passes in CalendarView, AI prompts "What did your doctor tell you today?" → extracts decisions/questions/jargon definitions; closes the "I forgot what they said at 10pm" panic. | Aryan | M (5-7 days) | CalendarBridge event detection |
| **13** | **Behavioral safety eval suite (CI gate)** | **64** | 4 | 4 | 4 | AI_EVAL | Ship 20 behavioral eval scenarios (jailbreak, PHI isolation, suicidality, sycophancy, dosage math) as CI-gated JSON fixtures — zero live API spend; LLM-as-judge uses eval model separate from tested model. | Aryan | M (5-7 days) | None |
| **14** | **Human navigator partner (CancerCare.org)** | **60** | 5 | 4 | 3 | COMPETITIVE | Add "Talk to a Navigator" button linking to CancerCare.org (already cited in system prompt) with pre-filled care summary — partnership deal, not a build; closes the enterprise table-stakes gap vs. Outcomes4Me/Jasper. | Founders | S-M (2-3 weeks, legal/BD) | BD outreach |
| **15** | **Medication dose Live Activity (LA-1)** | **60** | 4 | 3 | 5 | WEARABLE | Dynamic Island + Lock Screen showing next dose name + countdown + TAKEN/SNOOZE/SKIP buttons; `medications/medicationReminders/reminderLogs` tables exist; only missing is the Swift extension. | Shreyash | M (7-10 days) | Xcode extension target + APNs tokens (migration 022) |
| **16** | **Financial assistance discovery** | **60** | 4 | 3 | 5 | USER_PAIN | After scanning an EOB or prescription, auto-match drug name to manufacturer PAP, NeedyMeds, LLS, Susan G. Komen, co-pay cards — document parsing infra exists; needs assistance-program lookup. | Aryan | M (1 week) | Assistance program DB/API |
| **17** | **Freemium monetization launch ($12/mo trial gate)** | **45** | 5 | 3 | 3 | MONETIZATION | Add `plan` column to `users` table + trial matching paywall at search #2 + Stripe integration; `userUsage` table is architecturally ready; zero billing infra exists today. | Aryan | M-L (2-3 weeks) | BAA execution first (BLOCKER) |
| **18** | **Magic-link SMS caregiver invite** | **48** | 4 | 3 | 4 | GROWTH | `POST /api/care-group/invite/magic-link` → short URL with JWT-encoded care group context; removes the "install from a code" barrier for non-tech grandparents and elderly spouses. | Aryan | M (5-7 days) | None |
| **19** | **Caregiver task delegation ("Share the Load")** | **48** | 4 | 4 | 3 | USER_PAIN, COMPETITIVE | Add `tasks` table + care-group task UI (assign/claim pharmacy pickup, appointments, meals); ianacare's core feature; closes virality bottleneck where single caregiver burns out while siblings disappear. | Shreyash + Aryan | M (5-7 days) | None |
| **20** | **Scanxiety countdown + coping flow** | **45** | 3 | 3 | 5 | USER_PAIN | When a scan appointment is detected in CalendarView, activate daily coping prompts → day-of breathing exercise → "waiting for results" support mode; near-100% of scan-surveillance patients report scanxiety; zero oncology apps address it. | Aryan + Rahil | M (1 week) | Scan appointment detection heuristic |

---

## 4-WEEK PROPOSED ROADMAP

> Assumptions: Aryan = web/AI/backend; Shreyash = mobile iOS; Rahil = onboarding + FHIR. BAA legal process starts Day 1 and runs in parallel.

### WEEK 1 — P0 SAFETY SHIP (Mon–Fri)

These are prompt-level changes. No design, no migrations, no PRs that need review. Ship daily.

| Day | Task | Owner | Effort | Deploy |
|-----|------|-------|--------|--------|
| Mon | Neutropenic fever → ER protocol → BASE_PROMPT | Aryan | 2h | Same day |
| Mon | Suicidality crisis protocol → BASE_PROMPT | Aryan | 2h | Same day |
| Mon | Pregnancy/lactation Category X gate → BASE_PROMPT | Aryan | 2h | Same day |
| Mon | Privacy policy fix (Supabase → AWS Aurora) | Aryan | 2h | Same day |
| Mon | Email Anthropic enterprise + Vercel enterprise BAA | Founders | 30min | Legal process starts |
| Tue | QT prolongation framework → Medication Specialist prompt | Aryan | 3h | Tue |
| Tue | Beers Criteria age-gate → Medication Specialist prompt | Aryan | 2h | Tue |
| Tue | Opioid MED safety notice → Medication Specialist prompt | Aryan | 2h | Tue |
| Wed | Triage red flags (FAST, SVC, cord compression) → Wellness Specialist | Aryan | 3h | Wed |
| Wed | `safe_to_combine` field rename + confidence field (code) | Aryan | 4h | Wed |
| Thu | Demo mode: add crisis protocol + ER escalation to demo prompt | Aryan | 2h | Thu |
| Thu | Caregiver-invites-caregiver: remove `isGroupPatient` gate | Aryan | 30min | Thu |
| Fri | Nadir-week proactive push notification (day-5 cron trigger) | Aryan | 1 day | Fri |

**Week 1 output:** 5 catastrophic clinical gaps closed, 1 legal fix, privacy policy corrected, single biggest virality gate opened, nadir push shipping. Zero engineering cost beyond prompts + 1 day of code.

---

### WEEK 2 — P0 POLISH + P1 STARTS

| Task | Owner | Effort |
|------|-------|--------|
| Med streak-at-risk push (N1 trigger) | Aryan | 1 day |
| Lab improvement celebration push (N6 trigger) | Aryan | 1 day |
| Infusion reminder push (N8 trigger) | Aryan | 1 day |
| "Is This Normal?" triage widget (mobile + web) | Aryan + Shreyash | 3 days |
| Mobile route safety parity (tools + crisis protocol) | Aryan | 2 days |
| Behavioral safety eval suite — write JSON fixtures + CI gate | Aryan | 3 days |
| BAA follow-up: Gemini → Vertex AI migration or PHI de-identification | Aryan | 3 days |
| Human navigator BD: contact CancerCare.org + draft partnership terms | Founders | Ongoing |

---

### WEEK 3 — P1 SHIP

| Task | Owner | Effort |
|------|-------|--------|
| Post-visit summary + plain-language decoder (AI flow) | Aryan | 5 days |
| Magic-link SMS caregiver invite | Aryan | 5 days |
| Financial assistance discovery (assistance program lookup) | Aryan | 5 days |
| Xcode: `CareCompanionLiveActivity` extension target | Shreyash | 3 days |
| APNs tokens migration 022 + registration endpoint | Aryan | 2 days |
| Medication dose Live Activity Swift views (LA-1) | Shreyash | 5 days |
| RBAC enforcement: caregiver `perms` in API route handlers | Aryan | 3 days |
| Session timeout: configure 8h maxAge + idle logout | Aryan | 1 day |
| Navigate BAAs: confirm AWS BAA execution; Resend + Sentry BAA | Founders | Ongoing |

---

### WEEK 4 — P1 POLISH + P2 EXPERIMENTS

| Task | Owner | Effort |
|------|-------|--------|
| Freemium monetization: `plan` column + trial matching paywall (Stripe) | Aryan | 5 days |
| Caregiver task delegation: `tasks` table + care-group UI | Shreyash + Aryan | 5 days |
| Scanxiety countdown + coping flow | Aryan + Rahil | 5 days |
| Emergency Siri Intent: add entitlement + `ShowEmergencyCardIntent` | Shreyash | 2 days |
| LogPainIntent + LogMedicationIntent App Shortcuts | Shreyash | 3 days |
| Nadir countdown watch complication (C-6) | Shreyash | 3 days |
| Public care update page (CaringBridge-style weekly summary OG card) | Aryan | 3 days |
| PHI log redaction: fix 8 console.error calls in PHI routes | Aryan | 2 days |

---

## KILL LIST — 5 BETS TO DEPRIORITIZE NOW

> These scored low. Parking them formally prevents relitigating in every sprint planning.

| # | Bet | Why Kill It | Revisit When |
|---|-----|-------------|-------------|
| **K1** | **Android Health Connect clinical records** | L effort (4-6 weeks of native Kotlin bridge); iOS covers current user base; zero Android users today; premature build before PMF on iOS. We already win on HealthKit FHIR — don't split mobile engineering before the iOS product is complete. | When Android install base exceeds 20% of total or health system partnership requires Android parity. |
| **K2** | **Multi-language support (Spanish)** | L effort (6-8 weeks for i18n framework + UI strings + legal docs); zero Spanish-language users confirmed; Claude's AI chat already responds in Spanish natively — the gap is UI scaffolding only. High effort for a user segment that doesn't yet exist in the product. | When any Spanish-speaking user cohort is confirmed; or when a Medicare/CMS partnership requires it. |
| **K3** | **Spiritual/meaning-making section** | Requires content partnerships (chaplaincy directories, tradition-specific content) that add BD overhead with no revenue. Deeply valuable but 100% whitespace with no validated demand signal from actual users. Risk of alienating secular users if executed poorly. | When NPS surveys or user interviews show spiritual support as a top-5 pain; or when a cancer center partner wants this as a chaplaincy integration. |
| **K4** | **Prescription discount card / GoodRx link** | Lowest differentiation score (1) — users already use GoodRx independently; adds zero unique value; could create a PBM conflict-of-interest impression for future health plan partnerships. | Never as a standalone feature. Roll into the Financial Assistance Discovery engine (Rank #16) as a sub-feature. |
| **K5** | **Voyage AI rerank removal / replacement** | Removing Voyage AI saves a BAA complexity (low-to-unknown BAA availability) but the reranking materially improves memory retrieval quality. The better fix is PHI de-identification of memory facts before sending, not architectural removal. Rebuilding pure pgvector RRF would regress recall. | Address as part of the Gemini→Vertex AI BAA migration — de-identify before sending to both. Don't remove the functionality. |

---

## WATCH LIST — 5 ITEMS THAT NEED MORE DATA BEFORE DECIDING

| # | Item | What's Uncertain | Data to Collect | Timeline |
|---|------|-----------------|-----------------|----------|
| **W1** | **Medicare PIN code alignment** | Jasper Health is reimbursable through Medicare Principal Illness Navigation codes in 27 states — a structural revenue moat. CareCompanion has the clinical depth but not the human navigator layer (required for PIN billing). | Confirm: does PIN billing require employed navigators or can it be partner-billed? Get a health law counsel opinion on a partnership-billing model with CancerCare or AONN. | Before Series A; this changes the enterprise revenue story entirely. |
| **W2** | **Pharma trial referral monetization ($200-500/qualified lead)** | Antidote.me model exists; CareCompanion's trial matching is already there. Risk: FDA has not issued AI-mediated matching guidance; creating a pay-to-rank system could destroy patient trust if disclosed poorly. | Consult health law counsel. Review FDA guidance on AI in trial matching. Survey 20 users on "how would you feel if we told pharma sponsors when you match their trial?" | Before building any pharma integration. This is a trust question, not a revenue question. |
| **W3** | **SMART on FHIR / Epic App Orchard integration** | Could give access to millions of cancer patients already in the Epic ecosystem; EHR data would flow automatically. But Epic's App Orchard approval is a 3-6 month process and requires SOC2. | Check App Orchard application requirements. Map to our SOC2 gap (3-5 month readiness). Identify 3 potential Epic-using oncology health systems willing to pilot. | After SOC2 Type 1 readiness (~3 months). App Orchard application can be started alongside compliance work. |
| **W4** | **Data dividends model (pay patients for their data)** | Folia Health raised $10.5M Series A on this model for chronic illness RWE. Cancer patient data is more valuable to pharma than general chronic illness. But: cancer patients are under financial stress — $4/month feels inadequate; a higher number ($15-25/month) could flip willingness to share. | Survey 50 users: "Would you share your anonymized chemo + lab data with pharmaceutical researchers for $X/month?" Find the price point. Check if this requires IRB. | Before Folia enters oncology (estimated 12-18 months). This is a proactive moat bet. |
| **W5** | **Public care update page (CaringBridge-style)** | CaringBridge is #1 in the App Store for "cancer caregiver" with 4.8 stars and 290K ratings. Their moat is public journal → guestbook → network effect (friends search name → discover app). CareCompanion's weekly AI summary already generates this content. | Measure: do any current users share the weekly summary link? What's the click-through rate on shared links? How many new account creations come from a shared link? | After shipping the OG social card (Week 4). Measure for 4 weeks before building full public page infrastructure. |

---

## CROSS-CUTTING THEMES OBSERVED ACROSS ALL 10 DOCS

1. **Safety and compliance are blocking everything.** The AI safety gaps (CLINICAL_SAFETY) and the HIPAA/BAA blockers (COMPLIANCE) are not independent risks — they are the same existential risk. A single bad outcome (patient follows wrong ER guidance, PHI breach) ends the company. Fix both simultaneously.

2. **CareCompanion is architecturally over-indexed on web, under-indexed on mobile.** The mobile route (`apps/web/src/app/api/chat/mobile/route.ts`) bypasses the orchestrator, all specialist agents, and drug interaction checking. The wearable and voice gaps are both mobile-native gaps. Shreyash's workload in Weeks 3-4 is load-bearing.

3. **The viral flywheel is half-built.** Push infra, care groups, weekly summaries, and nadir notifications all exist. What's missing are the emotional/social triggers (lab improvement celebration, new member joined, streak at risk) and the friction removal (caregiver-invites-caregiver, magic-link invite). These are not feature requests — they are the activation mechanic for what's already built.

4. **The moat is real but unknown outside the company.** No competitor has: chemo-cycle day guidance, nadir prediction, cancer-specific RAG memory, AI drug interaction checking, caregiver burnout detection, or AI insurance appeal generation. But if Outcomes4Me (400K users) fixes their FOLFOX medication gap and adds caregiver mode, the gap narrows fast. The window is 6-12 months.

5. **Revenue is zero and the architecture is ready.** The `userUsage` table, demo account system, and trial matching gate are all architecturally monetization-ready. The only missing piece is a `plan` column in `users` and Stripe integration. This is a 2-3 week build blocked only by the BAA requirement.

6. **User pain clusters match product coverage well — but the nuanced moments are missed.** The app handles the structural ("medication tracker, lab results, nadir") but misses the emotional inflection points ("scan week," "I woke up at 3am with a fever and Googled for an hour"). These are the moments where retention is won or lost.

7. **The eval suite tests 0 of 98 identified safety scenarios.** The existing `hybrid.json` eval measures retrieval recall — important, but unrelated to whether the AI kills someone with a drug interaction miss. Safety evals should be the first new tests added to CI.

---

## OPEN QUESTIONS FOR FOUNDERS TO DECIDE

| # | Question | Stakes | Decision Deadline |
|---|----------|--------|------------------|
| **Q1** | Do we de-identify PHI before sending to Anthropic, or do we upgrade to Anthropic Enterprise and execute the BAA? De-identification protects us regardless of Anthropic's BAA status; Enterprise BAA is simpler but costs more. | Revenue model + legal liability | This week |
| **Q2** | Who is the formally designated HIPAA Security Officer? This must be a named individual, documented in writing. | SOC2 T1 readiness; regulatory requirement | This week |
| **Q3** | What is our Series A timeline? This determines whether we build the employer/practice B2B tier in 2026 or treat it as a 2027 roadmap item. The SOC2 path (3-5 months) must precede the enterprise channel. | Fundraising + go-to-market | Before next investor meeting |
| **Q4** | Do we pursue the Medicare PIN code reimbursement path (requires human navigator layer + health law counsel)? This is Jasper's #1 moat and would require either employing navigators or a revenue-sharing partnership with CancerCare/AONN. | $500K+ ARR potential; 12-month build | Before Series A deck |
| **Q5** | Is the current scope (cancer only) the right constraint for the next 12 months, or do we move to broader chronic illness (Folia model) to expand TAM? The chemo-cycle day guidance and nadir architecture are cancer-specific moats that won't transfer to, e.g., MS or Crohn's. | Product strategy + TAM | By end of Q2 |
| **Q6** | Should we partner with ASCO / Cancer.Net for content licensing, or build our own content pipeline? ASCO content would give clinical credibility comparable to Outcomes4Me's NCCN integration; licensing is faster. | Enterprise sales credibility | Within 60 days |

---

## SOURCE DOC INDEX

| Doc | Status | Primary Bets Fed | Risk Level |
|-----|--------|-----------------|------------|
| **CLINICAL_SAFETY_GAP.md** | ✅ Complete (904 lines) | Ranks 1, 4, 5, 7, 11 | 🔴 Critical |
| **COMPLIANCE_GAP.md** | ✅ Complete (697 lines) | TL;DR RISK-1; Ranks 17, 18 (prerequisites) | 🔴 Critical |
| **AI_EVAL_GAP.md** | ✅ Complete (474 lines) | Rank 13 (eval suite); cross-validates Ranks 4, 9 | 🔴 Critical |
| **COMPETITIVE_GAP.md** | ✅ Complete (1211 lines) | Ranks 14, 15, 16; Kill K1, K2 | 🟡 High |
| **USER_PAIN_QUOTES.md** | ✅ Complete (666 lines) | Ranks 9, 12, 16, 19, 20; Watch W5 | 🟡 High |
| **GROWTH_GAP.md** | ✅ Complete (306 lines) | Ranks 6, 8, 10, 18; Watch W5 | 🟡 High |
| **MONETIZATION_GAP.md** | ✅ Complete (308 lines) | Rank 17; Watch W2 | 🟡 High |
| **WEARABLE_STRATEGY.md** | ✅ Complete (284 lines) | Ranks 3, 15; Watch W3 | 🟢 Medium |
| **VOICE_GAP.md** | ✅ Complete (351 lines) | Rank 3 (shared with WEARABLE); Week 4 | 🟢 Medium |
| **DATA_MOAT_GAP.md** | ⚠️ Stub only (3 lines) | No bets sourced — overnight batch did not write this doc | N/A |

> **DATA_MOAT_GAP.md was found but contains only 3 lines (a header + placeholder).** The overnight batch that was supposed to write it appears to have failed silently. The FHIR/HealthKit moat is partially covered by COMPETITIVE_GAP.md §7 (Differentiator 7) and WEARABLE_STRATEGY.md. Recommend re-running the data moat analysis batch on tonight's cycle.

---

## DETAILED SCORING TABLE (All Scored Bets)

| Bet | Impact | Ease | Diff | Score | Disposition |
|-----|--------|------|------|-------|-------------|
| Neutropenic fever → ER routing | 5 | 5 | 5 | 125 | TOP 20 #1 |
| Nadir-week proactive push | 5 | 5 | 5 | 125 | TOP 20 #2 |
| Emergency Siri Intent + SOS watch | 5 | 5 | 5 | 125 | TOP 20 #3 |
| Suicidality crisis protocol | 5 | 5 | 4 | 100 | TOP 20 #4 |
| Pregnancy/lactation contraindications | 5 | 5 | 4 | 100 | TOP 20 #5 |
| Caregiver-invites-caregiver | 5 | 5 | 4 | 100 | TOP 20 #6 |
| `safe_to_combine` DDI fix | 5 | 4 | 4 | 80 | TOP 20 #7 |
| Med streak-at-risk push | 4 | 5 | 4 | 80 | TOP 20 #8 |
| "Is This Normal?" triage widget | 4 | 5 | 4 | 80 | TOP 20 #9 |
| Lab improvement celebration push | 4 | 5 | 4 | 80 | TOP 20 #10 |
| QT prolongation + Beers Criteria prompts | 4 | 5 | 4 | 80 | TOP 20 #11 |
| Post-visit summary + decoder | 4 | 4 | 4 | 64 | TOP 20 #12 |
| Behavioral safety eval suite | 4 | 4 | 4 | 64 | TOP 20 #13 |
| Human navigator partner | 5 | 4 | 3 | 60 | TOP 20 #14 |
| Medication dose Live Activity | 4 | 3 | 5 | 60 | TOP 20 #15 |
| Financial assistance discovery | 4 | 3 | 5 | 60 | TOP 20 #16 |
| Freemium monetization launch | 5 | 3 | 3 | 45 | TOP 20 #17 |
| Magic-link SMS caregiver invite | 4 | 3 | 4 | 48 | TOP 20 #18 |
| Caregiver task delegation | 4 | 4 | 3 | 48 | TOP 20 #19 |
| Scanxiety countdown + coping flow | 3 | 3 | 5 | 45 | TOP 20 #20 |
| RBAC enforcement (perms jsonb) | 4 | 3 | 2 | 24 | COMPLIANCE prerequisite |
| Session timeout (8h + idle) | 3 | 4 | 1 | 12 | COMPLIANCE prerequisite |
| BAA execution (Anthropic/Google/Vercel) | 5 | 3 | 1 | 15 | BLOCKER (not rankable) |
| Android Health Connect | 4 | 1 | 3 | 12 | KILL K1 |
| Multi-language support | 3 | 1 | 2 | 6 | KILL K2 |
| Spiritual/meaning-making section | 3 | 2 | 5 | 30 | KILL K3 (no demand signal) |
| Prescription discount card / GoodRx link | 2 | 4 | 1 | 8 | KILL K4 |
| Voyage AI removal | 2 | 3 | 1 | 6 | KILL K5 |
| Medicare PIN code alignment | 5 | 1 | 5 | 25 | WATCH W1 |
| Pharma trial referral monetization | 4 | 2 | 5 | 40 | WATCH W2 |
| SMART on FHIR / Epic App Orchard | 5 | 1 | 4 | 20 | WATCH W3 |
| Data dividends model | 4 | 2 | 5 | 40 | WATCH W4 |
| Public care update page | 3 | 3 | 4 | 36 | WATCH W5 |
| OpenFDA/DrugBank DDI database integration | 4 | 1 | 4 | 16 | P3 backlog |
| Haiku → Sonnet upgrade for DDI | 3 | 3 | 3 | 27 | P3 backlog |
| MFA implementation | 3 | 2 | 2 | 12 | SOC2-T1 backlog |
| Mobile route orchestrator parity | 4 | 2 | 3 | 24 | Week 2 (safety prerequisite) |

---

*Synthesized from 9 complete + 1 stub overnight research documents. DATA_MOAT_GAP.md requires a re-run.*
*Next review: 2026-05-28 morning brief.*
