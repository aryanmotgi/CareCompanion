# CareCompanion: Strategic Roadmap Gap Analysis 2026–2027

**Prepared:** 2026-05-24  
**Scope:** Cancer caregiver AI — capability gaps vs. user needs, competitive landscape, and the AI frontier  
**Branch:** aryan/dev  

---

## Executive Summary

CareCompanion has shipped a strong clinical coordination layer — multi-agent chat, FHIR ingestion, medication reminders, lab interpretation, symptom journaling, and hybrid pgvector memory — that outclasses most consumer health apps on raw intelligence. But cancer caregiving in 2026 demands more than coordination: it demands emotional rescue, financial survival, end-of-life planning, and care-team-grade communication tools. Fifteen capability gaps are identified below, ranked by a composite score of (user pain × 12-week feasibility) ÷ estimated build cost. The top five are immediate P0s for the next 90 days.

---

## 1. Research Methodology

**Codebase audit:** Full review of `apps/web/src/` — 80+ API routes, 6 specialist agents, 22 DB tables, 16 chat tools, lib modules (trials, memory, burnout, drug-interactions, compliance-tracker, health-score).

**Caregiver needs research:** PMC literature (2025–2026 scoping reviews), CancerCare national survey (n=2,703), PLOS ONE cross-phase unmet needs study, KFF financial hardship data.

**Competitor analysis:** Jasper Health ($37.8M raised, LCSW telehealth + symptom tracker), Wellthy (human Care Coordinators + employer benefits), Folia Health (home-reported outcomes, 40k users, CancerX founding member), ianacare (50k caregivers, Elevance + AARP partnerships), Caribou (shift-fill AI for home care agencies), AnswersNow ($40M Series B, AI-enabled BCBA telehealth).

**AI frontier:** Med-PaLM M (multimodal: radiology, genomics, clinical language), GPT-5 medical (evaluated vs. NHS 111 symptom checker; strong on visual QA), CardioAI (wearable + voice for cardiotoxicity), TrialMatchAI (RAG over ClinicalTrials.gov — Nature Communications 2026), HALO-X (2.1M remote monitoring data points in cancer).

---

## 2. Current Capability Map

| Domain | Shipped | Depth |
|---|---|---|
| AI chat | 6-specialist multi-agent, 16 tools, Memory v2 | Strong |
| FHIR ingestion | 1upHealth (Epic, Sutter, Kaiser, Stanford, UCSF) | Strong |
| Medication management | Reminders, adherence tracking, drug interactions, refill alerts | Strong |
| Lab results | Parsing, trend analysis, abnormal flagging | Good |
| Insurance / claims | PA tracking, cost estimator, claims log | Moderate |
| Symptom journaling | 6 dimensions, trend sparklines | Moderate |
| Clinical trials | Matching queue, gap analysis, eligibility assembly | Moderate |
| Care team collaboration | Role-based access, activity feed | Moderate |
| Notifications | 5 cron-driven alert types, web push | Moderate |
| Visit prep | Before/after templates | Moderate |
| Community | Page exists | Stub |
| Caregiver burnout | `caregiver-burnout.ts` module | Stub |
| Palliative / hospice | None | Missing |
| Financial toxicity navigation | None (cost estimator only) | Missing |
| Prior auth appeal drafting | None | Missing |
| Multilingual support | None | Missing |
| Photo/multimodal symptoms | None | Missing |
| Provider communication | None | Missing |
| Employer benefits / FMLA | None | Missing |
| Ambient documentation | Browser TTS only | Missing |

---

## 3. Gap Matrix — 15 Identified Gaps

### Scoring formula

Each gap is scored on three axes, each 1–5:
- **User Pain (P):** Frequency × severity of unmet need from survey data and clinical literature
- **Feasibility (F):** Can we ship a v1 in ≤12 weeks on current stack?
- **Build Cost (C):** Inverse of effort: 5 = cheap, 1 = expensive

**Composite = (P × F) / C** — higher is better ROI.

---

### Gap 1 — Financial Toxicity Navigator
**Composite: 4.8 | Recommendation: BUILD**

**The need.** NCI and a 2025 PMC scoping review confirm ~70% of cancer caregivers report significant financial problems. 25% make major employment changes. Average financial navigation intervention returns $2,500 in copay assistance per participant. Insurance AI is denying more claims (41% of physicians see >10% denial rates, up from 30% three years ago). Financial stress is the #2 driver of caregiver burnout after emotional load.

