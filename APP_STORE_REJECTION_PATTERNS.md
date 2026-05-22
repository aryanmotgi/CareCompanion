# App Store Rejection Patterns 2025–2026: Health / Medical / AI Apps

> Research compiled May 2026. Sources: Apple Developer Forums, App Review Guidelines changelog (developer.apple.com/news), Apple 2024 Transparency Report, TechCrunch, MacRumors, 9to5Mac, RevenueCat, IndieHacker blogs, OpenForge, Bitrise, capgo.app, dev.to, pushmyapp.ai.

---

## Scale of the Problem

Apple's 2024 App Store Transparency Report (published May 2025) gives a rare quantitative look at the rejection landscape:

- **7,771,599** total submissions reviewed in 2024
- **1,931,400** rejected (~25% — roughly 1 in 4 submissions)
- 295,109 subsequently approved after developers addressed issues on appeal
- ~400,000 rejections attributed to privacy violations
- ~320,000 blocked for copying other apps or misleading users
- 43,000+ rejected for hidden or undocumented features
- 146,747 developer accounts terminated

Industry estimates (not Apple's figures) place first-time iOS submission rejection rates at **40–60%**. Privacy is the **fastest-growing** rejection category heading into 2026. Third-party analytics place **12% of Q1 2025 submissions** rejected specifically for Privacy Manifest violations alone.

---

## Rejection Pattern Table

| # | Pattern | Frequency 2025–26 | Example Apps / Categories Rejected | Guideline Cited | How to Avoid | Applies to CareCompanion? |
|---|---------|-------------------|-----------------------------------|-----------------|--------------|---------------------------|
| 1 | AI / LLM data disclosure missing | **Very High** — first cited Nov 2025; dominant vector Q1 2026 | Financial AI apps (Vertex AI backend), health chatbots, productivity AI assistants (see forum threads 815842, 820209, 815109) | **5.1.2(i)** (updated Nov 13, 2025) | Mandatory named-provider consent modal before first AI call; name the provider explicitly; cannot be bundled with T&C | **CRITICAL — top risk** |
| 2 | Account deletion absent or incomplete | **High** — fully enforced since June 2022, still top-5 rejection cause 2025–26 | Social apps, health trackers, fintech; any app with account creation | **5.1.1(v)** | In-app delete flow in Settings; healthcare apps may add support-flow path but must still have in-app initiation; revoke Sign in with Apple tokens | **HIGH** |
| 3 | Privacy manifest (PrivacyInfo.xcprivacy) incomplete | **High** — 12% of Q1 2025 submissions; hard-blocked at App Store Connect since May 1, 2024 | Any app using Firebase, Amplitude, Crashlytics, UserDefaults, file timestamps; virtually all apps with analytics SDKs | **TN3183** / App Store Connect auto-check | Generate Privacy Report in Xcode; update all third-party SDKs; declare all Required Reason API usage with correct reason codes | **HIGH** |
| 4 | Medical claims / AI framed as diagnosis | **High** — ongoing; intensified with LLM-powered health apps 2025 | Symptom checkers, LLM-based health Q&A, blood-pressure estimation apps (FDA warning letters mid-2025) | **1.4.1**, **5.1.3** | Prominent disclaimer that app is not a medical device; prompt LLM to deflect diagnostic questions; include "consult your doctor" nudges | **HIGH** |
| 5 | Age rating under-declared for AI chatbot / medical content | **High** — new questionnaire mandatory by Jan 31, 2026; existing apps locked from updates if not answered | Health AI companions, mental health chatbots, medical reference apps | **2.3.6** (new system: 4+/9+/13+/16+/18+, effective Jul 2025) | Complete updated questionnaire with AI chatbot + medical/wellness categories checked; health AI companions likely 13+ minimum | **HIGH** — Jan 31 2026 deadline |
| 6 | Sign in with Apple parity missing | **High** — enforcement ongoing; Jan 2024 guideline softened wording but practice unchanged | Any app offering Google/Facebook login without Apple option; auth-only enterprise apps misclassified as exempt | **4.8** | Offer Sign in with Apple at equal or greater visual prominence to any third-party social login; must revoke Apple tokens on account deletion | **HIGH** if using Google/FB login |
| 7 | Medical device status not declared | **Medium** — new requirement Mar 26, 2026; hard gate for updates from early 2027 | All Health & Fitness and Medical category apps; apps flagged "frequent medical content" in age rating questionnaire | New 2026 medical device disclosure requirement | Declare in App Store Connect (Yes/No); if No, takes 30 seconds; if Yes, submit regulatory info (FDA number, CE/UKCA) | **MEDIUM** — declare "No" if no FDA clearance |
| 8 | ATT consent misuse | **Medium** — ongoing; EU regulatory pressure adds scrutiny 2025 | Analytics-heavy apps requesting ATT without genuine tracking use; apps gating features behind ATT consent; apps with fingerprinting SDKs | **5.1.2** | Only request ATT if actually doing cross-company tracking; never gate functionality on ATT consent; avoid SDKs that fingerprint; specify actual tracking partners in purpose string | **MODERATE** |
| 9 | In-app purchase bypass (external payments without entitlement) | **Medium** globally / **decreasing in US** post May 2025 Epic ruling | Subscription apps using Stripe/Paddle/web checkout without entitlement; apps with multiple external payment CTAs | **3.1.1** | Use StoreKit for all digital goods globally; US-only: single external link allowed post-May 2025 ruling; no scare screens, no penalizing IAP users | **MODERATE** |
| 10 | No demo account provided for review | **Medium** — often caught in first review cycle | Health apps requiring real patient data, AI apps requiring API-key-gated onboarding, apps with mandatory HealthKit pairing | **2.1** | Submit test credentials in App Review Notes; build demo mode showing all AI and health features without real health data | **HIGH** — AI + health data gates |
| 11 | AI-built / low-quality app (vibe-coding artifacts) | **Low-Medium** — new 2026 focus | Thin LLM wrappers with no unique value; apps with private API calls from AI-generated code | **4.2**, **2.5.2** | Ensure app has genuine utility independent of the AI; audit AI-generated code for private API calls before submission | **LOW** if genuine feature set exists |

---

## Detailed Breakdown

### 1. AI / LLM Data Disclosure — Guideline 5.1.2(i)

**Effective:** November 13, 2025. Apple's most significant AI-specific rule update to date.

**What changed:** The guidelines now explicitly name "third-party AI" as a regulated data recipient alongside other third parties. Previous 5.1.2 already required disclosure of third-party data sharing, but "AI" was never called out by name. After the November update, the text reads (paraphrased from developer.apple.com/news/?id=ey6d8onl):

> "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so."

**What triggers it:**
- Sending user messages, health queries, or any prompts to an external LLM API (OpenAI, Anthropic, Google Gemini, Mistral, etc.)
- Uploading user documents or images to cloud-based AI for analysis
- Transmitting voice recordings to external speech-to-text
- Any PII, health context, or medication data sent to a cloud model
- On-device models (Core ML, Apple Intelligence) are **exempt**

**Consent requirements (from real-world resolved rejections — forum threads 815842 and 820209):**
- Named-provider consent modal must appear **before the first AI interaction**, not bundled with T&C
- Must name the specific provider (e.g., "Anthropic, PBC" — not just "a third-party service")
- Must list data types transmitted (user messages, health context, medication list)
- Must use an explicit opt-in mechanism (mandatory acknowledgment checkbox, not a pre-checked box)
- The consent screen must be **impossible to dismiss** until acknowledged — one team's rejection (thread 820209) was traced to an `&&` vs `||` operator bug that let users bypass the consent gate
- Users must be able to **revoke** AI consent in Settings without deleting their account
- App description and Privacy Nutrition Labels must reflect the AI data sharing

**Exact rejection message seen by developers:**
> "The app appears to share the user's personal data with a third-party AI service but the app does not clearly explain what data is sent, identify who the data is sent to, and ask the user's permission before sharing the data."
*(Apple Developer Forums thread 815109, app "Tenkobo")*

**Applies to CareCompanion?** Critical. CareCompanion's AI chat almost certainly sends user health queries (and potentially medication lists, caregiver context, health history) to an LLM provider. This is the single highest-risk rejection vector for the 2025–2026 cycle.

---

### 2. Account Deletion — Guideline 5.1.1(v)

**Effective:** June 30, 2022. Still a top rejection cause in 2025–2026 because new developers keep missing it, and existing apps keep implementing it incorrectly.

**What causes rejection:**
- No in-app delete option at all (relying on email-to-support)
- Offering only account *deactivation* (not full deletion)
- Deletion buried more than ~3 taps from Settings root
- Deleting the account but not deleting user-generated content (health logs, photos)
- Not revoking Sign in with Apple tokens via the REST API (`revoke_tokens`)
- Geographic restriction — must be available globally, not just GDPR/CCPA territories

**Healthcare exception (5.1.1(ix)):** Apple explicitly lists healthcare alongside banking, gambling, and air travel as industries that may have additional customer service steps for account deletion due to legal/regulatory data retention obligations. This means CareCompanion may offer a support-flow path *in addition to* (never *instead of*) an in-app initiation path — useful for HIPAA-compliant retention workflows.

---

### 3. Privacy Manifest — PrivacyInfo.xcprivacy

**Hard enforcement since:** May 1, 2024. Blocking happens at App Store Connect (automated) before human review — apps without proper manifests never reach a human reviewer.

**The third-party SDK trap:** Every bundled SDK needs its own manifest. Firebase Analytics, Crashlytics, Amplitude, Mixpanel, and similar analytics SDKs were the primary culprits in 2024. Firebase v10.24.0 (April 2024) fixed the ITMS-91053 errors by adding manifest coverage; if your app uses an older version, it will still be blocked. Check every entry in `Package.swift` or `Podfile`.

**Required Reason APIs — must declare a reason code:**
- `NSPrivacyAccessedAPICategoryUserDefaults` (UserDefaults — reason CA92.1)
- `NSPrivacyAccessedAPICategoryFileTimestamp` (file creation/modification — reason 3B52.1)
- `NSPrivacyAccessedAPICategoryDiskSpace` (disk space queries — reason 7D9E.1)
- `NSPrivacyAccessedAPICategorySystemBootTime`

**How to check:** Xcode → Product → Generate Privacy Report before submission.

---

### 4. Medical Claims — Guidelines 1.4.1 + 5.1.3

**Guideline 1.4.1** governs accuracy claims. Apps that claim medical-grade measurements without validated methodology (e.g., blood pressure via camera, SpO2 via selfie) are rejected outright. FDA warning letters sent in mid-2025 targeted blood-pressure estimation apps that used "wellness" positioning to avoid device classification — Apple followed the FDA's lead and tightened review of such apps.

**Guideline 5.1.3** adds health data restrictions on top:
- HealthKit data **cannot** be sent to third-party AI for advertising, marketing, or data mining — only for improving health management, and only with explicit permission (5.1.3(i))
- Cannot store personal health information in iCloud (5.1.3(ii))
- Apps framing LLM responses as diagnoses or treatment plans face the highest scrutiny

**Safe zone for CareCompanion:** Medication *reminders* are fine. General health *information* is fine. Symptom *logging* is fine. Diagnostic *conclusions* and medication *dosage advice* without licensed pharmacy or physician backing are not.

---

### 5. Age Rating Update — July 2025

Apple replaced the 4+/12+/17+ system with **4+/9+/13+/16+/18+** effective July 24, 2025.

New questionnaire dimensions relevant to health AI apps:
- *Capabilities:* Does the app include "chat or web access"? AI chatbots fall here.
- *Medical or wellness topics:* Does the app frequently reference medical/treatment information?
- *Violent themes*
- *In-app controls*

**Hard deadline:** January 31, 2026 — developers must complete the updated questionnaire for all existing apps. Missing the deadline blocks future update submissions.

A health AI companion that can discuss medications, conditions, and care plans — even if the target user is elderly — needs its rating assessed against content *capability*, not user intent. Health AI companions will likely land at **13+ minimum**, possibly 16+ depending on specificity of medical content generated.

---

### 6. Sign in with Apple — Guideline 4.8

Apple revised guideline 4.8 in January 2024 to remove the explicit name "Sign in with Apple" — replacing it with a description of the required attributes (no advertising data collection, email privacy, minimal data collection). In practice, Sign in with Apple is the only common third-party login that meets all three criteria, so reviewers still functionally require it when Google or Facebook login is offered.

**Visual prominence rule:** The Sign in with Apple button must not be visually subordinate to other auth options. A smaller Apple button below a large Google button reliably triggers 4.8 rejections.

---

### 7. In-App Purchase vs. External Payments — Guideline 3.1

**Post-Epic ruling (May 2025):** US App Store now allows a single external payment link or button. Apple cannot show "scare screens" or block the link. The 27% "link fee" is barred while the injunction stands (December 2025 appeals court modified this; Apple may introduce fees in the future).

**Still rejected globally:**
- Multiple external payment CTAs or promotional banners
- Stripe/Paddle checkout in non-US markets without the proper entitlement
- Making IAP appear inferior or penalizing users who pay through Apple

---

### 8. Medical Device Disclosure — New March 26, 2026

New requirement for all apps in Health & Fitness and Medical categories, or apps that declare "frequent medical/treatment references" in the age rating questionnaire. Developers must declare in App Store Connect whether the app is a regulated medical device.

- **If No:** Simple checkbox — no further documentation needed
- **If Yes:** Must provide EU Manufacturer SRN, FDA Operator Number, contact details, use instructions URL, and safety information

The declaration is displayed publicly on App Store product pages in EEA, UK, and US. Existing apps have until early 2027; new apps must declare at first submission.

---

## CareCompanion Risk Register

| Area | Risk Level | Action Required | Deadline |
|------|------------|-----------------|----------|
| AI/LLM consent modal (5.1.2(i)) | CRITICAL | Named-provider consent screen before first AI call; provider named in description and nutrition labels | Before next submission |
| Account deletion (5.1.1(v)) | HIGH | In-app delete in Settings; revoke SIWA tokens; healthcare retention flow optional-additional | Before next submission |
| Privacy manifest (PrivacyInfo.xcprivacy) | HIGH | Audit all SDKs; generate Privacy Report; update dependencies | Before next submission |
| Medical disclaimer + LLM guardrails (1.4.1, 5.1.3) | HIGH | Prominent in-app disclaimer; LLM prompted to deflect diagnoses; HealthKit data not sent to AI without per-permission | Before next submission |
| Age rating questionnaire (2.3.6) | HIGH | Complete updated questionnaire; expect 13+ rating; AI chatbot + medical topics both checked | **Jan 31, 2026** |
| Sign in with Apple (4.8) | HIGH (if Google login offered) | Add SIWA at equal or greater prominence | Before next submission |
| Demo account for review (2.1) | HIGH | Provide test credentials in App Review Notes; AI + health features accessible without real health data | Before next submission |
| Medical device declaration | MEDIUM | Declare "No" in App Store Connect (Health & Fitness category triggers requirement) | **Early 2027** (immediately for new submissions) |
| ATT consent (5.1.2) | MODERATE | Audit analytics SDKs; only request ATT if cross-company tracking occurs; no feature gating | Before next submission |
| External payments (3.1) | MODERATE | Use StoreKit for subscriptions; optionally add single Stripe link for US users post-May 2025 | Before adding Stripe |
| AI-generated code quality (4.2, 2.5.2) | LOW | Audit AI-generated code for private API calls; ensure app has real utility independent of AI | Before next submission |

---

## Sources

- [App Review Guidelines (live)](https://developer.apple.com/app-store/review/guidelines/)
- [Updated Guidelines — AI data sharing, Nov 2025](https://developer.apple.com/news/?id=ey6d8onl)
- [Account deletion requirement — Apple Developer](https://developer.apple.com/news/?id=12m75xbj)
- [Offering account deletion — Apple Support](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Privacy manifest enforcement](https://developer.apple.com/news/?id=r1henawx)
- [Age rating update — Apple Developer](https://developer.apple.com/news/?id=ks775ehf)
- [Medical device disclosure — Apple Developer](https://developer.apple.com/news/?id=nyqbfz1y)
- [Apple Developer Forums — AI rejection thread 815842](https://developer.apple.com/forums/thread/815842)
- [Apple Developer Forums — AI rejection thread 820209](https://developer.apple.com/forums/thread/820209)
- [Apple Developer Forums — AI rejection thread 815109](https://developer.apple.com/forums/thread/815109)
- [Apple 2024 Transparency Report — MacRumors, May 2025](https://www.macrumors.com/2025/05/30/app-store-2024-transparency-report/)
- [Age rating changes — 9to5Mac](https://9to5mac.com/2025/07/24/apple-notifies-developers-of-new-app-store-age-rating-system/)
- [Sign in with Apple rule change — 9to5Mac, Jan 2024](https://9to5mac.com/2024/01/27/sign-in-with-apple-rules-app-store/)
- [Medical device disclosure — MacRumors, Mar 2026](https://www.macrumors.com/2026/03/26/app-store-medical-device-status/)
- [Epic v. Apple ruling — RevenueCat](https://www.revenuecat.com/blog/growth/apple-anti-steering-ruling-monetization-strategy/)
- [Epic ruling, Apple changes US rules — TechCrunch, May 2025](https://techcrunch.com/2025/05/02/apple-changes-us-app-store-rules-to-let-apps-redirect-users-to-their-own-websites-for-payments/)
- [AI data sharing rule breakdown — dev.to](https://dev.to/arshtechpro/apples-guideline-512i-the-ai-data-sharing-rule-that-will-impact-every-ios-developer-1b0p)
- [Privacy manifest enforcement — Bitrise](https://bitrise.io/blog/post/enforcement-of-apple-privacy-manifest-starting-from-may-1-2024)
- [Account deletion compliance — capgo.app](https://capgo.app/blog/account-deletion-compliance-apple-guidelines/)
- [Italy fines Apple €98.6M over ATT — The Hacker News, Dec 2025](https://thehackernews.com/2025/12/italy-fines-apple-986-million-over-att.html)
- [App Store external payment 2025 — OpenForge](https://openforge.io/apple-app-store-external-payment-rule-2025/)
- [Apple requires medical device disclosure — 9to5Mac, Mar 2026](https://9to5mac.com/2026/03/26/new-app-store-policy-requires-medical-device-disclosures-for-some-health-apps/)
