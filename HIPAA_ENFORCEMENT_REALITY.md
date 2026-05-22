# HIPAA + FTC Enforcement Reality: 2023–2026
## Digital Health & Mobile App Enforcement Landscape

**Prepared:** May 2026  
**Scope:** FTC Health Breach Notification Rule cases, HHS OCR resolution agreements, state AG actions, and private litigation patterns relevant to mobile health apps.  
**Audience:** CareCompanion engineering and legal — pre-launch compliance reference.

---

## Executive Summary

Between 2023 and 2026, U.S. regulators extracted over **$30 million in settlements** from digital health companies for a consistent cluster of violations: shipping tracking pixels that silently forwarded health data to Meta and Google, embedding third-party SDKs without auditing their data egress, failing to execute Business Associate Agreements (BAAs) before sharing PHI with vendors, and not notifying users when breaches occurred. The FTC operationalized its Health Breach Notification Rule (HBNR) for the first time during this period, turning what was a dormant rule into an active enforcement tool. HHS OCR launched a dedicated Risk Analysis Initiative in late 2024 that has already produced 12+ settlements. State legislatures, led by Washington's My Health My Data Act (MHMDA), created new private rights of action that extend well beyond HIPAA's covered-entity scope.

Every major enforcement action maps to one or more of five root-cause categories: tracking pixels, SDK data leakage, unencrypted storage, breach notification failures, and missing BAAs. CareCompanion must address all five before launch.

---

## Master Enforcement Table

| Case | Regulator | Year | Amount | Primary Violation | CareCompanion Lesson |
|------|-----------|------|--------|-------------------|----------------------|
| GoodRx | FTC (HBNR) | 2023 | $1.5M | Meta/Google Pixel shared prescription data | Audit every pixel and SDK before launch; treat all health-adjacent data as PHI |
| BetterHelp | FTC (Section 5) | 2023 | $7.8M | Mental health data shared with Facebook, Snapchat, Criteo | False HIPAA seal on website triggered extra liability; do not claim compliance you cannot demonstrate |
| Premom / Easy Healthcare | FTC (HBNR) + State AGs | 2023 | $200K total | SDKs sent reproductive health data to China-based firms; no breach notice | Inventory every SDK's data flows; sub-processor agreements required |
| Cerebral | FTC + DOJ | 2024 | $7M (of $15M assessed) | Tracking pixels sent mental health + medication data to LinkedIn, TikTok | Single sign-on misconfiguration also exposed patient records cross-account; fix auth as well as pixels |
| Monument | FTC + DOJ | 2024 | $2.5M (suspended) | Addiction treatment data sent to Meta/Google via pixels; violated OARFPA | Addiction and mental health data attract highest regulatory scrutiny; apply zero-tolerance pixel policy |
| Cascade Eye & Skin Centers | HHS OCR | 2024 | $250K | Ransomware breach; no risk analysis conducted; 291K files exposed | Annual HIPAA risk analysis is not optional; document it and repeat it when infrastructure changes |
| OCR Risk Analysis Initiative (12 cases) | HHS OCR | 2024–2025 | ~$900K combined | Failure to complete a compliant risk analysis across small-to-mid healthcare entities | Pattern: every single case cited missing or inadequate risk analysis — it is the top OCR trip-wire |
| Advocate Aurora Health (Meta Pixel class action) | Private plaintiffs | 2024 | $12.25M | Meta Pixel on patient portal transmitted PHI to Meta without BAA or consent | Patient portals are highest-risk surfaces; any analytics tag there is presumptively a HIPAA violation |
| Pomona Valley Hospital (Meta Pixel) | Private plaintiffs | 2024 | $600K | Meta Pixel on hospital website 2019–2022 | Even website (not just portal) pixel use generates class-action exposure |
| Healthline Media | CA AG (CCPA) | 2025 | $1.55M | Continued data sharing post opt-out; article titles (e.g., disease names) shared with ad networks | Inferring health conditions from content usage is regulated; do not pass page titles or article slugs to ad platforms |
| Washington MHMDA | WA AG + Private Right of Action | Effective 2024 | Up to $25K per plaintiff + treble damages | Broad definition of consumer health data beyond HIPAA; geolocation near clinics covered | If any user is in Washington, MHMDA applies regardless of whether you are a HIPAA covered entity |
| Multi-State BAA Enforcement pattern | HHS OCR (multiple) | 2023–2025 | $80K–$350K per case | Missing or outdated BAAs with analytics vendors, cloud providers, billing partners | Every vendor that touches PHI — including your AI model provider, logging service, and analytics tool — needs a signed BAA |