**The gap.** CareCompanion has a cost estimator ("how much will an MRI cost me?") but no proactive financial aid matching. There is no database of copay assistance programs, manufacturer PAPs (Patient Assistance Programs), NeedyMeds, RxAssist, disease-specific foundations, or state-level aid. Wellthy's human Care Coordinators handle exactly this — but at $X/month employer benefit, not consumer-accessible.

**Build vs. partner vs. ignore.** Build: a curated, structured database of ~500 programs (manufacturer PAPs, foundations like Leukemia & Lymphoma Society, Cancer Care financial grants, RxAssist, state Medicaid programs) plus a Claude agent that matches the care profile against eligibility rules and surfaces the top 5 candidates with application links and deadlines. Moderate DB effort, low model effort. Jasper touches this lightly; nobody has AI-driven matching.

**12-week v1:** Financial Aid Finder — ingest 500 programs, eligibility matching agent, proactive "You may qualify" notification on diagnosis/insurance change event.

---

### Gap 2 — Prior Authorization Appeal Drafting
**Composite: 4.5 | Recommendation: BUILD**

**The need.** PA denial rates are rising as payers adopt AI-driven utilization review. 56% of insurers use or plan to use AI for utilization management. AI appeal tools (Counterforce Health, Sheer Health) are emerging but none are embedded in a longitudinal care record. A caregiver who has 12 months of labs, treatment notes, prior auth history, and clinical guidelines in one place can produce a far more compelling appeal than a standalone tool.

**The gap.** CareCompanion tracks prior authorizations (expiry alerts, status) but cannot draft appeals. The insurance specialist agent has no appeal workflow. No peer in the cancer caregiver space offers embedded PA appeal drafting with access to the patient's own longitudinal data.

**Build vs. partner vs. ignore.** Build: add an `AppealDraftingTool` to the insurance specialist that takes (denial reason, diagnosis, treatment history, PA history, clinical guidelines from ClinicalTrials.gov / NCCN) and generates a structured appeal letter. Claude's grounding in medical literature makes this a strong native capability. Can integrate CMS coverage databases via public API.

**12-week v1:** Single-click "Draft Appeal" from PA detail view; agent generates letter with placeholders for caregiver signature; export as PDF.

---

### Gap 3 — Caregiver Burnout Screening + Intervention Routing
**Composite: 4.2 | Recommendation: BUILD**

**The need.** Caregiver burnout is the single largest risk to sustained caregiving. PMC 2025 data: caregivers experience high anxiety, depression, and burnout without institutional support. An AI chatbot for early detection of caregiver burden is in feasibility testing (PMC 11907196). BioBase biometric burnout detection shows 31% sick-day reduction. Yet no consumer cancer caregiver app has deployed validated burnout screening with warm handoff.

**The gap.** `caregiver-burnout.ts` exists as a module but there is no user-facing burnout screening flow, no PHQ-9 / GAD-7 / Zarit Burden Interview integration, and no intervention routing (counseling referral, respite care search, peer support group enrollment). The Wellness Monitor specialist is reactive to what users say, not proactive.

**Build vs. partner vs. ignore.** Build: monthly burnout check-in (Zarit-12 or Caregiver Strain Index) surfaced as a conversational flow by the Wellness specialist; score stored in memory; if threshold crossed → warm referral to CancerCare counseling line (free), peer support group, or Jasper LCSW (partnership opportunity). Piggyback on existing `caregiver-burnout.ts` and symptom entry infrastructure.

**12-week v1:** Monthly burnout check-in dialog, score trending in analytics dashboard, referral cards surfaced above threshold.

---

### Gap 4 — Palliative Care & Advance Care Planning Module
**Composite: 3.9 | Recommendation: BUILD**

**The need.** A 2025 JMIR umbrella review confirms digital health tools are underdeployed in palliative and end-of-life care despite strong evidence of benefit. Hospice transition is one of the highest-stress caregiver inflection points. Advance directives (POLST, DNR, healthcare proxy, living will) are often undocumented in digital tools. ENVISION (NCI) and Hospice@Home (PMC) validate the space but remain research prototypes.

**The gap.** CareCompanion has no palliative care workflow. No hospice search, no POLST capture, no goals-of-care documentation, no "what to expect" guides for the active dying phase. No competitor has shipped this for consumers — Jasper and Wellthy avoid it; ianacare focuses on active caregiving.

