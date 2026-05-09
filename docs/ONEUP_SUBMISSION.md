# 1upHealth Production Access Submission Package

**Company:** CareCompanion AI
**Product:** carecompanionai.org
**Contact:** privacy@carecompanionai.org
**Submission date:** [Fill in when submitting]

---

## App Details

| Field | Value |
|-------|-------|
| **App Name** | CareCompanion AI |
| **Short Description** | AI-powered cancer care companion for patients and family caregivers |
| **Website** | https://carecompanionai.org |
| **Privacy Policy** | https://carecompanionai.org/privacy |
| **Terms of Service** | https://carecompanionai.org/terms |
| **Support Email** | privacy@carecompanionai.org |
| **Redirect URI** | https://carecompanionai.org/api/fhir/callback |
| **Demo Walkthrough** | https://carecompanionai.org/demo-walkthrough |

## Long Description

CareCompanion AI is an all-in-one cancer care companion built for cancer patients and their family caregivers. It brings treatment tracking, medication management, chemo side effect logging, lab trend analysis, appointment preparation, caregiver coordination, and insurance navigation into one intelligent, AI-powered interface.

Powered by Anthropic Claude, the app personalizes every experience based on the patient's specific medications, lab results, conditions, and treatment history. We integrate with 1upHealth to automatically import patient health records from 700+ US health systems, eliminating manual data entry and keeping clinical data always up-to-date.

Our mission is to make cancer care radically simpler, smarter, and more humane — so patients and caregivers can spend less time managing information and more time focusing on what actually matters.

## Scopes Requested

We request the following FHIR R4 scopes:

- `patient/Patient.read` — basic demographics (name, age, gender)
- `patient/MedicationRequest.read` — active medications for personalized care
- `patient/Condition.read` — diagnoses for treatment context
- `patient/AllergyIntolerance.read` — safety warnings for drug interactions
- `patient/Observation.read` — lab results for trend analysis
- `patient/Appointment.read` — upcoming visits for preparation
- `patient/Practitioner.read` — care team contact info
- `patient/ExplanationOfBenefit.read` — insurance claims for cost tracking
- `patient/Coverage.read` — insurance plan details

---

## Reviewer Test Account

**URL:** https://carecompanionai.org/login
**Email:** reviewer@carecompanionai.org
**Password:** OneUpReview2026!

This account is pre-loaded with realistic HER2+ Breast Cancer patient data including:
- 8 cancer-related medications (Trastuzumab, Pertuzumab, Docetaxel, etc.)
- 7 lab results with abnormal flagging (WBC, HER2/neu, CA 15-3, etc.)
- 4 upcoming oncology appointments
- 4 care team members
- Full insurance coverage details

The reviewer walkthrough page at `/demo-walkthrough` includes this info with a clear "For 1upHealth Review Team" section at the top.

---

## Security & Privacy

### HIPAA-Aligned Architecture

While CareCompanion is not currently a HIPAA-covered entity, we follow HIPAA-aligned practices throughout:

- **Database:** Supabase (PostgreSQL) with SOC 2 Type II certification
- **Encryption in transit:** TLS 1.2+
- **Encryption at rest:** AES-256
- **Row-Level Security (RLS):** cryptographically enforced on every table
- **Access control:** users can only access their own data, plus data explicitly shared with them via care team invitations
- **Authentication:** Supabase Auth with email/password and Google OAuth
- **OAuth tokens:** encrypted and scoped to read-only access
- **Passwords:** we never see or store hospital login passwords

### Data Usage Commitments

- We never use health data for advertising
- We never sell data to third parties
- We never share data without explicit consent except as required by law
- Users can disconnect any health system integration at any time
- Account deletion permanently removes all data within 30 days
- Full data export available via Settings

### User Consent

Before the OAuth flow begins, users see a data consent modal (`DataConsentModal` component) that explicitly lists:
- What data will be imported (8 categories)
- How it will be used
- Read-only access guarantee
- Disconnect anytime guarantee
- Never sell guarantee
- Link to full privacy policy

---

## Technical Implementation

### OAuth Flow