---

## Category 1: Tracking Pixel / Meta Pixel Cases

### What Happened

The FTC's enforcement wave began February 1, 2023, when it filed its first-ever Health Breach Notification Rule action against **GoodRx** ($1.5M). GoodRx had embedded Meta Pixel, Google Analytics, and Criteo tracking code in its website and mobile app SDK. These pixels harvested users' prescription drug names, medical conditions, email addresses, phone numbers, and ZIP codes and fired them to ad platforms automatically — without user knowledge and contrary to GoodRx's own privacy policy, which promised no sharing with advertisers.

Six weeks later, **BetterHelp** settled for $7.8M after the FTC proved it had shared mental health intake questionnaire data (including whether a user was in therapy or on medication) with Facebook, Snapchat, Criteo, and Pinterest to build lookalike advertising audiences. The aggravating factor: BetterHelp had displayed a fake HIPAA compliance seal on its website, which the FTC treated as an independent deceptive act.

In April 2024, **Cerebral** (telehealth mental health) paid $7M (of $15M assessed; the remainder was suspended due to inability to pay). Cerebral's pixel and API integrations had sent 3.2 million users' names, medical histories, diagnoses, medications, IP addresses, and demographic data to LinkedIn and TikTok. A separate finding revealed that its single sign-on implementation accidentally exposed one patient's records to other patients — demonstrating that auth bugs and pixel bugs are treated as a single privacy failure by the FTC.

**Monument** (alcohol addiction telehealth) settled in April 2024. The FTC charged Monument under both the FTC Act and the Opioid Addiction Recovery Fraud Prevention Act of 2018 (OARFPA), which applies specifically to addiction treatment services. Monument promised "100% confidential" care but ran Meta and Google pixels against those same user sessions. The $2.5M civil penalty was suspended only because Monument was financially insolvent.

On the hospital side, private class-action litigation has extracted over **$12.85M** from two hospital systems alone (Advocate Aurora: $12.25M; Pomona Valley: $600K) for Meta Pixel on patient portals and public websites. In March 2024, HHS OCR updated its tracking technology guidance to clarify that health information collected on a regulated entity's website or app is PHI even when the user has no existing patient relationship.

**Direct lessons for CareCompanion:**
- Any tracking pixel (Meta, Google, TikTok, LinkedIn, Snapchat, Criteo) that fires on a page where users can view or enter health data is presumptively a HIPAA violation unless a signed BAA exists with the pixel vendor and the user has given HIPAA-compliant authorization — which Meta and Google will not sign.
- The practical answer is: remove all standard ad pixels from authenticated sessions. Use a HIPAA-compliant analytics alternative (e.g., Freshpaint with PHI stripping, Piwik PRO with BAA) or first-party event logging only.
- If CareCompanion ever runs marketing campaigns with lookalike audiences, build those audiences from aggregate/de-identified data only, never from raw user health data exports.
- Do not use any Meta CAPI (Conversions API) server-side integration if the events contain health context.

---

## Category 2: Third-Party SDK PHI Leaks

### What Happened

The **Premom / Easy Healthcare** case (May 2023, $200K combined FTC + State AG) is the canonical SDK case. Premom's fertility-tracking app embedded third-party SDKs — including AppsFlyer and two unnamed China-based analytics firms — that silently transmitted menstrual cycle dates, pregnancy status, hormone results, body temperature logs, and weight data to those firms' servers. Easy Healthcare never audited what those SDKs sent, had no BAAs with the SDK vendors, and failed to notify users that their reproductive health data had been exposed to foreign analytics companies. The FTC cited this as a Health Breach Notification Rule violation because the unauthorized SDK data transmission constituted a "breach" under the expanded definition.