**Build vs. partner vs. ignore.** Build v1 as document capture + AI-guided completion: upload or create POLST/advance directive, store as structured data, surface in Emergency Card. Add hospice locator (Medicare Hospice Finder API is public). Add palliative care "what to expect" knowledge base. Partner with NHPCO or Caring.com for content. This is a moat: once a family uses CareCompanion through end-of-life, they will refer others. High LTV.

**12-week v1:** Advance directive upload + key field extraction (DNR status, proxy name), hospice locator, palliative symptom management guide accessible from chat.

---

### Gap 5 — Cancer-Specific Multimodal Symptom Documentation (Photo)
**Composite: 3.7 | Recommendation: BUILD**

**The need.** Cancer treatment side effects are often visual: radiation dermatitis, chemotherapy rash, mucositis, injection site reactions, lymphedema, wound healing. Caregivers describe these to oncology teams via phone triage — "it looks a little red" — with no visual record. CardioAI (CHI 2025) validates multimodal wearable + voice monitoring. HALO-X collected 2.1M data points in cancer remote monitoring. GPT-5 and Claude 3.5+ both demonstrate strong medical visual QA. The 2025 Frontiers multimodal medicine framework identifies photo-symptom capture as a high-value digital health wedge.

**The gap.** Symptom journaling captures 6 numeric dimensions but no images. The scan/document upload exists for documents, not for body symptom photos. No competitor has shipped this for cancer caregivers.

**Build vs. partner vs. ignore.** Build: add optional photo attachment to symptom entries. On upload, Claude vision describes the finding (e.g., "Grade 2 radiation dermatitis — redness covering >25% of treated area with some dry desquamation"), adds it to the symptom journal, and offers to include in the visit prep doc. No diagnosis — description and documentation only. Requires camera permission (already present in mobile app). Regulatory note: position as documentation aid, not diagnostic tool.

**12-week v1:** Photo capture in symptom journal (mobile + web), Claude vision description, auto-append to next visit prep.

---

### Gap 6 — Peer Community with AI Facilitation
**Composite: 3.4 | Recommendation: BUILD**

**The need.** JMIR Cancer 2025: online peer support forums reduce isolation and improve coping for cancer caregivers. ianacare's private team feed and Cancer Support Community's forums demonstrate demand. Jasper has 1:1 LCSW access but no peer layer. No competitor has combined AI-facilitated peer matching with a longitudinal care record.

**The gap.** A community page exists in the app but has no substantive features. No peer matching by cancer type, treatment phase, or caregiver role.

**Build vs. partner vs. ignore.** Build a moderated community with AI safety rails: opt-in peer matching by cancer type (lung, breast, GI, hematologic) and phase (active treatment, survivorship, end-of-life). AI moderates for crisis signals (suicide ideation, medication diversion) and escalates to clinical resources. Anonymized profiles. Weekly AI-curated digest of top discussions.

**12-week v1:** Cancer-type cohort threads + AI safety moderation + opt-in peer matching.

---

### Gap 7 — Employer Benefits & FMLA Navigation
**Composite: 3.2 | Recommendation: BUILD (or Partner)**

**The need.** 25% of caregivers make employment changes after diagnosis (PMC scoping review, 2025). FMLA, state-level paid leave, short-term disability, caregiver leave policies, and EAP access are complex and underutilized. Wellthy built a $100M+ business on exactly this employer-distribution channel. However, Wellthy's model is B2B2C (employer benefit); CareCompanion can own the consumer-facing intelligence layer.

**The gap.** No FMLA guidance, no employer benefit navigation, no leave calculation tools, no EAP directory. Users asking "Can I take leave to care for my father?" get a generic chat response.

**Build vs. partner vs. ignore.** Build the consumer-facing FMLA + state leave eligibility calculator (hours worked, employer size, relationship type, state). Partner with Wellthy or a benefits broker for the employer channel. Build: 4–6 weeks for the calculation engine and guidance agent. The employer partnership is a revenue wedge worth exploring separately.

---

### Gap 8 — Provider Communication Drafts
**Composite: 3.0 | Recommendation: BUILD**