1. User clicks "Connect Health Records" on `/connect` page
2. Data consent modal appears requiring explicit agreement
3. Redirect to `/api/fhir/authorize?provider=1uphealth`
4. Our server creates a 1upHealth user via their user management API
5. Exchange for access token via `api.1up.health/fhir/oauth2/token`
6. Redirect to `system-search.1up.health/search` for health system selection
7. User authenticates with their hospital portal
8. Callback to `/api/fhir/callback` with authorization code
9. Store encrypted access token in `connected_apps` table
10. Trigger `syncOneUpData()` to pull FHIR resources

### Data Sync

- Uses FHIR R4 endpoint: `api.1up.health/r4`
- Fetches via `fhirSearchAll()` with pagination support
- Upserts data with deduplication
- Runs AI-powered cancer type detection via Claude
- Background cron job runs daily at 10am UTC via Vercel
- Token refresh handled automatically

### Key Files for Review

- `src/lib/oneup.ts` — OAuth and FHIR client
- `src/lib/oneup-sync.ts` — Sync engine mapping FHIR → our schema
- `src/lib/fhir.ts` — FHIR R4 resource parsers
- `src/app/api/fhir/authorize/route.ts` — OAuth entry point
- `src/app/api/fhir/callback/route.ts` — OAuth callback handler
- `src/components/DataConsentModal.tsx` — User consent UI
- `supabase/migrations/` — Database schema with RLS policies

---

## Compliance Documentation

### Where to find our commitments

- **Privacy Policy:** https://carecompanionai.org/privacy
  - Section 2: What data we collect
  - Section 3: How we use data (with "never" commitments)
  - Section 4: Storage and protection (Supabase SOC 2, RLS, encryption)
  - Section 5: Health system integrations (1upHealth disclosure)
  - Section 7: Data retention and deletion
  - Section 12: Security practices (TLS, AES-256, RLS, OWASP)

- **Terms of Service:** https://carecompanionai.org/terms
  - Section 2: What CareCompanion is (health info organizer, not medical provider)
  - Section 3: Not medical advice disclaimer
  - Section 5: Health data ownership
  - Section 8: AI limitations
  - Section 11: Liability

---

## Pre-Submission Checklist

Before submitting, verify each of these is still true:

- [ ] Production site loads: `curl -I https://carecompanionai.org` returns 200
- [ ] Demo walkthrough loads: `curl -I https://carecompanionai.org/demo-walkthrough` returns 200
- [ ] Privacy policy loads: `curl -I https://carecompanionai.org/privacy` returns 200
- [ ] Terms loads: `curl -I https://carecompanionai.org/terms` returns 200
- [ ] Reviewer test account has been created in Supabase
- [ ] Reviewer account can log in and see dashboard
- [ ] Reviewer account has demo data pre-loaded
- [ ] Data consent modal shows before OAuth flow
- [ ] Privacy email `privacy@carecompanionai.org` receives mail
- [ ] 1upHealth redirect URI matches production URL
- [ ] Client ID and secret are set in Vercel env vars (production)
- [ ] Care team RLS migration has been run on production Supabase
- [ ] No console errors on any public page
- [ ] Mobile responsive check on landing, demo, login, dashboard
- [ ] CORS error on OAuth link fixed (uses `<a>` not `<Link>`)
- [ ] Privacy policy specifically mentions 1upHealth by name (section 5)
- [ ] ConnectAccounts page shows 1upHealth as primary integration

---

## Deliverables Attached (if needed)

- [ ] Screenshots of OAuth flow end-to-end
- [ ] Screenshot of data consent modal
- [ ] Screenshot of populated dashboard after data import
- [ ] Screenshot of privacy policy section 5 (health integrations)
- [ ] Architecture diagram (optional)

---

## What We're Requesting

**Approval to move from 1upHealth sandbox to production access**, so that CareCompanion users can connect their real health records from Epic MyChart, Kaiser, Sutter Health, Aetna, UnitedHealthcare, Medicare, and other supported systems.

We have tested extensively against the sandbox environment and are ready for production traffic. Our app is live, tested, and has active users waiting for health record connection.

Thank you for your review.

— CareCompanion AI Team
privacy@carecompanionai.org
https://carecompanionai.org