The revised HBNR, finalized April 2024 and effective July 29, 2024, explicitly broadened the definition of "breach" to include **voluntary unauthorized disclosures** — not just cybersecurity intrusions. This means every SDK that exfiltrates health data is now a self-reported breach event triggering the Rule's 60-day notification obligation to affected users and the FTC.

HHS OCR's March 2024 guidance update reinforced this: individually identifiable health information collected on a regulated entity's mobile app is PHI regardless of the collection method, including passively by third-party SDKs.

**Direct lessons for CareCompanion:**
- Conduct a full SDK audit before launch. Use a dynamic analysis tool (e.g., mitmproxy, Proxyman, Burp Suite) against a test build of the iOS and Android apps to observe every network call each SDK makes. Map the destination, the payload, and whether PHI fields are included.
- For every SDK that receives any health-adjacent data: either obtain a signed BAA, replace it with a HIPAA-compliant alternative, or strip PHI before the SDK call fires.
- Specifically high-risk SDK categories: crash reporting (Crashlytics, Sentry), analytics (Amplitude, Mixpanel, Firebase Analytics), A/B testing (Optimizely, LaunchDarkly), push notifications (OneSignal), and customer support (Intercom). Each of these commonly logs user identifiers alongside event context that may contain health data.
- Shreyash (mobile owner) must sign off on an SDK data-flow map before the mobile app enters production.

---

## Category 3: Unencrypted Backups and Storage Failures

### What Happened

The archetype case predating our window but still shaping OCR practice is **Woman & Infants Hospital of Rhode Island** ($400K), where OCR investigated after unencrypted backup tapes went missing at two facilities. OCR's investigation found the hospital had also failed to update a BAA after the Omnibus Rule — meaning every PHI transmission to that business associate after the BAA lapsed was treated as a separate impermissible disclosure.

In the 2024–2025 period, OCR's Risk Analysis Initiative targeted a pattern of organizations running unencrypted or inadequately secured ePHI without ever having documented their risk posture. The Initiative's first action (October 31, 2024, against an Oklahoma EMS provider, $90K) established the template: OCR opens an investigation after a ransomware attack is reported, discovers there was no completed risk analysis, and settles for a corrective action plan plus a fine. The ransomware is almost secondary — the fine is for the pre-existing failure to analyze risk.

By April 2025, OCR had completed 12 Risk Analysis Initiative enforcement actions with combined payments of ~$900K. The Initiative explicitly continues under the Trump administration, demonstrating bipartisan regulatory commitment. The average penalty per case is ~$75K, but for larger organizations OCR's civil monetary penalty authority reaches $1.9M per violation category per year.

**Direct lessons for CareCompanion:**
- All ePHI at rest in Aurora must use AES-256 encryption. AWS RDS encryption at rest should be verified on every table, not assumed. Aryan owns this check.
- All ePHI in transit must use TLS 1.2 minimum (TLS 1.3 preferred). Audit ALB and API Gateway TLS policies before launch.
- Automated backups of Aurora must be encrypted. S3 buckets holding backups must have SSE-S3 or SSE-KMS enabled and Block Public Access enforced.
- Complete a formal HIPAA Security Rule risk analysis before launch. Document it. Store the artifact in the `.claude/` infra folder or a private compliance S3 bucket. OCR's singular enforcement theme is: if you did not write it down, it did not happen.
- Repeat the risk analysis after every significant infrastructure change (new AWS region, new service, schema changes, new AI provider integration).

---

## Category 4: Breach Notification Failures

### What Happened

The HBNR requires vendors of personal health record systems and PHR-related entities (which includes health apps that collect health data from multiple sources) to notify users, the FTC, and sometimes media within 60 days of discovering a breach. The FTC's 2023–2024 enforcement wave established that sharing data with ad platforms via pixels or SDKs is itself a breach requiring notification under this rule.

**GoodRx** violated the HBNR by sharing data with advertisers and never notifying users. **Premom** violated it by sharing data with SDK vendors and never notifying users. In both cases, the notification failure was treated as a separate, independent violation layered on top of the underlying data sharing violation.