**The need.** Caregivers struggle to communicate symptom changes, side effects, and concerns to busy oncology teams between appointments. Surveys consistently rank "getting information from providers" as a top unmet need. Secure messaging is often buried in patient portals; caregivers don't know how to frame clinical concerns.

**The gap.** Visit prep generates a summary *before* appointments but there is no mechanism to draft a MyChart/portal message, a phone triage question, or a fax to a specialist. The 16 existing chat tools include no outbound communication drafting.

**Build vs. partner vs. ignore.** Build: "Draft a message to Dr. X about [symptom]" recognized by the Wellness and Scheduling specialists → Claude drafts a concise, clinical-tone message the caregiver can copy/paste into their portal. No FHIR write required — just structured prose. Low infra cost.

---

### Gap 9 — Multilingual & Cultural Competency
**Composite: 2.9 | Recommendation: BUILD (phased)**

**The need.** Cancer incidence and mortality disproportionately affect Spanish-speaking, Black, and Asian American communities. African American caregivers face additional unmet needs (PMC 12828305). A 2025 qualitative study of healthcare providers confirms language barriers are a major access gap. 43 million US adults speak Spanish at home. No cancer caregiver app offers native multilingual AI support.

**The gap.** CareCompanion is English-only. Claude is natively multilingual, so the model cost is near-zero; the infra cost is i18n of the UI. Phase 1: Spanish UI + Claude responds in user's language of choice. Phase 2: Culturally adapted content (LCSW referrals in Spanish).

**12-week v1:** Language preference setting → Claude responds in that language; Spanish UI strings for the 20 most-used screens.

---

### Gap 10 — Real-World Data Contribution / Research Enrollment
**Composite: 2.7 | Recommendation: PARTNER**

**The need.** Folia Health's moat is turning patient-reported data into research-grade Home-Reported Outcomes (HROs) — 40k users, CancerX partnership, pharma contracts. Caregivers want to feel their data contributes to a cure. TrialMatchAI (Nature Communications 2026) shows AI matching against ClinicalTrials.gov is now production-ready.

**The gap.** CareCompanion has a trials matching module but no consent and data contribution workflow. Users can find trials but cannot enroll their de-identified symptom data in observational studies.

**Build vs. partner vs. ignore.** Partner with Folia or CancerX to add an opt-in research data contribution layer on top of CareCompanion's symptom journal data. Revenue model: pharma pays for real-world evidence. Build: a consent workflow and a FHIR export to a research partner's endpoint. Do not build the research platform from scratch — Folia has 5-year head start.

---

### Gap 11 — Smart Chemotherapy Cycle Tracking
**Composite: 2.6 | Recommendation: BUILD**

**The need.** Chemotherapy regimens (FOLFOX, R-CHOP, AC-T, etc.) have complex multi-day cycles, rest days, and dose modifications based on ANC nadir counts. Caregivers struggle to track where they are in a cycle, predict nadir windows (infection risk peaks), and know when the next infusion is. No consumer app surfaces this automatically.

**The gap.** A cycles API exists in `apps/web/src/app/api/cycles/` but the feature appears thin (no NCCN regimen library, no nadir prediction, no cycle day calculation). The scheduling specialist handles appointments but not treatment protocol phase awareness.

**Build vs. partner vs. ignore.** Build: a regimen library of the 20 most common cancer regimens with cycle structure, expected nadir windows, and care instructions per phase. The scheduling specialist becomes protocol-aware: "Day 8 of FOLFOX — your nadir window starts in 3 days; avoid crowds and monitor temperature."

---

### Gap 12 — Wearable Passive Burnout Monitoring
**Composite: 2.5 | Recommendation: PARTNER / DEFER**

**The need.** BioBase and CardioAI show wearable + passive signal monitoring can detect burnout before self-report. Heart rate variability (HRV), sleep fragmentation, and step-count drops are validated burnout precursors. CareCompanion already has HealthKit integration on mobile.

**The gap.** HealthKit data flows in but is not used for burnout inference. The wellness specialist only responds to what users say.

**Build vs. partner vs. ignore.** Defer for 90 days — the caregiver burnout screening workflow (Gap 3) should ship first as the lower-cost baseline. Then add passive signal inference as an enhancement. Requires HRV access (Watch only), so audience is limited.

---

### Gap 13 — Cancer-Specific Drug Interaction Engine
**Composite: 2.4 | Recommendation: PARTNER**

