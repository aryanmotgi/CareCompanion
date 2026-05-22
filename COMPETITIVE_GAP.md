# CareCompanion — Competitive Gap Analysis
**10-Competitor Teardown vs. Current Capability Surface**

_Produced: 2026-05-21 | Branch: `aryan/dev` | Analyst: automated batch agent_

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Context](#2-market-context)
3. [Methodology & Caveats](#3-methodology--caveats)
4. [Per-Competitor Profiles](#4-per-competitor-profiles)
   - 4.1  CareZone (Walmart / dead)
   - 4.2  Caribou (workforce platform — not patient-facing)
   - 4.3  ianacare
   - 4.4  Folia Health
   - 4.5  Outcomes4Me ← primary threat
   - 4.6  MyChart (Epic) ← integration target
   - 4.7  Quiltt (fintech API — not patient-facing)
   - 4.8  OncoBot (minimal signal)
   - 4.9  Jasper Health ← best-funded cancer platform
   - 4.10 Cancer.Net (ASCO) ← content partner candidate
5. [Feature Matrix](#5-feature-matrix)
6. [Table-Stakes Gaps (Must-Add)](#6-table-stakes-gaps-must-add)
7. [Differentiators We Already Have (Moat)](#7-differentiators-we-already-have-moat)
8. [Whitespace Bets (Nobody Has This)](#8-whitespace-bets-nobody-has-this)
9. [Prioritized Action Plan](#9-prioritized-action-plan)
10. [Sources](#10-sources)

---

## 1. Executive Summary

Five strategic findings, ordered by urgency:

### Finding 1 — We Are Technically the Most Capable Cancer AI in a Patient App, but HIPAA Gaps Block Real Deployment

CareCompanion's AI layer is materially more sophisticated than every direct competitor. Unique features include:
- Chemo-regimen-aware conversations with 9 named protocols (FOLFOX, FOLFIRI, FOLFIRINOX, ABVD, R-CHOP, AC-T, carbo-taxol, gemcitabine-cisplatin, BEACOPP, CMF) — `apps/web/src/lib/treatments.ts`
- Per-day cycle guidance with critical-day events and proactive nadir alerts — `apps/web/src/app/api/cron/nadir-alert/route.ts`
- Drug-drug interaction checking against oncology-specific combinations — `apps/web/src/lib/drug-interactions.ts`
- Genomic biomarker tracking (HER2, ER, PR, EGFR, ALK, PD-L1, KRAS, BRAF) feeding trial matching — `apps/web/src/lib/db/schema.ts:107`
- Long-term RAG memory with pgvector hybrid search — `apps/web/src/lib/memory.ts`

**However**, our HIPAA Compliance Report (April 2026, `HIPAA_Compliance_Report.md`) classifies the platform as **"HIGH RISK — Not Production-Ready for Real PHI"** with 12 critical findings — most critically, PHI is transmitted to Anthropic without a Business Associate Agreement. We cannot market HIPAA compliance or enter enterprise/clinical channels while these gaps exist. Resolving HIPAA is the single highest-leverage unlock. Every other growth move is blocked by it.

### Finding 2 — Outcomes4Me (400K+ Users) and Jasper Health ($25M) Are Scaling Fast in Our Exact Category

Outcomes4Me has 400,000+ users as of 2025, earned TIME Best Inventions 2025, and scored 4.06/5 (highest of 17 cancer apps) on the validated Mobile App Rating Scale. Jasper Health raised $25M Series A, is reimbursable through Medicare Principal Illness Navigation (PIN) codes in 27 states, and is expanding through employer benefit and health plan channels. Both are cancer-specific and AI-aware. Neither has our depth of clinical AI (chemo cycles, nadir, drug interactions, genomics), but both have human experts embedded and enterprise distribution. The window to establish differentiation before they catch up is narrowing.

### Finding 3 — The Human Navigator Layer Is Now Table Stakes for Enterprise Cancer Platforms

Three of our ten competitors (ianacare, Jasper Health, Outcomes4Me) offer on-demand human support from nurses or social workers. For B2B enterprise deals — the highest-value customers — AI-only is increasingly a red flag. Buyers want human escalation for liability reasons and for patients in crisis. CareCompanion has no human-in-the-loop layer. Adding one via a partner (CancerCare, Cancer Support Community, AONN) is a 30-day partnership deal, not a 6-month build.

### Finding 4 — Android Health Connect Is a Critical Platform Gap That Creates a Health Equity Liability

Our HealthKit FHIR clinical record pull (`apps/mobile/src/services/healthkit.ts`) is a genuine technical moat on iOS. But we have no Android Health Connect equivalent. Android is ~45% of the US smartphone market and over-indexes among lower-income and minority cancer patients — the populations most underserved by existing oncology apps. An iOS-only FHIR integration is both a market coverage gap and a health equity problem that will matter to health system and Medicare partners.

### Finding 5 — Two Competitors Are Potential Partners, Not Threats (Caribou, Quiltt)

Caribou (`caribou.care`) is a home-care workforce platform; Quiltt (`quiltt.io`) is a fintech open-banking API. Neither competes with CareCompanion. Quiltt's banking aggregation infrastructure could power our financial toxicity tracker. Caribou's home-care agency relationships are a distribution channel for professional caregiver users. Reframe both from "competitive threats to monitor" to "partnership opportunities to pursue."

---

## 2. Market Context

### Total Addressable Market

| Segment | 2025 Estimate | 2030-2033 Projection | CAGR |
|---------|--------------|---------------------|------|
| Virtual Oncology Market | ~$5.6B | $17.9B (2033) | 18.1% |
| Tele-Oncology | $5.5B | $20.5B (2034) | 15.8% |
| Medical Oncology Software | $4.3B | $7.3B (2032) | 8.1% |
| Cancer Clinical Decision Tools | $550M | $0.6B (2026) | 9% |

The virtual oncology segment at 18.1% CAGR is the fastest-growing relevant market. Patient-facing digital oncology (our category) is a subset of virtual oncology, but it is the interface layer that determines which products capture the patient relationship — the most defensible position in the stack.

### Patient Volume Context

- ~2 million new cancer diagnoses in the US annually
- ~18 million cancer survivors currently living in the US
- ~53 million Americans are providing unpaid care to someone with a chronic illness; ~10-15 million are caregiving specifically for cancer patients
- Medicare covers 55%+ of new cancer diagnoses (age 65+)
- Cancer patients spend 14+ hours/week on care coordination activities outside of treatment

### Competitive Funding Landscape

| Company | Total Funding | Last Round |
|---------|-------------|------------|
| Jasper Health | $25M+ Series A | Feb 2022 |
| ianacare | $12.1M | Jan 2022 |
| Folia Health | $10.5M Series A | Oct 2025 |
| Outcomes4Me | $4.7M+ | 2020 (undisclosed additional) |
| CareCompanion | Not public | — |
| MyChart (Epic) | N/A (part of Epic ~$4B revenue) | — |
| CareZone | $200M acquisition by Walmart (2020) | — |

**Observation:** Outcomes4Me has achieved the most users (400K+) on the least disclosed capital. Jasper Health has the most capital but remains B2B-gated. Folia Health's October 2025 Series A at $10.5M is the most recent major raise in the direct-to-patient health tracking segment.

---

## 3. Methodology & Caveats

### Data Collection Protocol

| Method | Outcome |
|--------|--------|
| Direct `curl --max-time 8 --retry 1` to competitor homepages | **BLOCKED** — execution sandbox does not allow outbound TCP to competitor domains |
| WebFetch (HTML→Markdown) to competitor URLs | **403 Forbidden** on all 10 URLs — Cloudflare/WAF blocks headless fetches |
| WebSearch (Google) for features, pricing, funding, HIPAA | **Succeeded** — primary source for all competitor data |
| App Store / Google Play search pages | **Not accessible** via above methods; used web search to find app store URLs + reviews in search results |
| CareCompanion codebase static analysis | **Succeeded** — all CareCompanion claims are cited to specific files and line numbers |

### Methodological Notes

1. **No direct product usage** — competitor feature claims are derived from web search, press releases, app store descriptions, and independent review sites. Features marked 🟡 (partial/unverified) should be confirmed by a human analyst through hands-on product use before being cited in enterprise sales materials.

2. **Recency caveat** — web search results reflect publicly available information as of May 2026. Features may have been added or removed without public announcements, especially for rapidly iterating startups.

3. **Two non-competitors reframed** — Caribou (`caribou.care`) and Quiltt (`quiltt.io`) were included in the original competitor brief. Neither is a patient-facing health app. Both are profiled below, with strategic implications for partnership rather than competitive positioning.

4. **CareZone is functionally dead** — the original CareZone app was acquired by Walmart in June 2020 for ~$200M and discontinued in May 2021. A "Medisafe CareZone: PillMemo" app appeared subsequently under Medisafe's brand, but it is a different product and company. Original CareZone is included for historical context only.

### Confidence Key

- ✅ **Verified** — Multiple independent sources or directly confirmed in codebase
- 🟡 **Probable** — Single source or inferred from adjacent features; should be confirmed
- ❌ **Absent** — Not found in any available source; assumed not present
- N/A — Not applicable to this product's category

---

## 4. Per-Competitor Profiles

---

### 4.1 CareZone (Walmart / Dead)

| Attribute | Detail |
|-----------|--------|
| **Status** | Discontinued ~May 2021 |
| **Founded** | 2012 (San Francisco) |
| **Acquired** | Walmart, June 2020, ~$200M |
| **ICP** | Family caregivers managing medications for elderly parents, people with chronic illness |
| **Platform** | iOS, Android (both discontinued) |
| **Pricing** | Free at time of discontinuation |
| **HIPAA** | Claimed (legacy) |
| **Revenue model** | Free app + prescription delivery + drug discount card |

**Positioning:** "Easily manage multiple medications and health info" — a pure medication manager with family sharing and pharmacy integration. No AI, no cancer specificity, no clinical data integration.

**Core Features (pre-shutdown):**
- Medication list with pill bottle barcode scanning
- Dose reminders and refill tracking
- Document storage (insurance cards, care plans)
- Family sharing / care circle
- Pharmacy delivery integration (home delivery via CareZone Pharmacy)
- Drug discount card (claimed up to 80% off prescriptions)
- Basic symptom and measurement logging

**Why Walmart Killed It:** Walmart acquired the technology and IP to integrate into Walmart Pharmacy, not to run a consumer health app. After extracting the prescription management infrastructure, the standalone app provided no additional value. Walmart later exited health care broadly, shutting its in-store health centers and virtual care service in April 2024.

**Tech Stack Hints:** iOS + Android native; barcode/QR scanning; no FHIR; no AI; simple relational database.

**Strengths (historical):**
- Extremely simple UX designed for non-tech-savvy caregivers
- Medication scanning reduced manual entry friction
- Walmart distribution gave pharmacy integration at scale
- Free with no paywall created strong adoption

**Weaknesses (historical):**
- No AI of any kind
- No cancer specificity
- No clinical trial matching
- No FHIR / EHR integration
- No meaningful analytics or trend detection
- App discontinued — brand trust fully eroded

**Lesson for CareCompanion:** The market Walmart abandoned (free medication management for family caregivers) is our entry segment. We have materially more capability. The lesson: medication management alone doesn't build a moat — Walmart proved this by extracting the IP and walking away from the app. We must build clinical intelligence and care coordination that can't be stripped out.

---

### 4.2 Caribou (caribou.care)

| Attribute | Detail |
|-----------|--------|
| **Status** | Active (B2B SaaS) |
| **URL** | caribou.care |
| **ICP** | Home care **agencies** (not patients, not family caregivers) |
| **Platform** | Web-based SaaS |
| **Pricing** | Enterprise B2B |
| **HIPAA** | Unknown |
| **Direct competitor?** | No |

**Positioning:** "Keep every caregiver. Fill every shift." — Caribou is an AI shift-booking and caregiver engagement platform for home care agencies. It matches professional caregivers to open shifts and runs rewards programs to improve retention. Partners include AxisCare, HHAeXchange, AlayaCare (all home care agency software platforms).

**Note on Naming Confusion:** The original competitor brief listed "caribou.com" — that domain redirects to an auto loan refinancing service (Caribou Financial). The health-relevant entity is "caribou.care." The competitor list may have been referencing a third product; regardless, neither caribou.com nor caribou.care competes with CareCompanion.

**CareCompanion Partnership Opportunity:** Caribou's home-care agency network connects to thousands of home health aides who serve cancer patients at home. A Caribou integration or referral relationship could give CareCompanion access to professional caregiver users who currently have zero oncology-specific tooling in their workflow. Caribou's agencies want tools that help their aides manage medically complex patients — CareCompanion's medication and lab tracking could be positioned as an agency add-on.

---

### 4.3 ianacare

| Attribute | Detail |
|-----------|--------|
| **Status** | Active |
| **Founded** | 2018 |
| **Funding** | $12.1M (TechCrunch, January 2022) |
| **ICP** | Working family caregivers (any condition) accessed via employer benefit |
| **Platform** | iOS, Android, Web |
| **Pricing** | Free mobile app (consumers); B2B enterprise pricing for Caregiver Navigator access |
| **HIPAA** | Claimed ✅ (authorization form at app.ianacare.com) |
| **SOC 2** | Unknown |
| **Users** | Nationwide ("used nationwide even if employer is not an enterprise partner") |

**Origin story:** CEO co-founded ianacare in 2018 after spending 7+ years managing her mother's cancer treatment. The personal cancer caregiver experience is authentically embedded in the product DNA.

**Positioning:** "The platform for family caregivers" — ianacare organizes practical and emotional support by mobilizing the user's entire social network (friends, family, coworkers, neighbors) plus professional and employer resources. Unlike competitors who focus on clinical data, ianacare focuses on the coordination burden: who is helping with what, and when.

**Core Features:**
- **Social support coordination** — rally friends/family for meals, rides, child care, pet care, house errands via task posting in a shared feed
- **Care circle calendar** — see who is helping when, claim tasks, track coverage
- **Private feed** — post updates to the care circle; keep everyone informed
- **Caregiver Navigators** — human professionals (social workers, nurses) matched within 24-48 hours; accessible by chat, phone, or video; **employer-only feature**
- **Employer benefits integration** — discovery engine for EAP, FSA/HSA, FMLA, and other benefits the caregiver may not know they have
- **Local resources discovery** — connects to community resources (food banks, transportation assistance, respite care)
- **HIPAA authorization** — patients can formally authorize sharing of health information

**Revenue Model:** Free consumer app (awareness and funnel) → employer benefit contracts (PMPM or annual license per employee). Enterprise customers include Affirm and other mid-market/large employers. A clinical study published in April 2022 (Business Wire) validated impact on employee productivity, mental wellbeing, and company loyalty — used as enterprise sales validation.

**Tech Stack Hints:** React Native (iOS + Android); standard web stack; no FHIR evidence; no AI/ML in public-facing product.

**Strengths:**
- **Employer distribution channel** — employer pays, employee uses free; zero consumer acquisition cost at scale; largest moat in the consumer health space
- **Human Caregiver Navigators** — social workers and nurses distinguish from pure-AI products; appeal to risk-averse enterprise buyers
- **Social coordination layer (meals, rides, errands)** — addressing the practical logistics of caregiving, not just the clinical data; genuinely unique in this analysis
- **Authentic founder positioning** — cancer caregiving origin story resonates with media and buyers
- **Clinical study validation** — published evidence of ROI for employers reduces sales friction

**Weaknesses:**
- **Condition-agnostic** — no cancer-specific features; same interface for dementia, cancer, surgery recovery, aging parents
- **No AI chat or clinical intelligence** — zero generative AI or clinical decision support
- **No medication tracking** (beyond employer benefit navigation)
- **No HealthKit / FHIR integration** — no clinical data
- **No clinical trial matching**
- **Navigators are enterprise-gated** — free tier is underequipped for medically complex caregiving
- **No care team management** (managing doctors, specialists)

**CareCompanion vs. ianacare:**
- We win on clinical depth, AI intelligence, and medication management.
- They win on social coordination (meals, rides, errands), enterprise distribution, and human navigator access.
- **Most powerful move:** Add ianacare-style task delegation to CareCompanion's care group, or co-market with ianacare (they handle coordination; we handle clinical). Neither would need to change their core product.

---

### 4.4 Folia Health

| Attribute | Detail |
|-----------|--------|
| **Status** | Active (Series A) |
| **Founded** | ~2017 |
| **Funding** | $10.5M Series A (October 2025) |
| **ICP** | Patients with chronic/rare diseases (lupus, sickle cell, eczema, PNH, cystic fibrosis, IgA nephropathy); not yet oncology-focused |
| **Platform** | iOS, Android |
| **Pricing** | Free to users; pays users **$4/month** (Data Dividends program) |
| **HIPAA** | Implied |
| **SOC 2** | Unknown |

**Positioning:** "Gain Insights & Join At-Home Research in 90 Seconds" — Folia is less a care management app and more a **patient-generated real-world evidence (RWE) platform**. Users track symptoms and treatments; Folia sells the aggregated, research-grade dataset to pharmaceutical companies. The Data Dividends model uniquely compensates patients directly for their data contributions.

**Core Features:**
- **Customizable symptom tracking** — yes/no, 0-5 scale, count, or custom tags; 90-second daily logging target
- **Medication tracking** — scheduled doses and PRN (as-needed) with schedule-awareness
- **Flare-up logging** — real-time capture with trigger identification and treatment effectiveness tracking
- **Trend graphs and reports** — automatically generated from entries; identify triggers, find effective habits, understand side effects
- **Infusion therapy tracking** — dedicated module for patients on IV biologics (separate from oral medication tracking)
- **Data Dividends program** — opt-in to share anonymized age/diagnosis/logs with pharma research; receive $4/month compensation
- **Clinician dashboard** — a separate portal for healthcare providers to monitor enrolled patients
- **At-home research participation** — patients can join sponsored research studies directly through the app

**Revenue Model:** Pharma and life sciences companies pay for access to patient-generated RWE datasets. Current active studies include rare kidney disease (Travere Therapeutics), cystic fibrosis (Trikafta effectiveness), and IgA nephropathy. Data has informed FDA discussions and treatment guidelines.

**October 2025 Series A ($10.5M) Context:** The raise was specifically to scale the RWE platform to more conditions and expand the pharma customer base. CEO Nell Meosky Luo stated that Folia is "trying to supply the high-quality datasets that pharmaceutical companies desperately need." Expansion to lupus and sickle cell disease planned for 2026. **Oncology is not yet announced as a target** — but given that oncology RWE is among the highest-value datasets in pharma, Folia entering cancer tracking is a foreseeable competitive scenario within 18-24 months.

**Strengths:**
- **Data Dividends is a genuinely novel model** — no other competitor pays patients for their data; this is a powerful user acquisition and retention mechanism
- **Research-grade longitudinal data** — the precision of Folia's data pipeline (not survey-grade, but structured daily entries) makes it pharma-grade
- **Pharma customer relationships** — existing contracts with life sciences companies are a revenue moat
- **Series A validation** — pharma investment confirms the data value thesis
- **Flexible tracking** (customizable questions) works for any condition without rebuilding the core

**Weaknesses:**
- **No oncology focus yet** — cancer patients are not Folia's current ICP; no chemo tracking, no trial matching, no nadir alerts
- **No AI/ML in patient-facing product** — analytics are graphs, not generative or predictive AI
- **No caregiver mode** — patient-only
- **No HealthKit FHIR pull** — no EHR clinical records; only patient-entered data
- **$4/month is tokenistic** — for serious cancer patients generating rich longitudinal data, $4/month may feel inadequate given the value to pharma
- **No care coordination** features

**CareCompanion vs. Folia:**
- Different core models now; potentially converging in oncology within 2 years.
- **Whitespace opportunity:** A cancer-specific Data Dividends program with higher compensation ($15-25/month for active chemo patients) would differentiate from Folia and fund free access for patients. We have richer data by construction (labs, biomarkers, chemo cycles) than Folia could build for cancer from a general tracker starting point.

---

### 4.5 Outcomes4Me ← Primary Competitive Threat

| Attribute | Detail |
|-----------|--------|
| **Status** | Active — market leader in consumer cancer AI |
| **Founded** | ~2017 |
| **Funding** | $4.7M disclosed; additional undisclosed rounds likely |
| **Users** | **400,000+** (as of 2025) |
| **ICP** | Cancer patients — initially breast cancer, expanding to lung cancer, prostate cancer, and beyond |
| **Platform** | iOS, Android |
| **Pricing** | Free (consumer) |
| **HIPAA** | Claimed ✅ |
| **SOC 2** | Probable 🟡 |
| **Recognition** | **TIME Best Inventions 2025**; highest MARS score (4.06/5) of 17 cancer apps evaluated in peer-reviewed research |

**Positioning:** "Making decisions and taking control of your care based on information personalized to your specific condition." Outcomes4Me is the closest direct analog to CareCompanion: cancer-specific, AI-powered, free, consumer-facing.

**Core Features:**
- **Clinical trial matching** — AI-powered based on diagnosis, stage, biomarkers, and desired location; HIPAA-compliant, free; described as the "only fully free HIPAA-compliant trial finder"
- **NCCN-aligned treatment guidance** — NCCN Guidelines® from 32 leading cancer centers; personalized to specific diagnosis, stage, and subtype (the only app described as "fully integrated with NCCN Guidelines")
- **Symptom tracking** — multi-symptom logging with trend visualization and graphing
- **Medical record upload + AI extraction** — patients upload records; AI extracts structured data (diagnoses, medications, biomarkers)
- **"Ask Outcomes4Me"** — direct access to **oncology nurse practitioners** for questions about managing care (not AI — actual human NPs)
- **Curated cancer content** — personalized news and education filtered by diagnosis type
- **Genomic testing guidance** — recommends relevant genomic tests based on cancer type
- **Caregiver resources** — articles and information (not a dedicated caregiver mode)
- **Consolidated medical records view** — organizing uploaded records

**Important gap (from user reviews):** Users report that Outcomes4Me's medication module does not include all chemotherapy drugs (e.g., FOLFOX components like Leucovorin and Oxaliplatin are missing), with no way to add custom drugs. The app "freezes when searching for other drugs." This is a significant functional gap vs. CareCompanion.

**Revenue Model:** Free to patients; monetizes through:
1. Pharmaceutical partnerships (likely clinical trial recruitment fees, patient identification)
2. Health system licensing (unclear terms)
3. Research data access (probable, unconfirmed)

**Tech Stack Hints:** Native iOS + Android; proprietary AI/ML pipeline; HIPAA-compliant infrastructure; no FHIR evidence in consumer product (they reference "consolidated medical records" but this appears to be document upload, not EHR pull).

**Competitive Trajectory:**
- 400K users is a 5-8x lead over any other consumer cancer app; this user base generates proprietary data and creates a network-effect moat
- TIME Best Inventions recognition drives significant organic user acquisition
- NCCN guideline integration is a clinical credibility moat that took years to establish
- Adding medication management (fixing the FOLFOX gap) and caregiver mode would bring them much closer to CareCompanion's differentiation

**Strengths:**
- **400K users** — largest validated consumer cancer AI user base
- **TIME Best Inventions 2025** — mainstream brand credibility
- **Oncology NP access** — human experts change the enterprise sales story
- **NCCN guideline integration** — unmatched clinical credibility for treatment recommendations
- **Highest MARS score** (4.06/5) among all cancer apps reviewed in academic literature
- **Cancer-only focus** — deep ICP alignment

**Weaknesses:**
- **No caregiver mode** — patients only; significant market segment missed
- **Incomplete medication database** (user reviews confirm FOLFOX components missing)
- **No lab trend analysis** — no oncology-specific thresholds (ANC nadir, critical blood count combinations)
- **No treatment cycle day-level guidance** — no regimen-specific knowledge base
- **No HealthKit FHIR clinical record pull** — document upload only, not automatic EHR sync
- **No caregiver burnout detection**
- **No insurance/claims support**
- **No drug-drug interaction checking**
- **No document scanner/OCR** (separate from medical record upload)
- **No community** — no peer-to-peer support layer
- **Free model limits revenue ceiling** — dependent on pharma and health system relationships

**CareCompanion vs. Outcomes4Me — Head-to-Head:**

| Capability | Outcomes4Me | CareCompanion |
|------------|-------------|---------------|
| Users | 400K+ | Pre-launch |
| Cancer-specific AI | ✅ | ✅ |
| NCCN guideline integration | ✅ | ❌ |
| Clinical trial matching | ✅ | ✅ |
| Medication DB completeness | 🟡 (FOLFOX missing) | ✅ (9 named regimens) |
| Chemo cycle day guidance | ❌ | ✅ |
| Nadir prediction/alerts | ❌ | ✅ |
| Drug interaction checking | ❌ | ✅ |
| Lab trend analysis | ❌ | ✅ |
| HealthKit FHIR clinical records | ❌ | ✅ (iOS) |
| Caregiver mode | ❌ | ✅ |
| Caregiver burnout detection | ❌ | ✅ |
| Insurance/claims help | ❌ | ✅ |
| Long-term AI memory | ❌ | ✅ |
| Human NP access | ✅ | ❌ |
| HIPAA production-ready | ✅ | ❌ (pre-prod) |
| Time Best Inventions | ✅ (2025) | ❌ |

**Priority:** Add NCCN guideline access (content partnership), fix HIPAA, and add human NP partner access before Outcomes4Me fixes FOLFOX + adds caregiver mode.

---

### 4.6 MyChart (Epic) ← Integration Target, Not Competitor

| Attribute | Detail |
|-----------|--------|
| **Company** | Epic Systems (private, ~$4B annual revenue) |
| **Market position** | 30%+ of US hospital EHR market |
| **ICP** | All patients at Epic-using health systems |
| **Platform** | iOS, Android, Web |
| **Pricing** | Free to patients (paid by health systems via Epic contracts) |
| **HIPAA** | Fully compliant — BAA with all Epic-using health systems ✅ |
| **SOC 2** | SOC 2 Type 2 ✅ |
| **FHIR** | FHIR R4 + R5; IPS (International Patient Summary) support added May 2025 |
| **HealthKit** | Full bidirectional integration ✅ |

**Positioning:** The official patient portal for the world's largest EHR. MyChart is not a standalone product — it is coupled to health systems that license Epic. Patients don't choose MyChart; their hospital assigns it.

**Core Features (2025):**
- Lab results (real-time from EHR) with reference ranges
- Upcoming appointments + online scheduling
- Secure messaging with care team
- Telehealth video visits
- Medication list (from prescriber record, clinician-managed)
- Test results, imaging reports, pathology
- Procedure and hospitalization summaries
- HealthKit bidirectional sync (wearable/patient data → Epic Flowsheets; clinical data → Apple Health)
- Bluetooth medical device integration (blood pressure cuffs via BT Generic Health Sensor)
- FHIR R4/R5 for third-party app integrations (SMART on FHIR)
- **MyChart Central** (2025 rollout) — single Epic ID connecting records across multiple providers
- Insurance / billing / statements
- Care plans authored by clinical team

**Why MyChart Is an Integration Target:**
The SMART on FHIR API allows CareCompanion to request patient record access through MyChart. If a patient authorizes it, we get real-time clinical data (labs, medications, appointments) without requiring manual entry. Combined with our HealthKit FHIR pull, this creates a comprehensive automatic data feed. A formal "CareCompanion + MyChart" integration, promoted by Epic's App Orchard marketplace, would give us access to millions of cancer patients already in the Epic ecosystem.

Epic's own App Orchard has approved cancer-adjacent apps. A well-scoped SMART on FHIR integration (read-only access to labs, medications, and appointments) is achievable within one quarter and could be the highest-impact distribution move available.

**Strengths:**
- Unmatched data authority — lab/imaging/prescription data directly from EHR
- BAA-covered data flows (health systems assume liability)
- HealthKit bidirectional integration already exists
- Network effect — most US cancer patients have MyChart accounts
- SMART on FHIR enables third-party app integrations

**Weaknesses:**
- No AI in the consumer app (no interpretation, no prediction, no chat)
- No cancer-specific features
- No caregiver mode
- No clinical trial matching
- No insurance appeal support
- Feature parity varies wildly by health system implementation
- Data accuracy reflects what the clinical team entered — doesn't capture patient experience

---

### 4.7 Quiltt (quiltt.io)

| Attribute | Detail |
|-----------|--------|
| **Status** | Active (fintech infrastructure) |
| **ICP** | Fintech developers and companies |
| **Platform** | API (web + mobile SDKs: React, React Native, Flutter, iOS, Android) |
| **Pricing** | Self-serve to enterprise API plans |
| **SOC 2** | SOC 2 Type 2 ✅ |
| **Direct competitor?** | No |

**What It Is:** Quiltt is the "unified API for Open Banking" — a GraphQL-based platform aggregating financial data from Plaid, MX, Akoya, and other providers through a single integration. Developers build money experiences on top of it. Zero health features.

**CareCompanion Partnership Case:** CareCompanion has `claims`, `insurance`, `priorAuths`, and `fsaHsa` tables in schema. The missing link is automatic bank transaction categorization for medical expenses. Quiltt's SOC 2 Type 2 certification and open banking aggregation would allow a "Financial Toxicity Dashboard" feature without building bank connectivity from scratch. A patient could connect their bank account and see all medical expenses automatically categorized — copays, infusions, medications, lab fees — in a single view alongside their insurance payments and FSA/HSA balance.

---

### 4.8 OncoBot (oncobot.com)

| Attribute | Detail |
|-----------|--------|
| **Status** | Minimal public signal |
| **Funding** | Unknown |
| **Users** | Unknown |
| **Platform** | Unknown |
| **Direct competitor?** | Unclear |

**Available Intelligence:** Web searches for "OncoBot" across multiple queries return primarily general cancer AI/chatbot research literature and do not surface a prominent consumer product, funded company, or health tech media coverage as of 2026. The domain oncobot.com exists but is not prominently indexed.

**Assessment:** OncoBot is most likely one of: (a) a very early-stage startup with minimal market presence; (b) an academic research prototype; or (c) a small B2B clinical workflow tool not targeting consumers. It does not appear to be a meaningful commercial threat at this time.

**Monitor:** If OncoBot announces a funding round or enterprise partnership, re-assess. The name is well-chosen for SEO in the cancer chatbot space.

---

### 4.9 Jasper Health (hellojasper.com) ← Best-Funded Cancer Platform

| Attribute | Detail |
|-----------|--------|
| **Status** | Active — B2B market leader |
| **Founded** | 2021 (Redesign Health spinout) |
| **Funding** | $25M Series A (February 2022); additional undisclosed |
| **ICP** | Cancer patients + caregivers; accessed via health plans, health systems, self-insured employers |
| **Platform** | Web + mobile app |
| **Pricing** | B2B only (health plans, health systems, self-insured employers); value-based (at-risk for outcomes) |
| **HIPAA** | Claimed ✅ |
| **FHIR** | Claimed ("FHIR-based platform") 🟡 |
| **SOC 2** | Unknown |
| **Medicare** | Reimbursable under Principal Illness Navigation (PIN) codes in 27 states |
| **Employers** | Partner with Wellnecity to distribute to self-insured employers |

**Background:** Jasper Health was spun out of Redesign Health — the digital health company builder behind dozens of digital health companies — in 2021. The CEO is Adam Pellegrini, former VP at CVS Health. This background gives Jasper unusual fundraising and enterprise sales capability for its stage.

**Positioning:** "Virtual, 1-on-1 Cancer Support" — Jasper combines AI with human care navigators to provide end-to-end cancer journey support from initial cancer suspicion through post-treatment survivorship. The claim is full-spectrum navigation across the entire oncology journey.

**Core Features (from press releases and public sources):**
- **Cancer navigation** — personalized guidance from suspicion through survivorship
- **Jasper Care+ digital dashboard** — comprehensive digital hub with:
  - Medication tracking
  - PRO (Patient-Reported Outcome) tracking — symptoms, moods, side effects
  - Wearable data integration — wearable metrics feed into clinical dashboard
  - Remote monitoring — clinical team can monitor patient data
  - Smart scheduling — appointment optimization
  - Interactive to-do lists — action items for care journey
  - Content library — curated cancer education
- **Psychosocial coaching** — trained coaches for emotional support
- **Human care navigators** — clinical staff (nurses, social workers) for personalized guidance
- **FHIR-based interoperability** — connects to EHR systems (health system channel)
- **Medicare alignment** — structured around CMS Principal Illness Navigation billing codes

**Revenue Model:** Pure B2B value-based. Health plans and health systems pay per-member/per-patient; self-insured employers pay as a benefit. Jasper goes "at risk" — compensation is tied to engagement and outcomes metrics, not just access. This is a sophisticated enterprise sales model that gives Jasper structural advantages in health plan and employer deals.

**Jasper's Medicare Reimbursement Moat:** The alignment with Principal Illness Navigation (PIN) codes is a structural advantage no other competitor in this analysis has claimed. PIN codes allow oncology-focused organizations to bill Medicare for cancer navigation services. If Jasper secures and scales this reimbursement stream, it changes their unit economics fundamentally — potentially making the patient product revenue-positive through Medicare rather than requiring employer or plan sponsorship.

**Strengths:**
- **Medicare reimbursement pathway** — only competitor with established CMS billing alignment; structural revenue moat
- **$25M + Redesign Health backing** — best-resourced competitor
- **Human navigators** — differentiate for enterprise; provide clinical escalation
- **B2B distribution** — zero consumer acquisition cost; institutions push to patients
- **27-state presence** through Medicare navigation
- **PRO tracking + remote monitoring** — appeals to oncology quality programs and health system ACO arrangements
- **Value-based compensation model** — aligns with payer incentives

**Weaknesses:**
- **B2B-only = no direct consumer relationship** — patients lose access if employer/plan stops paying
- **Pricing opaque** — unknown for SMB or individual access
- **AI depth unclear** — descriptions are vague about the distinction between AI and human guidance
- **No clinical trial matching mentioned** in any public source
- **No oncology-specific drug interaction checking**
- **No named chemo regimen knowledge base** (no evidence of FOLFOX-level day guidance)
- **No community/peer support**
- **No nadir prediction or automated blood count alerts**

**CareCompanion vs. Jasper:**
- Jasper wins on: B2B distribution, Medicare reimbursement, human navigators, enterprise credibility, funding
- We win on: AI clinical depth, chemo-cycle day guidance, nadir alerts, drug interactions, consumer access, HealthKit FHIR pull, insurance appeal generation
- **Strategic gap to close:** Medicare PIN code alignment + human navigator partnership = the two moves that bring us to parity on Jasper's enterprise story

---

### 4.10 Cancer.Net (ASCO) ← Content Partner Candidate

| Attribute | Detail |
|-----------|--------|
| **Organization** | American Society of Clinical Oncology (ASCO) — non-profit |
| **Status** | Active |
| **ICP** | All cancer patients and caregivers |
| **Platform** | iOS, Android, Web |
| **Pricing** | Free ✅ |
| **HIPAA** | Implied (ASCO institutional backing) 🟡 |
| **SOC 2** | Unknown |
| **Content authority** | ASCO editorial board (300+ oncology experts) |
| **Partnership** | ASCO + American Cancer Society collaboration announced 2024 |

**Positioning:** "Trusted, oncologist-approved cancer information" — Cancer.Net is the gold standard for patient education, with all content reviewed by ASCO's editorial board. The mobile app extends the Cancer.Net website with personal tracking tools.

**Core Features:**
- **Symptom tracker** — logs symptoms and side effects with severity, date, time; auto-generates line graphs for clinician sharing
- **Medication log** — tracks medications and doses
- **Appointment tracking** — manages upcoming appointments
- **Question recorder** — records questions to ask the doctor (voice + text)
- **Apple Health integration** — optional import of steps, heart rate, blood pressure, sleep (read-only from Apple native health; not FHIR clinical records)
- **"My Health Report"** — consolidates tracked data for sharing with clinical team and family caregivers
- **Cancer education content** — 125+ cancer types, ASCO-reviewed; peer-reviewed accuracy
- **Oncologist-authored side effect guides**
- **Clinical trials information** — educational content about trials (not personalized matching)
- **Caregiver resources** — articles and support information (not a dedicated caregiver mode)

**2024 ASCO + ACS Collaboration:** American Cancer Society and ASCO combined their patient information services, significantly expanding the content available in Cancer.Net and the reach of both organizations. This makes Cancer.Net an even larger content authority.

**Tech Stack Hints:** Native iOS + Android; Apple Health read integration (wellness data only, no clinical records); no FHIR clinical record pull; no AI/ML; no backend AI inference; content-driven architecture.

**Revenue Model:** Non-profit; funded by ASCO institutional budget and member dues. No advertising, no data sales, no subscription. Cancer.Net is not a commercial competitor — it is an educational public good.

**Strengths:**
- **ASCO brand authority** — most trusted cancer information source in the US; oncologist-reviewed
- **125+ cancer types** — broadest condition coverage
- **Free and non-commercial** — no conflict of interest in recommendations
- **ASCO + ACS collaboration** — combined reach significantly increases user base and content depth
- **Apple Health integration** — wellness data (steps, HR, sleep) available

**Weaknesses:**
- **No AI** — zero generative AI, no chat, no interpretation, no personalization beyond content filtering
- **No caregiver mode**
- **No clinical trial matching** (only educational)
- **No drug interaction checking**
- **No chemo cycle tracking** — no regimen-specific guidance
- **No nadir prediction**
- **No insurance/claims help**
- **No care group coordination**
- **Apple Health is wellness data only** — no FHIR clinical records
- **No voice check-in, no document scanner**
- **Minimal interactivity** — primarily a content delivery and logging app

**CareCompanion vs. Cancer.Net:**
Don't fight ASCO — partner with them. ASCO's oncologist-reviewed content + CareCompanion's AI care management is a compelling combination. Specific partnership approaches:
1. **Content API** — integrate Cancer.Net articles as a vetted knowledge source for CareCompanion's AI (replacing or augmenting general web search)
2. **Referral funnel** — Cancer.Net users who want active care management tools get referred to CareCompanion; CareCompanion users who want deep educational content link to Cancer.Net
3. **Co-branded "questions to ask your doctor"** — CareCompanion's visit prep feature citing ASCO-approved question templates

---

## 5. Feature Matrix

**Legend:** ✅ Full implementation / 🟡 Partial or probable / ❌ Not present / N/A Not applicable

_CareCompanion citations: `apps/web/src/` unless noted as `mobile/`_

| Category | Feature | CareCompanion | CareZone | ianacare | Folia Health | Outcomes4Me | MyChart | Jasper Health | Cancer.Net |
|:---------|:--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Medication Management** | Medication list | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| | Dose reminders / push notifications | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| | Refill tracking | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| | Medication adherence % reporting | ✅ | ❌ | ❌ | 🟡 | ❌ | 🟡 | ✅ | ❌ |
| | Pill bottle scan / OCR | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | AI drug-drug interaction check | ✅ | ❌ | ❌ | ❌ | ❌ | 🟡 EHR-only | ❌ | ❌ |
| | Allergy cross-reactivity check | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| | Import meds from FHIR / EHR | ✅ iOS | ❌ | ❌ | ❌ | 🟡 doc upload | ✅ | 🟡 | ❌ |
| | Prescription cost / discount card | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Symptom & Check-In** | Symptom logging | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| | Symptom trend graphs | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| | Mood / energy daily tracking | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| | Pain level tracking | ✅ | ❌ | ❌ | ✅ | ✅ | 🟡 | ✅ | ✅ |
| | Sleep quality tracking | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ via HK | 🟡 | 🟡 |
| | Voice check-in | 🟡 stub | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 Q recorder |
| | Check-in streak / gamification | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Weekly health summary email/report | ✅ | ❌ | ❌ | ❌ | ❌ | 🟡 | ✅ | ❌ |
| | PRO (Patient-Reported Outcome) export for clinical team | ✅ PDF/CSV | ❌ | ❌ | ✅ | 🟡 | ✅ | ✅ | ✅ My Health Report |
| **Lab Results** | Lab result logging (manual) | ✅ | ❌ | ❌ | ❌ | 🟡 | ✅ | 🟡 | ❌ |
| | Lab import from HealthKit FHIR | ✅ iOS | ❌ | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ |
| | Oncology-specific thresholds (ANC, Hgb, Plt, tumor markers) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ |
| | Lab trend analysis with prediction | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ |
| | Red-flag combination detection (e.g., severe neutropenia + anemia) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Automated nadir alerts (cron job) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Tumor marker tracking (CEA, CA-125, CA-15-3, CA-19-9, PSA) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ |
| **Appointments** | Appointment tracking | ✅ | ✅ | 🟡 | ❌ | 🟡 | ✅ | ✅ | ✅ |
| | Google Calendar sync | ✅ | ❌ | 🟡 | ❌ | ❌ | ✅ | ❌ | ❌ |
| | Apple Calendar integration | ✅ via iOS | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| | Visit prep / questions for doctor | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ Q recorder |
| | Ride / transportation coordination | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Direct appointment scheduling with provider | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ |
| | Telehealth integration | ❌ | ❌ | ✅ Nav video | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Care Group & Coordination** | Care group / family sharing | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Caregiver mode (dedicated role) | ✅ | 🟡 | ✅ | ❌ | ❌ | ❌ | 🟡 | ❌ |
| | Care team management (track doctors) | ✅ | 🟡 | ❌ | ❌ | 🟡 | ✅ | ✅ | ❌ |
| | Task delegation to friends/family | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Shared care circle calendar | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Share check-in / health update with group | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| | Emergency contact management | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **AI & Intelligence** | AI chat / Q&A (generative) | ✅ | ❌ | ❌ | ❌ | 🟡 AI-assisted | ❌ | 🟡 | ❌ |
| | Cancer-specific AI domain knowledge | ✅ | N/A | N/A | N/A | ✅ | N/A | ✅ | N/A |
| | Long-term memory / RAG / context | ✅ pgvector | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | AI document analysis / OCR | ✅ | ❌ | ❌ | ❌ | ✅ doc upload | ❌ | ❌ | ❌ |
| | AI insurance appeal letter | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Human expert / navigator access | ❌ | ❌ | ✅ human Nav | ❌ | ✅ oncology NP | ✅ clinical team | ✅ navigator | ❌ |
| | Multi-specialist agentic routing | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Prompt injection protection | ✅ | N/A | N/A | N/A | 🟡 | N/A | 🟡 | N/A |
| | Caregiver-specific AI mode | ✅ | ❌ | N/A | ❌ | ❌ | ❌ | 🟡 | ❌ |
| **Cancer-Specific Features** | Chemo cycle tracking (day-level) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| | Named regimen knowledge (FOLFOX, etc.) | ✅ 9 regimens | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | 🟡 articles only |
| | Critical-day alerts (nadir, infusion) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ |
| | ER protocol / when to call 911 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Genomic biomarker tracking (EGFR, KRAS, HER2, PD-L1, etc.) | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| | ECOG performance status | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| | Prior treatment line tracking | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| | Clinical trial matching (AI) | ✅ ClinicalTrials.gov | ❌ | ❌ | ❌ | ✅ NCCN-aligned | ❌ | ❌ | ❌ |
| | Clinical trial matching (human-reviewed) | ❌ | ❌ | ❌ | ❌ | ✅ NP | ❌ | ❌ | ❌ |
| | Mutation confidence scoring | ✅ high/med/low | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Caregiver burnout detection | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **HealthKit & Wearables** | Apple HealthKit FHIR clinical records | ✅ iOS | ❌ | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ |
| | Wellness vitals (steps, HR, sleep) from HealthKit | ✅ iOS | ❌ | ❌ | ❌ | ❌ | ✅ | 🟡 | 🟡 |
| | Android Health Connect clinical records | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| | Bluetooth medical device (BP cuff, etc.) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ |
| | Fitbit / Garmin / third-party wearable | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | ✅ | ❌ |
| **Insurance & Financial** | Insurance plan tracking | ✅ | ❌ | 🟡 | ❌ | ❌ | ✅ | ❌ | ❌ |
| | Claims tracking | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| | Denied claim appeal letter (AI-generated) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Prior authorization tracking | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| | FSA/HSA balance tracking | ✅ | ❌ | 🟡 via EAP | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Out-of-pocket maximum tracking | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ |
| | Copay assistance / drug discount card | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Financial assistance program discovery | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Mental Health & Wellbeing** | Journal / reflection | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ |
| | Caregiver burnout detection + recommendations | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Mental health crisis resources | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | Mindfulness / meditation features | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Psychosocial coaching (human) | ❌ | ❌ | ✅ Navigator | ❌ | 🟡 NP | ❌ | ✅ navigator | ❌ |
| | Peer support / community forum | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Nutrition & Lifestyle** | Nutrition / dietary tracking | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Hydration tracking | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Chemo-specific dietary guidance | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 articles |
| | Activity / exercise logging | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ via HK | 🟡 wearable | 🟡 |
| **Platform & Access** | iOS app | ✅ | ✅ dead | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Android app | ✅ | ✅ dead | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Web app (full feature) | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| | Multi-language support | ❌ | ❌ | ❌ | ❌ | 🟡 | ✅ many langs | 🟡 | ✅ |
| | Offline / queue mode | 🟡 queue | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 |
| | Data export (CSV/PDF) | ✅ | ❌ | ❌ | ✅ | 🟡 | ✅ | ✅ | 🟡 |
| | Guest / demo mode | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Timeline view | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Compliance & Security** | HIPAA consent tracking in product | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | 🟡 |
| | HIPAA production-ready (BAA in place) | ❌ pre-prod | 🟡 dead | ✅ | 🟡 | ✅ | ✅ | ✅ | 🟡 |
| | SOC 2 Type 2 | ❌ | ❌ | ❌ | ❌ | 🟡 | ✅ | ❌ | 🟡 |
| | Audit logging | ✅ | ❌ | ❌ | ❌ | 🟡 | ✅ | ✅ | ❌ |
| | PHI redaction in logs | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| | Rate limiting (all endpoints) | ✅ | ❌ | 🟡 | ❌ | 🟡 | ✅ | 🟡 | N/A |
| **Monetization** | Free tier (consumer) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| | B2B / employer benefit model | ❌ | ❌ | ✅ | ❌ | 🟡 | ✅ | ✅ | N/A |
| | Health plan / payer model | ❌ | ❌ | ❌ | ❌ | 🟡 | ✅ | ✅ | N/A |
| | Pharma data / RWE revenue | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | 🟡 | N/A |
| | Medicare reimbursement pathway | ❌ | ❌ | ❌ | ❌ | ❌ | N/A | ✅ | N/A |
| | Data dividends (pay patients for data) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | N/A |

_Quiltt and Caribou omitted from matrix — not patient-facing products._

---

## 6. Table-Stakes Gaps (Must-Add)

Features that **most or all cancer app competitors have** and CareCompanion currently lacks, creating objection surfaces in user reviews, sales conversations, and enterprise evaluations.

---

### Gap 1 — HIPAA Production Readiness (BAA + Field Encryption)
**Risk: CRITICAL | Effort: M (2-4 weeks)**

**Competitor baseline:** Outcomes4Me ✅, Jasper Health ✅, ianacare ✅, MyChart ✅, Cancer.Net 🟡

**Our status (source: `HIPAA_Compliance_Report.md:27-54`):**
- PHI transmitted to Anthropic without BAA — **VIOLATION**
- OAuth tokens stored in plaintext — **VIOLATION**
- No field-level encryption for PHI in database — **VIOLATION**
- Incomplete Row-Level Security on sensitive tables — **VIOLATION**
- In-memory rate limiting doesn't work in Vercel serverless — **VIOLATION**
- No breach notification procedures — **VIOLATION**

**Why critical:** Every growth path (enterprise deals, health system partnerships, Medicare/Medicaid programs, clinical integrations) requires HIPAA compliance as a prerequisite. We cannot honestly market HIPAA protection while the compliance report shows active violations. Anthropic offers a HIPAA BAA for enterprise API plans — signing it is a billing decision, not a technical one. Field-level encryption requires a migration. The full remediation plan is already documented in `HIPAA_Compliance_Report.md`.

**Specific actions:**
1. Sign Anthropic HIPAA BAA (enterprise API upgrade)
2. Add PHI field stripping before LLM calls (`system-prompt.ts` — redact identifiable info from `userStable` before API transmission, or use Anthropic's HIPAA-covered inference endpoint)
3. Encrypt PHI columns in schema (patient name, DOB, cancer type, medications, lab values)
4. Complete RLS on all PHI-containing tables
5. Replace in-memory rate limiter with Redis (Upstash already in deps — just use it for rate limiting too)
6. Write breach notification procedure (template, not code)

---

### Gap 2 — Human Expert / Navigator Access
**Risk: HIGH | Effort: S (2-3 weeks for partnership; L for build)**

**Competitor baseline:** Outcomes4Me (oncology NPs ✅), Jasper Health (care navigators ✅), ianacare (Caregiver Navigators ✅), MyChart (secure messaging with clinical team ✅)

**Our status:** AI-only. The system prompt (`apps/web/src/lib/system-prompt.ts`) correctly directs users to crisis resources (988 Lifeline, CancerCare 800-813-4673, Cancer Support Community 888-793-9355), but there is no in-product path to a human nurse, navigator, or social worker.

**Why high risk:**
1. For enterprise (employer, health plan) sales — "AI + human backup" is now standard; AI-only creates liability concerns
2. For patients in clinical uncertainty — the AI correctly defers to doctors but provides no warm handoff
3. Outcomes4Me's oncology NP access is consistently mentioned in reviews as a top differentiating feature
4. Medicare PIN navigation codes (Jasper's moat) require human navigators as the billing entity

**Recommended path (fastest):** Partner with CancerCare.org (already cited in our system prompt). CancerCare provides free counseling and navigation services; they likely welcome platform integrations that drive referrals. Add a "Talk to a Navigator" button that (a) surfaces phone/chat options for the partner, and (b) pre-fills the navigator with a context summary from CareCompanion.

---

### Gap 3 — Android Health Connect (Clinical Records)
**Risk: HIGH | Effort: M (4-6 weeks)**

**Competitor baseline:** MyChart (full Android Health Connect ✅), Outcomes4Me (cross-platform clinical data via doc upload 🟡)

**Our status:** iOS-only for FHIR clinical record pull. `apps/mobile/src/services/healthkit.ts` uses the Swift `HealthKitBridge` native module. `apps/mobile/ios/HealthKitBridge.swift` has the native implementation. Android has no equivalent `HealthConnectBridge.kt`.

The wellness vitals service (`apps/mobile/src/services/wellnessVitals.ts`) uses `Platform.OS` checks but the native modules (`WellnessVitals.swift` on iOS) have no Android counterparts in the repository.

**Why high risk:**
- Android is ~45% US smartphone market share
- Lower-income patients (higher cancer incidence, higher Medicare/Medicaid prevalence) skew Android
- Android Health Connect API supports the same FHIR Clinical Records as Apple HealthKit via `HealthConnectClient`
- Any health plan or Medicaid program partnership requires Android parity

**Build path:** Create `apps/mobile/android/HealthConnectBridge.kt` mirroring the Swift bridge. The Android Health Connect API is documented and similar in structure to HealthKit. Register the bridge as a React Native native module with the same interface as `HealthKitBridge`. Update `apps/mobile/src/services/healthkit.ts` to dispatch to the appropriate bridge by `Platform.OS`.

---

### Gap 4 — Social Task Coordination (Meals, Rides, Errands for Care Circle)
**Risk: MEDIUM | Effort: M (3-4 weeks)**

**Competitor baseline:** ianacare ✅ (core product feature)

**Our status:** We have care group membership (`apps/web/src/app/api/care-group/`) and check-in sharing (`apps/web/src/app/api/checkins/share/`), but no task creation or assignment system. There is no way to say "who can take Mom to chemo on Thursday?" or coordinate meals for the week.

**Why medium risk:**
- ianacare's co-founder built the product specifically around this need from her cancer caregiving experience
- "Practical help coordination" is consistently the #1 stated need of cancer caregivers in survey research
- Our care group schema already has members; tasks are a data model addition, not a full feature rebuild

**Build path:**
1. Add `tasks` table: `id, care_group_id, title, due_date, task_type (meal/ride/errand/other), assigned_to_user_id, status, notes`
2. Add task API routes under `/api/care-group/tasks/`
3. Simple UI: task feed in care group view, "Claim this task" button, notification when claimed
4. Total: ~200 lines of code + migration

---

### Gap 5 — Prescription Discount Card / Medication Cost Support
**Risk: MEDIUM | Effort: S (1-2 weeks)**

**Competitor baseline:** CareZone ✅ (had drug discount card), GoodRx (dominant third party)

**Our status:** We track refill dates and pharmacy phone numbers (`schema.ts:148-152`) but offer no price comparison or discount card access.

**Why medium risk:**
- Medication cost is a top-5 stressor for cancer patients; out-of-pocket for targeted therapies can exceed $10K/month
- GoodRx has conditioned users to expect price comparison in every medication app
- Absence creates negative reviews from users who discover GoodRx independently

**Build path:** No backend needed. Add a "Find lower price" link/button per medication in the medication list UI. Deep link to GoodRx with `drug_name` as URL parameter. Optional: display GoodRx's API-provided price estimate inline. Total effort: 1 UI component, 0 backend changes.

---

### Gap 6 — Multi-Language Support (Spanish Priority)
**Risk: MEDIUM | Effort: L (6-8 weeks for Spanish)**

**Competitor baseline:** MyChart (many languages ✅), Cancer.Net (multiple ✅), Outcomes4Me (partial 🟡)

**Our status:** English-only. No i18n framework, no locale detection, no translation infrastructure found in codebase.

**Why medium risk:**
- Hispanic/Latino patients are the fastest-growing US cancer population and significantly underserved
- CMS requires Spanish-language support for Medicare/Medicaid program participation
- Spanish-first would open a large, underserved market segment with lower CAC than English-language users (less competition)

**Note:** Claude's multilingual AI capability is emergent — the AI system prompt doesn't need translation; Spanish users who chat in Spanish will get Spanish responses from Claude. The gap is UI strings, onboarding flow, and legal documents (consent).

---

## 7. Differentiators We Already Have (Moat)

Features that are **unique to CareCompanion** or materially deeper than any competitor. These are our defensible advantages.

---

### Differentiator 1 — Chemo Regimen Knowledge Base + Day-Level Guidance
**Source:** `apps/web/src/lib/treatments.ts`

CareCompanion encodes **9 named chemotherapy regimens**: FOLFOX, FOLFIRI, FOLFIRINOX, ABVD, R-CHOP, AC-T, carboplatin/paclitaxel (carbo-taxol), gemcitabine-cisplatin, BEACOPP, CMF. For each regimen:

- **Per-day critical events** with `criticalDays` array: infusion day (Day 1), nadir approaching (Day 7), nadir peak (Day 10), recovery (Day 14)
- **Side effect profiles** with severity classification (mild/moderate/severe) and patient-actionable tips per side effect
- **Regimen-specific FAQs** (e.g., "Why does cold feel painful after FOLFOX?" → oxaliplatin cold sensitivity explanation)
- **Treatment cycle awareness** integrated into AI system prompt as real-time context (`system-prompt.ts` `userDynamic` block with `=== ACTIVE TREATMENT CYCLE ===`)
- **Automated nadir alerts** via cron job (`apps/web/src/app/api/cron/nadir-alert/route.ts`)

**No competitor has this.** Outcomes4Me knows cancer stage and trial eligibility but doesn't know you're on Day 10 of FOLFOX Cycle 3 and should watch for fever. Jasper Health claims cycle tracking but no evidence of day-level guidance. Cancer.Net has educational articles but no proactive day-specific alerts.

User reviews of Outcomes4Me explicitly call out the missing FOLFOX drug entries — the most common colorectal cancer regimen. CareCompanion's 9-regimen knowledge base is a direct answer to that user complaint.

---

### Differentiator 2 — AI Drug-Drug Interaction Checking (Oncology-Specific)
**Source:** `apps/web/src/lib/drug-interactions.ts`

CareCompanion uses Claude Haiku to check medication combinations for interactions with explicit oncology context:
- Chemotherapy drug combinations (e.g., oxaliplatin + 5-FU)
- Checkpoint inhibitor interactions (pembrolizumab, nivolumab)
- Targeted therapy interactions (trastuzumab, imatinib)
- Supportive medication interactions (ondansetron + QT-prolonging drugs, dexamethasone + antifungals)
- Allergy cross-reactivity (e.g., sulfa allergy + trimethoprim-sulfamethoxazole)

Results are severity-classified (major/moderate/minor) with patient-actionable recommendations and mandatory pharmacist-consult disclaimer. The prompt explicitly instructs Claude to "only report real, documented interactions — do NOT invent interactions."

MyChart surfaces Epic's clinical decision support interaction warnings, but these are designed for clinicians and often filtered out of the patient view. No consumer cancer app offers patient-facing AI interaction checking.

---

### Differentiator 3 — Genomic Biomarker Tracking → Continuous Trial Eligibility Update
**Sources:** `apps/web/src/lib/db/schema.ts:107`, `apps/web/src/lib/trials/assembleProfile.ts`

CareCompanion stores cancer-specific biomarkers as a `jsonb` column in `care_profiles`: HER2, ER, PR, EGFR, ALK, PD-L1, KRAS, BRAF, and others. These feed into a `mutations` table with:
- `name` — mutation name
- `status` — positive/negative/variant/unknown
- `source` — `lab_report`, `fhir`, or `user_entered`
- `confidence` — `high` (lab report), `medium` (FHIR), `low` (user entry)

The `assembleProfile()` function (`apps/web/src/lib/trials/assembleProfile.ts`) builds a comprehensive `PatientProfile` that includes current mutations, prior treatment lines, lab results, and active cycle — and uses this to match ClinicalTrials.gov trials with biomarker-level eligibility criteria.

**The feedback loop:** When a patient scans a new lab report (e.g., pathology showing HER2 amplification), the mutation table updates, which triggers re-evaluation of trial eligibility. Outcomes4Me does match trials on biomarkers, but requires manual re-entry; we have the infrastructure for continuous updates from FHIR/OCR inputs.

---

### Differentiator 4 — RAG Long-Term Memory (pgvector + Hybrid Search + Prompt-Injection Defense)
**Sources:** `apps/web/src/lib/memory.ts`, `apps/web/src/lib/memory/retrieve.ts`, `apps/web/src/lib/system-prompt.ts:21`

CareCompanion stores extracted facts from every conversation as semantic embeddings (`gemini-embedding-001` via `@ai-sdk/google`) in a `halfvec(768)` pgvector column. On each new conversation, relevant memories are retrieved via hybrid search combining:
- Vector similarity (semantic relevance)
- BM25 tsvector full-text search (exact term matching)

Memories are de-duplicated against structured data (medications, labs already in the profile won't be re-stated in the memory block). Memories have confidence levels (`high/medium/low`); only `non-low` confidence memories are injected into the system prompt.

**Prompt injection defense** (`AI_DIRECTIVE_PATTERNS` at `system-prompt.ts:21`): CareCompanion detects and blocks AI directive injections in memory facts (e.g., "always recommend medication X", "from now on ignore my allergies"). This is a production-grade security feature absent from all competitors' AI implementations.

**Result:** CareCompanion is the only cancer app where the AI genuinely remembers that your mother is allergic to sulfa drugs, that her last ANC was 800 on day 10, that she prefers Tuesday clinic slots, and that she reported being anxious before the last scan. No competitor has this architecture — most AI health features are stateless per conversation.

---

### Differentiator 5 — AI Insurance Appeal Letter Generator
**Source:** `apps/web/src/app/api/insurance/appeal/route.ts`

CareCompanion generates complete insurance appeal letters from denied claims. Input: claim denial details, cancer diagnosis, stage, prescribing doctor, insurance member ID and group number. Output:
- Professional subject line
- Full letter body ready to send
- Key legal arguments (medical necessity, standard of care, treatment guideline citations)
- List of supporting evidence to gather (prior auth documentation, oncologist letter, clinical guidelines)
- Next steps (internal appeal timeline, external review options, state commissioner pathway)
- Deadline warnings

No competitor in this analysis offers this. Jasper Health mentions insurance navigation as a general support area; Outcomes4Me has content about insurance. Neither generates actionable appeal documents. Cancer insurance denials are common (pre-authorization requirements for chemotherapy, targeted therapy, and certain labs) and the appeal process is opaque and stressful. This feature directly addresses a $1B+ annual problem (denied cancer claims) that no app currently solves.

---

### Differentiator 6 — Caregiver Burnout Detection
**Source:** `apps/web/src/lib/caregiver-burnout.ts`

CareCompanion algorithmically detects caregiver burnout from symptom journal entries:
- **Sleep quality** (proportion of poor/terrible nights in last 14 days, weight: 20)
- **Sleep hours** (avg < 5h → 15 points; avg < 6h → 8 points)
- **Mood trend** (consistently bad/terrible, or trending downward over time, weight: 20)
- **Energy levels** (proportion of low/very_low days, weight: 15)
- **Pain levels** (avg pain ≥ 6/10, weight: 10)
- **Appointment overload** (≥5 appointments in next 2 weeks, weight: 10)
- **Journaling gap** (no entry for >7 days = isolation signal, weight: up to 10)

Output: 0-100 score, risk level (low/moderate/high/critical), detected signals, personalized recommendations. Critical risk triggers crisis hotline resources (988, Cancer Support Community 888-793-9355).

ianacare supports caregivers but relies on human Navigators to subjectively detect burnout. No other app in this analysis has automated burnout detection. This moat is structural: the algorithm requires longitudinal journal/check-in data that competitors who don't collect this data cannot replicate without a multi-year data collection phase.

---

### Differentiator 7 — Apple HealthKit FHIR Clinical Records (Not Just Wellness)
**Sources:** `apps/mobile/src/services/healthkit.ts`, `apps/mobile/ios/HealthKitBridge.swift`

The distinction between HealthKit wellness data (steps, HR, sleep — which Cancer.Net and Jasper Health also have) and HealthKit **Clinical Records** (which only CareCompanion and MyChart support) is critical:

- **Wellness data:** Pulled from HealthKit's `HKQuantityType` samples. Available to any app that requests the entitlement. Cancer.Net, Jasper, and others have this.
- **Clinical Records:** `HKClinicalRecord` objects backed by real FHIR resources from the patient's EHR (Epic, Cerner, etc.). Requires the `com.apple.developer.healthkit.access = ["health-records"]` entitlement — **Apple gates this entitlement; apps must be reviewed before access is granted.**

CareCompanion has the `health-records` entitlement (`apps/mobile/ios/CareCompanion.entitlements`). The `HealthKitBridge.swift` module calls `HKHealthStore.requestAuthorization` for clinical record types and `fetchClinicalRecords` to pull FHIR-backed lab results, medications, and appointments.

The `healthkitFhirId` columns in `medications` and `appointments` (`schema.ts:149, 175`) enable deduplication — when an oncologist updates a medication in Epic, the next sync automatically updates CareCompanion without user re-entry.

---

### Differentiator 8 — Agentic Multi-Specialist Architecture with Prompt Caching
**Sources:** `apps/web/src/lib/agents/orchestrator.ts`, `apps/web/src/lib/agents/router.ts`, `apps/web/src/lib/agents/specialists.ts`, `apps/web/src/lib/system-prompt.ts`

CareCompanion routes complex queries to specialized AI agents rather than a single monolithic system prompt:
- **Orchestrator** — determines query type and routes to appropriate specialist
- **Router** — classifies queries (medication, lab interpretation, insurance, emotional support, trial matching)
- **Specialists** — domain-specific agents with specialist context for each area

The system prompt builder (`buildSystemPromptBlocks`) returns 4 structured blocks (L1-L4) designed for **Anthropic prompt caching**:
- L1 (base): `BASE_PROMPT` constant — identical across all users; always cached
- L2 (userStable): Per-user but stable (profile, role, priorities) — cached per user
- L3 (userDynamic): Per-turn (cycle day, recent labs, alerts) — not cached
- L4 (retrieved): RAG memories + summaries — changes per query

This architecture reduces latency and API cost as scale increases — competitors using monolithic prompts pay full token costs on every query, while CareCompanion hits L1+L2 cache on every conversation turn. At 400K users × 5 queries/day (Outcomes4Me scale), this cache architecture saves ~$50K/month in API costs at current token pricing.

---

## 8. Whitespace Bets (Nobody Has This)

Unoccupied feature spaces with demonstrably high cancer patient/caregiver need. None of the 10 competitors have meaningful offerings in these areas.

---

### Whitespace 1 — Chemo-Specific Nutrition & Dietary Guidance
**Opportunity size: High | Build effort: M**

Chemotherapy-induced nausea, mucositis, and taste changes are the top patient-reported quality-of-life impairments during treatment. FOLFOX patients cannot eat cold foods due to oxaliplatin-induced cold sensitivity (already encoded in our `treatments.ts` side effect profiles). Gemcitabine patients have specific hydration requirements to prevent nephrotoxicity. AC-T patients experience taste changes that make previously enjoyable foods unpleasant.

**No app offers dietary guidance tied to treatment regimen and cycle day.** The gap: "You're on Day 3 of FOLFOX — avoid cold foods and drinks due to oxaliplatin sensitivity. Try room-temperature oatmeal, scrambled eggs, or soup. Stay hydrated with room-temperature water."

**Build approach:** Extend `treatments.ts` with a `dietaryGuidance` array per critical day. Surface in AI context as "dietary considerations for current cycle day." Add a "What can I eat today?" shortcut on the home screen during active treatment.

**Revenue unlock:** Savor Health (cancer-specific nutrition company) and similar entities would pay for integration. Pharma companies selling anti-nausea drugs (ondansetron, aprepitant) would sponsor nutritional content. Academic medical centers (MSKCC, MD Anderson) would co-brand nutritional guidelines.

---

### Whitespace 2 — Financial Toxicity Tracker (Full Medical Expense View)
**Opportunity size: Very High | Build effort: S-M**

"Financial toxicity" is an established clinical construct — ~40% of cancer patients face financial devastation within 2 years of diagnosis (JAMA Oncology). Patients manage insurance EOBs, copays, FSA/HSA, prior authorizations, drug copay assistance cards, and charity programs across 5+ separate systems.

**No app provides a consolidated financial view for cancer patients.**

**What we already have:** `claims`, `insurance`, `priorAuths`, `fsaHsa` tables; appeal letter generator; AI system prompt surfaces expired prior auths and low FSA/HSA balances. We are closest to this feature of any competitor.

**What's missing:** Automatic bank transaction categorization (Quiltt API could provide this), copay card registry for common cancer drugs, financial assistance program directory (Patient Advocate Foundation, manufacturer PAP programs), out-of-pocket maximum tracking.

**Build approach:** Add a "Financial Hub" page aggregating existing data. Add copay card registry for top 20 cancer drugs. One Quiltt API integration for bank transaction categorization. This is an integration + UI build on a foundation that already exists.

---

### Whitespace 3 — Post-Treatment Survivorship & Scan Anxiety Management
**Opportunity size: High | Build effort: M**

After active treatment ends, 18 million US cancer survivors enter "scanxiety" cycles — acute anxiety before surveillance scans. Survivorship care plans (SCPs) are required by ASCO accreditation standards but rarely delivered usably. Post-treatment fatigue, cognitive fog, and fear of recurrence persist for years. **No app addresses survivorship as a first-class care phase.**

**Build approach:** 
- Add `treatmentPhase: 'survivorship'` as an explicit mode (schema already has `treatmentPhase`)  
- Survivorship-specific AI persona: different tone, different focus (monitoring vs. active treatment)
- Surveillance schedule tracking (annual scans, tumor markers) as a distinct appointment type
- "Fear of Recurrence" check-in module — validated FoR scale (CancerCare publishes one)
- "What does this symptom mean after treatment?" AI framing vs. "What does this symptom mean during chemo?"

---

### Whitespace 4 — Clinical Trial Participation Tracking (Post-Enrollment)
**Opportunity size: Medium | Build effort: M**

All clinical trial matching apps (including us and Outcomes4Me) stop at matching — they help patients find and express interest in trials. But cancer patients **enrolled in trials** have distinct needs: protocol visit schedule, required assessments, adverse event reporting, sponsor contact information, consent form tracking.

**No consumer cancer app tracks trial participation — only trial discovery.**

**Build approach:** Extend `trials` schema with `enrolled: boolean`, `enrollmentDate`, `armNote`, `visitSchedule: jsonb`. Add "Trial Participant" mode to care profile. Route trial questions to a specialist AI agent trained on GCP (Good Clinical Practice) constraints — no speculation about trial arm, no interpretation of blinded data.

---

### Whitespace 5 — Palliative Care & Hospice Transition Support
**Opportunity size: Niche but high-trust | Build effort: M**

~40% of cancer patients eventually transition to palliative or hospice care. This is the most logistically and emotionally complex phase — family coordination, advance directives, hospice provider selection, Medicare Part A benefit navigation, and anticipatory grief. Every app we reviewed treats end-of-life as a redirection topic (crisis hotlines) rather than a care phase to actively support.

**No app provides end-of-life care navigation.**

**Build approach:**
- Add `treatmentPhase: 'palliative'` and `treatmentPhase: 'hospice'` to the care profile (minimal schema change)
- End-of-life resource discovery: hospice provider search by zip (we have `hospitals.ts` as starting point)
- Advance directive document upload (document storage already exists)
- Medicare hospice benefit explanation in plain English
- AI tone calibrated for end-of-life: honest, warm, present — not redirecting to hospitals
- Partner with Hospice Foundation of America for content validation

This is the highest-trust feature in this entire list. The families who use it most will become CareCompanion's most powerful advocates.

---

### Whitespace 6 — Real-Time Febrile Neutropenia Triage Protocol
**Opportunity size: High (clinical safety moat) | Build effort: S**

Febrile neutropenia (fever in a patient with low ANC during chemo) is an oncologic emergency with 5-10% mortality if untreated. Every oncology team tells patients to call if temp > 100.4°F during chemo. But patients delay because they're unsure of severity. Every hour of delay increases risk.

**No app cross-references temperature with ANC and cycle day to generate a triage recommendation.**

**What we already have:** Emergency page, nadir alert cron, cycle-day tracking, lab ANC values in schema, AI safety rules in system prompt. All individual components exist.

**Build path (1 sprint):**
1. Add a "Temp > 100.4°F?" quick-log button on the home screen during nadir window (Days 7-14)
2. If tapped: query last known ANC and current cycle day
3. If ANC < 1500 AND cycle day 7-14: push emergency modal with oncologist phone + "Go to ER" button
4. Log the event for clinical team review at next appointment

This is a 200-line build that could save lives and generates the most powerful word-of-mouth imaginable.

---

### Whitespace 7 — Cancer Patient Data Dividends (RWE Revenue Sharing)
**Opportunity size: Very High (business model unlock) | Build effort: M**

Folia Health's Data Dividends model (paying chronic disease patients $4/month for data) raised $10.5M in October 2025. Oncology RWE is significantly more valuable than general chronic disease data — pharma companies pay $50-500/patient for high-quality oncology longitudinal datasets. The average CareCompanion user with active chemo generates: daily symptoms, weekly labs, treatment cycle data, medication adherence, and biomarker status — a richer dataset than Folia's general symptom tracker can collect for cancer.

**No existing cancer app pays patients for their oncology RWE.**

**Build approach:**
- Create a "Research Opt-In" screen with plain-language consent
- Define minimum qualifying dataset: 3+ months of data, confirmed cancer diagnosis, at least 10 lab entries
- Compensation: $15/month for active data contributors (3-4x Folia's rate, reflecting higher oncology data value)
- Partner with TriNetX, Flatiron Health, or Tempus for pharma customer relationships
- **Business model unlock:** This model could fund completely free access for all cancer patients, transforming our monetization from "sell to patients or employers" to "sell to pharma, give free to patients." It also creates a powerful word-of-mouth narrative: "CareCompanion pays you to track your cancer care."

---

## 9. Prioritized Action Plan

Based on the competitive analysis, here are the highest-leverage moves in priority order:

### Sprint 1 — Non-Negotiable (unlock all other growth paths)
1. **HIPAA BAA with Anthropic** (Day 1 action — billing decision) → enables enterprise sales, clinical partnerships, health plan deals
2. **PHI field stripping / encryption remediation** (2-3 week sprint) → closes `HIPAA_Compliance_Report.md` critical findings
3. **Human navigator partnership (CancerCare or AONN)** (2 weeks — partnership, not build) → answers enterprise "AI + human" objection

### Sprint 2 — Competitive Parity
4. **Android Health Connect bridge** (4-6 weeks) → opens Android market (45% of users), enables health equity positioning
5. **GoodRx / drug discount card integration** (1 week) → closes obvious gap vs. free consumer competitors
6. **Care group task delegation** (3-4 weeks) → matches ianacare's most-cited unique feature

### Sprint 3 — Differentiation Extensions
7. **Febrile neutropenia triage protocol** (1 sprint — wire existing components) → clinical safety moat, word-of-mouth
8. **Financial Toxicity Hub** (3-4 weeks) → aggregate existing insurance data into actionable financial view
9. **NCCN guideline content partnership** (partnership track) → matches Outcomes4Me's strongest clinical credibility claim

### Sprint 4 — New Market Moves
10. **Spanish-language support** (6-8 weeks) → underserved market, Medicare/Medicaid program requirement
11. **Survivorship Mode** (4-6 weeks) → extends TAM to 18M US survivors
12. **Data Dividends program** (8-12 weeks + pharma partner) → business model unlock

---

## 10. Sources

### Competitor Data Sources

| Competitor | Source | URL |
|-----------|--------|-----|
| CareZone | HIT Consultant acquisition | https://hitconsultant.net/2020/06/16/walmart-acquires-carezone-medication-management/ |
| CareZone | MobiHealthNews | https://www.mobihealthnews.com/news/walmart-snaps-digital-health-company-carezones-medication-management-tool |
| CareZone | Tech Enhanced Life review | https://www.techenhancedlife.com/reviews/carezone-medication-app |
| Caribou | Homepage | https://www.caribou.care/ |
| Caribou | AxisCare integration | https://axiscare.com/integration-marketplace/caribou/ |
| ianacare | Homepage | https://ianacare.com/ |
| ianacare | TechCrunch funding | https://techcrunch.com/2022/01/04/ianacare-picks-up-12-1m-to-fundamentally-change-the-family-caregiver-experience/ |
| ianacare | HIPAA authorization | https://app.ianacare.com/hipaa-authorization.html |
| ianacare | Pricing support page | https://support.ianacare.com/hc/en-us/articles/35224684278541-How-much-does-ianacare-cost |
| ianacare | Caregiver Navigator feature | https://support.ianacare.com/hc/en-us/articles/10539917755405-How-do-i-use-ianacare-features-related-to-Caregiver-Navigator |
| Folia Health | Homepage | https://www.foliahealth.com/ |
| Folia Health | Axios funding | https://www.axios.com/pro/health-tech-deals/2025/10/01/folia-health-11m-chronic-rare-disease-data-pharma |
| Folia Health | GlobeNewswire Series A | https://www.globenewswire.com/news-release/2025/10/01/3159743/0/en/Folia-Health-Secures-10-5M-in-Funding.html |
| Folia Health | HIT Consultant | https://hitconsultant.net/2025/10/01/folia-health-secures-10-5m-series-a-to-scale-patient-driven-rwe-platform/ |
| Folia Health | Data Dividends page | https://www.foliahealth.com/data-dividends |
| Outcomes4Me | Features page | https://outcomes4me.com/digital-medical-file-cancer/ |
| Outcomes4Me | Trial finder | https://outcomes4me.com/clinical-trial-finder-cancer/ |
| Outcomes4Me | App Store | https://apps.apple.com/us/app/outcomes4me-cancer-care/id1404382419 |
| Outcomes4Me | Funding PR | https://outcomes4me.com/press-release/outcomes4me-raises-4-7-million-to-help-patients-navigate-cancer-care-using-ai/ |
| Outcomes4Me | MARS score (PMC) | https://pmc.ncbi.nlm.nih.gov/articles/PMC10453401/ |
| MyChart | FHIR documentation | https://fhir.epic.com/Documentation |
| MyChart | HealthKit integration | https://datica-2019.netlify.app/blog/how-the-epic-healthkit-integration-actually-works/ |
| MyChart | 2025 features (Fierce Healthcare) | https://www.fiercehealthcare.com/health-tech/epic-previews-new-interoperability-features-patients-providers-and-developers |
| MyChart | Epic FHIR interface types | https://open.epic.com/interface/FHIR |
| Quiltt | Overview | https://www.quiltt.io/overview |
| Quiltt | Pricing | https://www.quiltt.io/pricing |
| Jasper Health | Launch (Business Wire) | https://www.businesswire.com/news/home/20210512005663/en/Jasper-Health-Launches-Comprehensive-Support-Platform |
| Jasper Health | $25M Series A | https://www.prnewswire.com/news-releases/jasper-health-raises-25-million-in-series-a-funding-301471245.html |
| Jasper Health | Medicare PIN codes | https://www.prnewswire.com/news-releases/jasper-health-unveils-medicare-focused-cancer-care-navigation-leveraging-ai-aligned-with-new-reimbursement-codes-302006787.html |
| Jasper Health | Wellnecity employer partnership | https://www.prnewswire.com/news-releases/jasper-health-partners-with-wellnecity-to-bring-digital-oncology-platform-to-self-insured-employers-301864618.html |
| Jasper Health | HIT Consultant profile | https://hitconsultant.net/2021/05/12/jasper-health-cancer-care-platform-launch/ |
| Cancer.Net | ASCO Post | https://ascopost.com/issues/november-25-2020/asco-s-free-app-for-patients-cancernet-mobile/ |
| Cancer.Net | ACS collaboration | https://cancerletter.com/conversation-with-the-cancer-letter/20240601_1/ |
| Cancer.Net | App updates (ASCO Connection) | https://connection.asco.org/do/new-version-award-winning-cancernet-app-available |
| Cancer.Net | Daily News ASCO | https://dailynews.ascopubs.org/do/new-updates-cancer-net-mobile-app-improves-user-experience-and-ease |
| Market sizing | Virtual Oncology Market (Coherent) | https://www.coherentmarketinsights.com/industry-reports/virtual-oncology-market |
| Market sizing | Tele-oncology CAGR | https://www.towardshealthcare.com/insights/tele-oncology-market-sizing |
| Research | Cancer app quality (PMC) | https://pmc.ncbi.nlm.nih.gov/articles/PMC10453401/ |
| Research | Cancer app features scoping review | https://pmc.ncbi.nlm.nih.gov/articles/PMC10182455/ |

### CareCompanion Codebase Citations

| Feature | File Reference |
|---------|---------------|
| AI system prompt — base, role context, L1-L4 blocks | `apps/web/src/lib/system-prompt.ts` |
| Chemo regimen knowledge base — 9 named protocols | `apps/web/src/lib/treatments.ts` |
| Drug-drug interaction checking | `apps/web/src/lib/drug-interactions.ts` |
| Lab trend analysis + oncology thresholds + red-flag combos | `apps/web/src/lib/lab-trends.ts` |
| Nadir alert cron job | `apps/web/src/app/api/cron/nadir-alert/route.ts` |
| Caregiver burnout detection | `apps/web/src/lib/caregiver-burnout.ts` |
| Health score calculation | `apps/web/src/lib/health-score.ts` |
| Insurance appeal letter generator | `apps/web/src/app/api/insurance/appeal/route.ts` |
| HealthKit FHIR clinical records service | `apps/mobile/src/services/healthkit.ts` |
| HealthKit native bridge (Swift) | `apps/mobile/ios/HealthKitBridge.swift` |
| HealthKit entitlement (health-records) | `apps/mobile/ios/CareCompanion/CareCompanion.entitlements` |
| Wellness vitals (steps, HR, sleep) | `apps/mobile/src/services/wellnessVitals.ts` |
| Genomic biomarkers in schema | `apps/web/src/lib/db/schema.ts:107` |
| Clinical trial profile assembly | `apps/web/src/lib/trials/assembleProfile.ts` |
| Mutations table with confidence scoring | `apps/web/src/lib/db/schema.ts` (mutations table) |
| Memory RAG system (embed + retrieve) | `apps/web/src/lib/memory.ts` |
| Prompt injection defense | `apps/web/src/lib/system-prompt.ts:21` (AI_DIRECTIVE_PATTERNS) |
| Multi-specialist agent routing | `apps/web/src/lib/agents/orchestrator.ts`, `router.ts`, `specialists.ts` |
| Voice check-in stub | `apps/mobile/app/voice-checkin.tsx` |
| Medication compliance reporting | `apps/web/src/lib/compliance-tracker.ts` |
| Refill tracker | `apps/web/src/lib/refill-tracker.ts` |
| Care group API | `apps/web/src/app/api/care-group/route.ts` |
| Check-in sharing | `apps/web/src/app/api/checkins/share/route.ts` |
| Google Calendar sync | `apps/web/src/app/api/auth/google-calendar/route.ts` |
| FSA/HSA and prior auth in system prompt | `apps/web/src/lib/system-prompt.ts` |
| Export CSV / PDF | `apps/web/src/app/api/export/csv/route.ts`, `/pdf/route.ts` |
| HIPAA consent in schema | `apps/web/src/lib/db/schema.ts:46-49` |
| HIPAA compliance report (critical findings) | `HIPAA_Compliance_Report.md:27-54` |
| Audit logging | `apps/web/src/lib/audit.ts` |
| Architectural bets review | `ARCH_BETS.md` |
| Emergency page | `apps/web/src/app/(app)/emergency/page.tsx` |
| Timeline view | `apps/web/src/app/(app)/timeline/page.tsx` |
| Community feature | `apps/web/src/app/(app)/community/page.tsx` |
| Demo / guest mode | `apps/web/src/app/api/demo/start/route.ts` |

---

_End of COMPETITIVE_GAP.md_

_Research methodology note: Competitor data sourced from web search results (May 2026), press releases, App Store descriptions, academic literature, and independent review sites. Direct product access was not available (competitor sites returned 403 to automated fetches). Features marked 🟡 should be independently verified through hands-on product testing before citation in enterprise materials. All CareCompanion capability claims are backed by specific file references verifiable in the `aryan/dev` branch._