The April 2024 HBNR update (effective July 2024) made three key changes relevant to apps:
1. **Expanded breach definition:** Unauthorized disclosures — including intentional but non-consented sharing with advertising platforms — now explicitly qualify as breaches.
2. **60-day notification window:** Increased from 10 business days for large breaches (500+ users) to 60 calendar days.
3. **Disclosure content:** User notifications must now identify the specific third parties that received their data and describe the types of health information involved.

HHS OCR's Breach Notification Rule enforcement runs in parallel: OCR requires covered entities and business associates to notify HHS within 60 days of a breach affecting 500+ individuals in a state (immediate entry to the public "Wall of Shame" portal) and within 60 days of year-end for smaller breaches.

**Vision Upright** (May 2025, $X settlement) exemplified the compound failure: a California radiology provider suffered a breach exposing 21,778 patients' medical images, had never conducted a risk analysis, and failed to notify HHS within the 60-day window. OCR penalized both the security failure and the notification failure as separate violations.

**Direct lessons for CareCompanion:**
- Build breach detection and notification into the platform before launch, not after. The clock starts at "discovery," and the FTC/OCR definition of discovery is broad — if logs show unauthorized data egress, you have discovered a breach even if no one has reported it yet.
- Maintain a breach log template. When a potential breach is discovered, the 60-day clock starts immediately. Designate a breach response owner (Aryan, as web lead) and document the response in real time.
- The "no PHI in logs" team rule (Rule 7 in CLAUDE.md) is directly upstream of breach notification: if PHI is in application logs, those logs are ePHI, and unauthorized access to the logging service is a reportable breach.
- For the FTC HBNR: confirm whether CareCompanion qualifies as a "PHR-related entity." If the app draws health data from multiple sources (e.g., user input + EHR imports via FHIR + wearable integrations), it almost certainly qualifies. If so, register a process for FTC notifications in addition to HHS OCR notifications.

---

## Category 5: Missing Business Associate Agreements (BAAs)

### What Happened

The BAA requirement is the most consistently cited HIPAA enforcement finding. Every vendor that creates, receives, maintains, or transmits PHI on behalf of a covered entity or business associate must have a signed BAA. OCR's 2023–2025 enforcement record shows the violation occurring in three patterns:

**Pattern A — No BAA at all:** The covered entity onboards an analytics vendor, cloud service, or AI tool and shares patient data without executing any BAA. OCR has fined entities $80K–$350K for this alone, independent of any breach.

**Pattern B — Outdated BAA:** The BAA predates the 2013 Omnibus Rule or does not include provisions required by later guidance (e.g., breach notification timelines, subcontractor obligations). OCR treated Woman & Infants Hospital's lapsed BAA as converting all subsequent PHI sharing into impermissible disclosures.

**Pattern C — BAA with wrong party:** The entity has a BAA with a vendor's parent company but not the specific subsidiary or subprocessor that actually handles the data. With AI model providers in particular, this is an emerging failure mode — a BAA with a cloud provider does not automatically cover the AI API endpoint that logs inference calls.

In the tracking pixel context, the core problem is that Meta, Google, TikTok, and Snap will not sign BAAs with healthcare entities because they are not acting as business associates — they are advertising platforms acting as independent data controllers. This means there is no legal mechanism to share PHI with these platforms under HIPAA, full stop.

**Direct lessons for CareCompanion:**
- Maintain a BAA register. Before any vendor goes into production that could touch PHI, the BAA must be signed and the signed copy stored in a secure location accessible to Aryan.
- Current vendor categories requiring BAAs: AWS (AWS BAA available; must be explicitly accepted in the AWS console and applies per-service), any AI/ML API provider used for health inference (verify each provider's HIPAA program), logging/observability platforms (Datadog, CloudWatch with PHI — confirm BAA or strip PHI before ingest), any CDN or WAF that terminates TLS in front of health data endpoints, SMS/notification providers (Twilio has a BAA program), and any FHIR integration partner (Rahil's area — coordinate on BAA coverage for EHR connectors).
- For AI model inference on PHI: confirm Anthropic's or whichever provider's HIPAA BAA status before any patient data is sent to an external model API. If a BAA is not available, run inference on de-identified data only or use a self-hosted model.
- Subcontractor chain: if CareCompanion uses a business associate that in turn subcontracts to another vendor that touches PHI, the HIPAA chain requires each link to have a BAA. Audit subprocessors of your key vendors.

