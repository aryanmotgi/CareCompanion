# CareCompanion — App Store Review Notes

> **Before submitting to Apple:** Fill in the credentials section below.
> Do **not** commit real passwords to this file — store them in your password manager.

---

## Demo Account Credentials

> **⚠️ USER MUST FILL THESE IN BEFORE APP STORE SUBMISSION**

| Field        | Value                                          |
|--------------|------------------------------------------------|
| Email        | `appreview@carecompanionai.org`                |
| Password     | `[FILL IN — value of DEMO_ACCOUNT_PASSWORD]`   |
| Account type | Patient (Jordan Meridian, HER2+ Breast Cancer) |

To provision the demo account before submission, run:
```bash
DEMO_ACCOUNT_PASSWORD=<your-password> npx tsx apps/web/src/lib/db/seed-demo.ts
```

---

## Step-by-Step Reviewer Walkthrough

The demo account comes pre-loaded with a realistic HER2+ Breast Cancer patient
profile (Jordan Meridian), 30 days of AI chat history, 6 medications, 12 lab
values, a care group with 2 caregivers, wellness vitals, and check-ins.
No HealthKit connection is required for this account.

### Step 1 — Log In
1. Open the app and tap **Sign In**.
2. Enter email `appreview@carecompanionai.org` and the password above.
3. Tap **Sign In**. You will land directly on the **Dashboard** (onboarding is
   pre-completed; the HealthKit step is automatically skipped for this account).

### Step 2 — Dashboard & Health Score
1. The Dashboard shows Jordan's current **Health Score** (composite of lab
   trends, medication adherence, and recent check-ins).
2. Notice the **alert card** at the top: low WBC (3.2 K/µL) with a
   neutropenia watch advisory.
3. Tap the alert card to see the full explanation and recommended actions.

### Step 3 — Chat with Care OS AI Assistant
1. Tap the **Chat** tab (bottom navigation).
2. You will see 6 existing conversations from the past 30 days covering side
   effects, lab results, appointment prep, and nutrition.
3. Tap any conversation to read the full AI-assisted dialogue.
4. Start a **new conversation** by tapping the compose icon (top right).
5. Ask a sample question such as:
   *"What questions should I ask my oncologist about my WBC count?"*
   The assistant has full context of Jordan's profile, medications, and labs.

### Step 4 — Medications & Refill Tracking
1. Tap the **Care** tab → **Medications**.
2. Jordan has 6 active medications: Trastuzumab, Pertuzumab, Docetaxel,
   Ondansetron, Dexamethasone, and Tamoxifen.
3. Notice **Ondansetron** has a refill alert (due in 3 days).
4. Tap any medication to view dosing instructions, prescribing doctor, and
   the AI-powered drug interaction summary.

### Step 5 — Lab Results & Trends
1. From the **Care** tab, tap **Lab Results**.
2. Jordan has 12 lab values across 2 draw dates (3 days ago and 21 days ago).
3. Abnormal values (WBC, HER2/neu, Hemoglobin, Platelet Count) are flagged
   with directional indicators showing the trend between draws.
4. Tap **HER2/neu** to see the trend chart and AI interpretation.

### Step 6 — Care Team (Caregiver Collaboration)
1. Tap the **Care** tab → **Care Team**.
2. Jordan's care group "Meridian Care Team" includes two caregivers:
   - **Sam Meridian** (spouse) — can view meds, labs, and appointments
   - **Dana Meridian** (parent) — can view meds and appointments
3. Tap a caregiver to see their permission settings and activity log.
4. Tap **Share Care Code** to preview the invite-code flow for adding new
   caregivers (no caregiver login is required for the review).

### Step 7 — Wellness Check-in
1. From the **Dashboard**, tap the **Check-in** button (or the floating
   action button on the Care tab).
2. Complete the 4-field check-in: mood (1–5), pain (0–10), energy, sleep.
3. Tap **Save**. The check-in is logged and the streak counter increments.
4. Return to the Dashboard — the health score updates to reflect the new
   check-in, and the AI assistant now has awareness of today's symptoms.

### Step 8 — Notifications
1. Tap the **bell icon** (top right of Dashboard).
2. Jordan has 5 notifications: 2 unread (WBC warning, refill reminder) and
   3 read (appointment reminder, CA 15-3 improvement, caregiver activity).
3. Tap the WBC notification to navigate directly to the lab results detail.
4. Tap **Mark all as read** to demonstrate the badge clear behavior.

### Step 9 — Clinical Trial Matches
1. Tap the **Care** tab → **Clinical Trials** (or scroll to the Trials section
   on the Dashboard).
2. Jordan's profile (HER2+, ER+, Stage IIIA, prior lumpectomy) is matched
   against active trials. Tap **Refresh Matches** to trigger the AI matching
   pipeline.
3. Each match card shows eligibility score, match reasons, and disqualifying
   factors. Tap a card to view the full trial detail.
4. Tap **Bookmark** on one trial to demonstrate the saved-trial feature.

### Step 10 — Health Summary Export & Sharing
1. From the Dashboard or the profile menu, tap **Export Health Summary**.
2. Choose **PDF** to generate a formatted clinical summary (medications, labs,
   appointments, recent AI insights).
3. Alternatively, tap **Share Link** to create a time-limited shareable URL
   that can be sent to a physician — no app required on the recipient's side.
4. Tap **Revoke Link** to immediately invalidate the shared link and
   demonstrate privacy controls.

---

## Known Limitations for This Review Build

| Limitation | Detail |
|------------|--------|
| HealthKit skipped | The demo account bypasses the HealthKit authorization step. Wellness vitals are pre-seeded synthetic data rather than real Apple Health data. |
| Push notifications | Web Push requires an HTTPS origin on a real device. In-app notifications work fully; push delivery may not work in the Simulator. |
| Apple Sign-In | Available but the demo account uses email/password for simplicity. Apple Sign-In works on a real device. |
| Caregiver login | Caregiver demo users (Sam, Dana) are read-only data fixtures; they cannot be logged into without a separate password. |
| Clinical trials | Trial match results depend on external ClinicalTrials.gov availability; a network timeout shows a graceful empty state. |
| Community Forum | Uses moderation filtering — posts are visible after passing a lightweight safety check (typically instant on staging). |

---

## Contact

For questions during App Store review, please contact:

**Email:** support@carecompanionai.org  
**Subject line:** App Store Review — CareCompanion  

We monitor this address during active review periods and typically respond
within 4 hours (Pacific time, business days).