**The need.** Oncology drug interactions (chemo + herbals like St. John's Wort, immunotherapy + NSAIDs, targeted therapies + CYP3A4 inhibitors) are dramatically more dangerous and complex than standard drug interactions. The existing `drug-interactions.ts` module uses general databases.

**The gap.** No oncology-specific interaction database (Lexicomp Oncology, Clinical Pharmacology for Oncology). Claude's training data covers most common interactions but is not updated in real time.

**Build vs. partner vs. ignore.** Partner with Lexicomp or Micromedex for an API license. This is a data licensing problem, not a model problem. Low build, medium licensing cost. Tag as a paid feature tier if needed.

---

### Gap 14 — Caregiver Self-Care Scheduling
**Composite: 2.3 | Recommendation: BUILD (light)**

**The need.** Research consistently shows caregivers defer their own healthcare. Annual physicals, mammograms, colonoscopies, and dental care are skipped. CareCompanion is patient-centric; the caregiver has no profile for their own health.

**The gap.** Multi-patient support allows switching between care profiles but the caregiver themselves has no care profile. No preventive care reminders for the caregiver role.

**Build vs. partner vs. ignore.** Build a lightweight "Caregiver Self-Care" profile (not a full care profile — just preventive care reminders by age/sex). Prompt during onboarding: "You can't pour from an empty cup — want us to remind you about your own checkups too?"

---

### Gap 15 — Ambient Visit Documentation
**Composite: 2.1 | Recommendation: DEFER**

**The need.** Nuance DAX Copilot and Suki dominate the clinician ambient documentation space. Consumer-grade ambient documentation for patients/caregivers (recording + summarizing what the doctor said) is nascent but high-demand. 41% of cancer patients forget >50% of what was said during oncology visits.

**The gap.** Voice input uses browser TTS for dictation but does not record or transcribe full clinical encounters.

**Build vs. partner vs. ignore.** Defer: ambient recording introduces significant consent, regulatory (two-party states), and liability complexity. The visit prep + post-visit note capture workflow covers 70% of the use case at 10% of the risk. Re-evaluate in Q4 2026 as FDA digital health guidance evolves and Whisper-class local transcription matures.

---

## 4. Consolidated Gap Matrix

| # | Gap | Pain (1–5) | Feasibility (1–5) | Build Cost (1–5, 5=cheap) | Composite | Recommendation |
|---|---|---|---|---|---|---|
| 1 | Financial Toxicity Navigator | 5 | 5 | 5 | **25.0** | BUILD P0 |
| 2 | PA Appeal Drafting | 5 | 4 | 4 | **20.0** | BUILD P0 |
| 3 | Caregiver Burnout Screening | 5 | 5 | 4 | **25.0** | BUILD P0 |
| 4 | Palliative / Advance Care Planning | 4 | 4 | 4 | **16.0** | BUILD P0 |
| 5 | Multimodal Photo Symptoms | 4 | 4 | 3 | **16.0** | BUILD P0 |
| 6 | Peer Community + AI Moderation | 4 | 3 | 3 | **12.0** | BUILD Q3 |
| 7 | Employer Benefits / FMLA Nav | 4 | 3 | 3 | **12.0** | BUILD/PARTNER Q3 |
| 8 | Provider Communication Drafts | 3 | 5 | 5 | **15.0** | BUILD Q3 |
| 9 | Multilingual / Spanish | 4 | 4 | 3 | **16.0** | BUILD Q3 |
| 10 | Real-World Data Contribution | 3 | 3 | 2 | **9.0** | PARTNER Q4 |
| 11 | Chemo Cycle Tracking | 4 | 4 | 4 | **16.0** | BUILD Q3 |
| 12 | Wearable Burnout Monitoring | 3 | 2 | 2 | **6.0** | DEFER |
| 13 | Cancer Drug Interaction Engine | 4 | 3 | 2 | **12.0** | PARTNER Q4 |
| 14 | Caregiver Self-Care Scheduling | 3 | 5 | 5 | **15.0** | BUILD Q3 |
| 15 | Ambient Visit Documentation | 5 | 1 | 1 | **5.0** | DEFER Q4 |

*Gaps 1 and 3 tied at 25.0; both are P0 given separate workstreams.*

---

## 5. Top 5 P0 — Next 90 Days

### P0-1: Financial Toxicity Navigator (Weeks 1–6)
**Owner: Insurance specialist agent + new DB tables**

- Curate 300+ financial assistance programs (manufacturer PAPs via NeedyMeds API / manual, CancerCare grants, LLS, PAN Foundation, HealthWell, RxAssist, state Medicaid, HRSA programs)
- DB: `financial_assistance_programs` table (program name, cancer types, income eligibility, benefit type, deadline, URL, application method)
- New `FinancialAidMatcherTool` added to the insurance specialist: takes current diagnoses + insurance + income (if provided) → returns top 5 matching programs with eligibility assessment
- Proactive trigger: on new diagnosis save or PA denial, push notification "3 financial assistance programs may apply to your situation"
- UI: Financial Aid tab in insurance section with "Check Eligibility" CTA

**Success metric:** ≥30% of cancer-diagnosis users surface at least one matched program within 7 days of diagnosis entry.

---

### P0-2: Prior Authorization Appeal Drafting (Weeks 2–7)
**Owner: Insurance specialist + PA detail view**

- Add `AppealDraftingTool` to the insurance specialist; inputs: denial letter text (OCR'd from upload or manual entry), patient diagnosis, treatment history, lab context, NCCN guideline reference (public PDFs)
- Claude generates a structured appeal letter: (1) patient/plan identification, (2) clinical summary, (3) medical necessity argument citing guidelines, (4) request for expedited review
- Export as PDF or copy-to-clipboard
- Track appeal outcomes in `prior_auths` table (new `appeal_status`, `appeal_submitted_at`, `appeal_outcome` columns); aggregate win rate in analytics
- Surface "We won!" moment in app when PA approved after appeal

**Success metric:** PA appeal drafting used by ≥20% of users who have a PA denial in their record.

---

### P0-3: Caregiver Burnout Screening + Routing (Weeks 1–4)
**Owner: Wellness specialist + notifications**

- Monthly check-in flow using Caregiver Strain Index (13 items) or Zarit-12 — conversational format via Wellness specialist; score stored in `symptom_entries` with category `caregiver_burnout`
- Dashboard: burnout trend sparkline alongside patient symptom trends
- Risk tiers: Green (0–12) / Yellow (13–24) / Red (25+); Yellow → gentle suggestion of peer support; Red → warm referral card (CancerCare counseling: 800-813-4673, free; Cancer Support Community online group; 988 Crisis Line)
- Wellness Monitor proactively schedules the next check-in via cron
- `caregiver-burnout.ts` extended to include validated scoring logic

**Success metric:** ≥60% of active caregivers complete at least one burnout check-in within 30 days of launch.

---

### P0-4: Palliative Care & Advance Care Planning (Weeks 4–9)
**Owner: General Companion specialist + records section**

- Advance directive capture: upload POLST/MOLST/living will → Claude extracts key fields (DNR preference, healthcare proxy name/phone, artificial nutrition preference, intubation preference) → stored as structured data in `documents` + new `advance_directives` table
- Emergency Card update: surface DNR status and proxy contact
- Hospice Locator: integrate Medicare Hospice Finder API (public, no key required) → "Find hospice near ZIP" in chat
- Palliative Symptom Guide: 20 evidence-based articles (dyspnea management, pain at home, nausea, anxiety) surfaced by Wellness specialist when keywords trigger ("she's having trouble breathing", "end of life", "comfort care")
- Visit prep template addition: goals-of-care conversation starter questions

**Success metric:** Advance directive upload completion rate ≥15% of users who have a Stage III/IV cancer diagnosis in their profile within 60 days of feature launch.

---

### P0-5: Cancer-Specific Multimodal Symptom Documentation (Weeks 5–10)
**Owner: Symptom journal + mobile camera**

- Add optional photo capture to the symptom entry form (mobile: CameraRoll + camera; web: file upload)
- On upload, POST to new `/api/symptoms/photo-describe` route → Claude vision generates a structured description: body location, affected area estimate, severity descriptor (using NCI CTCAE Grade language without assigning a grade), change from previous photos
- Photo stored in S3 with PHI controls; thumbnail in symptom journal timeline
- Auto-append photo description to the next visit prep document
- Caregiver can annotate: "This appeared on Day 3 of radiation"
- Longitudinal comparison: "Compare to photo from 2 weeks ago" chat command

**Success metric:** Photo symptom capture used by ≥25% of mobile users with active cancer treatment in their profile within 45 days.

---

## 6. Q3 2026 Queue (Weeks 13–26)

| Priority | Feature | Notes |
|---|---|---|
| Q3-1 | Provider communication drafts | Low effort, high demand; 2-week sprint |
| Q3-2 | Chemo cycle tracking | Regimen library (20 protocols), nadir alerts |
| Q3-3 | Caregiver self-care scheduling | Lightweight; reuse reminder infra |
| Q3-4 | Multilingual / Spanish | i18n pass on top 20 screens; Claude natively handles chat |
| Q3-5 | Peer community v1 | Cancer-type cohorts, AI safety moderation |
| Q3-6 | Employer benefits / FMLA calculator | Build consumer-facing; explore Wellthy partnership for employer distribution |

---

## 7. Partnership & Licensing Targets

| Partner | Why | Timeline |
|---|---|---|
| **CancerCare** | Counseling referral pipeline for burnout routing; established brand trust | Q3 2026 |
| **NeedyMeds / RxAssist** | Financial assistance program database APIs | Q2 2026 (pre-P0-1 launch) |
| **Medicare Hospice Finder** | Public API — no partnership needed | Immediate |
| **Folia Health / CancerX** | Real-world data contribution layer; co-research opportunity | Q4 2026 |
| **Lexicomp Oncology** | Cancer-specific drug interaction database | Q4 2026 |
| **Wellthy** | Employer channel distribution; Wellthy handles concierge, CareCompanion provides AI intelligence | 2027 |

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Palliative care creates legal liability (advance directives) | Frame as document storage + extraction, not legal advice; standard disclaimers; consult NHPCO on safe content bounds |
| Photo symptom capture may imply diagnostic capability | CTCAE-grade language with explicit "documentation only, not a diagnosis" disclaimer on every photo analysis; no Grade assignment |
| Burnout screening creates duty-to-warn scenarios | Crisis line surfaced automatically; PHI-compliant storage; Zarit does not diagnose depression (use PHQ-2 screen only if adding clinical routing) |
| Financial program database becomes stale | Quarterly refresh cron; source NeedyMeds API where possible; user-reported corrections workflow |
| PA appeal drafting accused of unauthorized practice of law | Letter is informational draft; caregiver must review and send; no attorney-client language; precedent: Counterforce Health has operated this model since 2023 |

---

## 9. Competitive Moat Assessment

If CareCompanion ships all five P0s by September 2026:

- **vs. Jasper Health:** Jasper has LCSW telehealth (partnership moat) and a large member base, but no financial toxicity navigator, no PA appeal drafting, no palliative care workflow, and no multimodal symptom photo. CareCompanion's longitudinal data advantage makes each of these features materially better than any standalone tool.
- **vs. Wellthy:** Wellthy's human Care Coordinator model is expensive and employer-distributed. CareCompanion's AI-first model can deliver 70% of the same outcomes at consumer price points. The FMLA calculator (Q3) is a direct wedge into Wellthy's employer audience.
- **vs. Folia Health:** Folia owns real-world outcomes data but has no AI chat, no insurance navigation, no FHIR ingestion. A partnership is more likely than competition.
- **vs. ianacare:** ianacare owns practical logistics coordination (meals, rides, respite). CareCompanion owns clinical intelligence. These are complementary; ianacare integration (share logistics tasks from CareCompanion chat) is a Q4 partnership worth exploring.

The enduring moat is **longitudinal context**: a caregiver who has used CareCompanion for 12 months has embedded their family's entire medical history, preferences, care team, and financial situation. No new entrant can replicate that on day one. The P0 investments deepen retention at the highest-pain inflection points (financial crisis, PA denial, emotional burnout, end-of-life) — exactly when caregivers are most likely to churn to a human service or give up entirely.

---

*Sources consulted: PMC 11534103, PMC 12816088, PMC 12828305, PMC 12727810, PMC 8357113, PMC 11907196, PMC 12087674, PMC 12519022; CancerCare 2022 Caregiver Survey; NCI Financial Toxicity PDQ; KFF Prior Authorization AI Regulation report (2025); Counterforce Health; TrialMatchAI Nature Communications 2026; Jasper Health PitchBook / PR Newswire; Wellthy / Benefitfocus partnership announcement; Folia Health CancerX; ianacare MIT News 2025; AnswersNow HLTH 2026; Frontiers in Medicine multimodal AI framework 2025.*