---

## Category 6: State-Level Enforcement

### Washington My Health My Data Act (MHMDA)

Effective March 31, 2024 for large businesses and June 30, 2024 for small businesses, Washington's MHMDA is the most aggressive state health data law in the country. Its scope is dramatically broader than HIPAA:

- **Who it covers:** Any entity that collects, processes, or shares "consumer health data" from Washington residents — not just HIPAA covered entities. A wellness app, an AI care companion, a symptom tracker: all covered if a Washington resident uses it.
- **What it covers:** Health conditions, diagnoses, medications, menstrual cycles, reproductive health, mental health, geolocation data that could indicate a health condition (e.g., location near a fertility clinic or addiction treatment center), data derived or inferred about health.
- **Private right of action:** Any Washington resident can sue for violations. Damages: actual damages plus attorneys' fees plus up to **$25,000 per violation** in treble damages.
- **Enforcement:** Washington AG can seek injunctions, restitution, and civil penalties under the Consumer Protection Act.

The MHMDA requires: consent before collecting consumer health data; consent before sharing with third parties; the right to access, correct, and delete health data; and a consumer health data privacy policy distinct from a general privacy policy.

**Direct lessons for CareCompanion:** If even one user is in Washington, MHMDA applies. Given that any national health app will have Washington users, assume full compliance is required. Audit the consent flows, ensure the consumer health data privacy policy exists and is accurate, and confirm that no geolocation data near health facilities is being shared with third parties.

### California AG — CCPA Health Data Enforcement

The July 2025 **Healthline Media** settlement ($1.55M) established that under the CCPA's purpose-limitation principle, sharing content metadata that reveals a user's health interests (e.g., the title of a health article they read) with advertising partners violates California law even if the underlying data isn't explicitly labeled as "health data." The CA AG found that Healthline continued sharing data with advertisers after users had opted out via cookie banners or Global Privacy Control signals.

**Direct lessons for CareCompanion:** The content of what users view in a health app — article topics, symptom categories, medication information pages — is itself potentially sensitive health data under the CCPA. Do not pass page titles, content slugs, or category metadata to any advertising or analytics platform. Ensure that opt-out signals (GPC headers, in-app privacy settings) actually stop data sharing within a technically reasonable time.

### Multi-State AG Coordination

The Premom case ($100K from DC, Connecticut, and Oregon AGs) demonstrated that state AGs coordinate with the FTC and with each other on digital health enforcement. The FTC serves as the coordinating hub; state AGs pile on with their own consumer protection statute claims. For CareCompanion, this means a single data-sharing violation can generate simultaneous federal FTC action, HHS OCR action, and multi-state AG actions.

---

## Pattern Analysis: What Regulators Actually Find

Across all 2023–2026 enforcement actions, the following root causes appear in order of frequency:

1. **Unaudited third-party tracking code** (pixels, SDKs) on surfaces that handle health data — found in 7 of the 10 major cases above.
2. **Missing or inadequate risk analysis** — found in every HHS OCR case in the Risk Analysis Initiative (12 cases).
3. **Missing BAAs** with analytics, cloud, or advertising vendors — found in GoodRx, Premom, Cerebral, and the OCR pattern cases.
4. **False or misleading privacy representations** — BetterHelp's fake HIPAA seal; Monument's "100% confidential" promise; Cerebral's privacy policy misrepresentations. Misleading claims escalate FTC penalties.
5. **Breach notification failures** — GoodRx and Premom both violated the HBNR by failing to notify users after confirmed unauthorized data sharing.
6. **Inadequate data minimization** — nearly every case involved collecting or retaining health data well beyond what the product required.

One consistent finding: **inability to pay does not eliminate the violation record.** Monument's $2.5M penalty was fully suspended, and Cerebral's $15M was reduced to $7M, but both companies are now under consent orders, prohibited from data sharing for advertising, and subject to FTC monitoring for a decade. The compliance burden is more costly than the fine.

---

## Pre-Launch CareCompanion Compliance Checklist

Derived directly from the enforcement cases above. All items must be resolved before the first production user session.

### Tracking & Analytics
- [ ] Complete pixel and SDK audit on web and mobile. No pixel fires on any authenticated or health-context page without a signed BAA with the pixel vendor.
- [ ] Replace standard Meta/Google Analytics with a HIPAA-compliant analytics alternative (Freshpaint + BAA, or Piwik PRO + BAA, or first-party Aurora event logging).
- [ ] Confirm that no health-related page titles, URL parameters, or content slugs are forwarded to any ad network or analytics vendor.
- [ ] Document findings in the SDK data-flow map. Shreyash signs off on mobile; Aryan signs off on web.

### BAA Register
- [ ] AWS HIPAA BAA: accepted in AWS console, mapped to each service (RDS, S3, CloudWatch, etc.).
- [ ] AI model provider HIPAA BAA: confirm coverage before any PHI reaches inference endpoint.
- [ ] Logging/observability platform BAA: strip PHI before ingest or sign BAA.
- [ ] FHIR integration partners (Rahil): confirm BAA chain covers all subprocessors.
- [ ] SMS/notification vendor BAA: confirm signed.
- [ ] Subprocessor audit: request DPA/BAA from each key vendor for their own subprocessors.

### Risk Analysis
- [ ] Complete and document a HIPAA Security Rule risk analysis before launch.
- [ ] Re-run risk analysis after every material infrastructure change.
- [ ] Store dated artifact in a tamper-evident location (e.g., private S3 bucket with versioning).

### Encryption
- [ ] Aurora RDS: encryption at rest enabled on every instance and snapshot.
- [ ] S3 backup buckets: SSE-KMS enabled; Block Public Access enforced.
- [ ] All health data endpoints: TLS 1.2+ enforced at ALB; TLS 1.3 preferred.
- [ ] Mobile app: confirm no PHI written to device logs, analytics events, or crash reports.

### Breach Notification
- [ ] Designate a breach response owner and define the internal "discovery" threshold.
- [ ] Document the FTC HBNR 60-day notification process (determine if CareCompanion qualifies as a PHR-related entity).
- [ ] Document the HHS OCR Breach Notification Rule process (60-day notification, Wall of Shame submission for 500+ breaches).
- [ ] Test the breach response process with a tabletop exercise before launch.

### Privacy Representations
- [ ] Audit all marketing copy, website text, and app store descriptions for privacy claims. Every claim must be accurate and demonstrably true.
- [ ] Do not display any third-party compliance seals (HIPAA, SOC 2) unless the certification is current and applies to the specific product being described.
- [ ] Consumer health data privacy policy (distinct from general privacy policy) required for MHMDA compliance if Washington users will use the app.
- [ ] Confirm opt-out mechanisms (GPC, in-app settings) are technically functional end-to-end.

---

## Financial Exposure Summary

| Regulator | Mechanism | Per-Violation Range | Annual Cap |
|-----------|-----------|---------------------|------------|
| FTC (HBNR) | Civil penalty | Up to $51,744/violation | Uncapped per case |
| FTC (Section 5) | Disgorgement + consumer redress | Case-specific | No statutory cap |
| HHS OCR (Tier 1 — unknowing) | CMP | $141–$71,162/violation | $2,134,831 |
| HHS OCR (Tier 4 — willful neglect, uncorrected) | CMP | $71,162–$2,134,831/violation | $2,134,831 |
| WA MHMDA (private) | Treble damages | Up to $25,000/plaintiff | No cap (class action) |
| CA AG (CCPA) | Civil penalty | $2,500 unintentional / $7,500 intentional per consumer | No annual cap |
| State AG (CPA violations) | Injunction + restitution + penalties | Varies by state | Varies by state |

For a health app with millions of users, the class-action exposure under MHMDA (treble damages, no cap, private right of action) is larger than any regulatory fine. Advocate Aurora's $12.25M class-action settlement dwarfs any OCR fine it might have received. Design for class-action protection, not just regulatory compliance.

---

*This document reflects the enforcement record through May 2026 based on publicly available FTC press releases, HHS OCR resolution agreements, court filings, and AG announcements. It is an internal engineering and compliance reference, not legal advice. Consult qualified healthcare privacy counsel before launch.*
