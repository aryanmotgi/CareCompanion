# Auth & Onboarding Redesign — Design Spec

**Date:** 2026-04-25
**Status:** Approved for implementation

---

## Problem

The current login and onboarding flow has three compounding issues:

1. **Role selection is too late.** Users sign up before indicating whether they are a caregiver or a patient. Role is buried in step 1 of the onboarding wizard, after signup is complete.
2. **Account linking is buried.** Connecting a caregiver account to a patient account happens via "Care Team" settings — a separate area users rarely discover during initial setup.
3. **Onboarding step order is wrong.** The wizard asks "who is this for?" after signup, and asks patients to manually enter diagnosis info that Apple Health can provide automatically.

---

## Solution Overview

**Approach A: Sign Up First, Connect Second.**

- Role is a required field on the signup form itself.
- Immediately after signup, users land on a standalone **Care Group screen** to create, join, or skip linking their account.
- The onboarding wizard then runs with role-aware steps tailored to the user type.
- Login supports two paths: individual email login and Care Group login (family name + shared password — resolves to the group owner's account).

---

## User Paths

### Path 1 — Caregiver
Signup (role = Caregiver) → Care Group → Wizard → Dashboard

### Path 2 — Patient
Signup (role = Patient) → Care Group → Wizard (HealthKit first) → Dashboard

### Path 3 — Self-care
Signup (role = Self-care) → Care Group (with self-appropriate copy) → Wizard (identical to Patient path) → Dashboard

Self-care users manage their own health with no linked caregiver. They follow the Patient wizard. The Care Group screen copy adjusts to: "Connect with a family member or caregiver if you'd like to share your health data." All three Care Group options (create, join, skip) remain available.

### Path 4 — Linked (both have accounts)
Either person signs up first and creates a Care Group. The second person signs up and joins it. Whoever goes second just enters the group name + password. The patient is always the one who connects Apple Health on their own device.

---

## Screen-by-Screen Design

### 1. Signup Form (updated)

**Fields:**
- Full name
- Email address
- Password
- HIPAA consent checkbox
- **Role selector (required, 3 tiles):**
  - 🧑‍⚕️ **Caregiver** — "Helping someone I love"
  - 🤒 **Patient** — "Managing my own care, with a caregiver"
  - 👤 **Self-care** — "Managing my own care independently"

**Social sign-in (Apple, Google):** Role selection is encoded into the OAuth `state` parameter before initiating the provider redirect. On callback, the `state` is decoded and the role is saved to the user account. This approach is safe across new tabs and popup windows (Apple Sign-In opens a popup on web). Do not use `sessionStorage` — it is tab-scoped and does not survive popup-based OAuth flows. If an existing account returns with no role set (pre-feature user), route them to a standalone role-selection screen before resuming the normal post-login flow.

**Error states:**
- Email already exists → "An account with this email already exists. Sign in instead?"
- Weak password → inline strength indicator (existing logic preserved)
- Role not selected → inline validation "Please select your role to continue"

**Existing signup logic** (email validation, password strength, HIPAA consent) is preserved.

---

### 2. Care Group Screen (new — appears immediately after signup for all users)

**Heading:** "Set up your Care Group"

**Subheading (role-aware):**
- Caregiver: "Connect with your patient so you can share their health data."
- Patient / Self-care: "Connect with a family member or caregiver if you'd like to share your health data."

**Options:**
- **Create a new Care Group** — User picks a group name and sets a shared password. Name + password are stored; the name does not need to be globally unique — the join lookup matches on name + password together (no DB unique constraint on name).
- **Join an existing Care Group** — User enters the group name + password. On match, their account is added as a `member`. On failure: "No Care Group found with that name and password. Check with whoever created the group."
- **Skip for now** — Solo mode. A persistent banner appears on the dashboard ("Connect with your caregiver or patient — set up your Care Group") until dismissed or completed. Accessible from Settings > Care Group at any time.

**Invite flow (after creating or joining — caregiver path):**
> "Invite your patient to connect their Apple Health records."

- **Share via SMS** — pre-filled message: "I'm using CareCompanion to help manage your care. Tap this link to connect: [link]"
- **Copy link**

**Invite link format:**
- Primary: `https://carecompanion.app/join?group={groupId}&token={inviteToken}` (HTTPS universal link with App Store fallback for users without the app installed)
- The universal link opens the app if installed, or routes to the App Store / web onboarding if not.
- Token is **single-use** and expires after 7 days. After use, the token is marked consumed and cannot be replayed.
- Caregiver can revoke the invite from Settings > Care Group > Pending Invites. Revocation marks the token as expired immediately.
- Max **5 active (unconsumed, non-expired, non-revoked) tokens** per Care Group at a time. Attempting to generate a 6th shows: "You have too many pending invites. Revoke one to create a new one."
- Max 10 members per Care Group (enforced at join time with a clear error message).

**Leaving a Care Group:**
- Any member can leave from Settings > Care Group > Leave Group.
- If the **owner** leaves: ownership transfers to the longest-standing member. If no other members exist, the group is dissolved.
- On leaving: the departing user loses access to shared data. Synced FHIR data already stored in CareCompanion is retained for the remaining members but is no longer updated from the departing user's device.
- A user may join a different Care Group after leaving. They cannot be in more than one Care Group at a time.

---

### 3. Login Screen (updated)

**Two login modes via tab toggle:**

**Tab 1 — Email login (default):**
- Email field
- Password field
- Forgot password link
- Sign in button
- Apple / Google social sign-in

**Tab 2 — Care Group login:**
- Care Group name field
- Group password field
- Sign in with Care Group button

Care Group login resolves to the **current group owner's account**. It is intended for the primary caregiver or patient on a shared device (e.g., a tablet at home). Other members must log in with their individual email credentials. Ownership always transfers automatically when an owner leaves (to the longest-standing remaining member), so Care Group login always resolves to whoever is currently the owner — there is no disabled state due to owner departure. The only case where Care Group login is unavailable is if the group has been dissolved (zero members). In that case users see: "This Care Group no longer exists. Please sign in with your email."

If two groups share the same name and password (unlikely but possible), the join query resolves to the **oldest matching group** (lowest `createdAt`). On group creation, if the entered name + password combination already matches an existing group, the UI warns: "A Care Group with this name and password already exists. Choose a different name or password."

**Error states:**
- Wrong email/password → "Email or password is incorrect"
- Wrong Care Group credentials → "No Care Group found with that name and password"
- Account locked (rate limit exceeded) → "Too many attempts. Try again in 15 minutes."

---

## Caregiver Onboarding Wizard

Runs after the Care Group screen.

### Step 1 — About your patient
- Patient name (required)
- Patient age (optional)
- **Your relationship to patient** (dropdown): Spouse / Parent / Child / Sibling / Friend / Professional caregiver / Other
- **Caregiving experience level** (single select tiles): First time caregiver / Some experience / Experienced caregiver

### Step 2 — Primary concern (new)
**Question:** "What's your biggest challenge right now?"

**Options (single select, tappable tiles):**
- 💊 Managing medications
- 🧪 Understanding lab results and appointments
- 🏥 Coordinating care and specialists
- 💙 Emotional support and guidance

**Behavior:** Saved to `careProfiles.primaryConcern`. Passed as ongoing system context to the AI companion — not just for the first message, but as a persistent lens for the entire care session. The AI companion references this concern in proactive suggestions, summaries, and check-ins throughout the session. Example: if `medications` is selected, the AI opens with a medication tracking prompt and subsequently prioritizes medication-related alerts and explanations.

### Step 3 — Apple Health heads-up
**Copy:** "Ask your patient to connect their hospital through Apple Health on their phone. Once they do, their diagnosis, medications, and lab results will automatically appear here."

CTA: "Got it"
Optional: "Resend invite link" (if they created/joined a Care Group)

### Step 4 — Diagnosis (placeholder)
Shown **only if** the linked patient has not yet synced their Apple Health records. If the patient has already synced, this step is skipped and the caregiver sees a "Records already synced from [patient name]'s Apple Health" confirmation instead.

Fields: Cancer type · Stage · Treatment phase

Note shown: "This will be updated automatically once your patient connects Apple Health."

When patient records sync later, the caregiver receives a push notification: "[Patient name]'s health records have synced. Your dashboard has been updated." The manually entered data is replaced silently — no conflict prompt.

### Step 5 — Priorities
Pick up to 3 focus areas: side effects, medications, appointments, lab results, insurance, emotional support. (Existing logic preserved.)

### Step 6 — Notifications (new)
**Copy:** "Stay on top of medications, appointments, and care updates."
- Primary CTA: "Enable notifications" → triggers OS permission prompt. If permission was already granted (e.g. reinstall), the button succeeds silently and the step auto-advances.
- Secondary CTA: "Maybe later" → skips, accessible later from Settings > Notifications.

### → Dashboard

---

## Patient & Self-care Onboarding Wizard

Self-care users follow this exact path. Steps are identical.

### Step 1 — Connect Apple Health + Hospital
**Copy:** "Connect your hospital through Apple Health — we'll automatically pull in your diagnosis, medications, and lab results."

- Primary CTA: "Connect Apple Health" → triggers HealthKit + Health Records (FHIR) authorization
- Secondary CTA: "Skip for now" → branches to manual entry (Step 2b)

**On successful connection:** App reads FHIR clinical records to pull: diagnosis (cancer type + stage), current medications, recent lab results, upcoming appointments. If the hospital connection succeeds but only partial records are available (e.g., medications exist but no diagnosis), the confirmation screen shows populated fields where data exists and empty editable fields where it does not. The user is prompted to fill in the gaps manually. No field is silently left empty.

If the hospital is connected but FHIR records are still pending (newly connected, data not yet available), show a "Your records are syncing — this may take a few minutes" state with a spinner. The wizard can still advance; the confirmation screen will populate once sync completes. A push notification fires when records arrive.

### Step 2a — Confirm records (if HealthKit connected)
Displays what was pulled:
- Diagnosis (cancer type + stage)
- Medications list
- Recent lab results
- Next appointment date

**Copy:** "Does this look right? Tap any item to edit."

Edits made here are stored as local overrides in CareCompanion's database. On subsequent HealthKit syncs, FHIR data does **not** overwrite fields the user has manually edited — user edits win. FHIR data only populates fields that have not been manually touched.

### Step 2b — Manual entry fallback (if HealthKit skipped)
- Diagnosis (cancer type + stage — same picker as wizard)
- Current medications (add up to 3, editable later)
- Next appointment date

**Copy:** "You can update these anytime from your profile."

A persistent banner on the dashboard ("Connect Apple Health for automatic updates") nudges the user to connect HealthKit later. Dismissible.

**Error state:** If the user skips and leaves all fields blank, allow them to proceed but show a softer prompt: "Your dashboard will be empty until you add some info. Continue anyway?" with Yes / Go back.

### Step 3 — Priorities
Pick up to 3 focus areas. (Existing logic preserved.)

### Step 4 — Notifications (new)
Same as caregiver step 6:
**Copy:** "Stay on top of medications, appointments, and care updates."
- "Enable notifications" (handles already-granted state silently) / "Maybe later"

### → Dashboard
If connected via Care Group: caregiver now has visibility into synced records.

---

## Data Model Changes

### Users table
- Add `role` column: `'caregiver' | 'patient' | 'self'` — set at signup. Nullable for pre-existing accounts; those accounts are prompted to set role on next login.

### Care Groups table (new)
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT NOT NULL           -- not unique; join uses name+passwordHash together
passwordHash TEXT NOT NULL
createdBy   UUID NOT NULL REFERENCES users(id)
createdAt   TIMESTAMPTZ DEFAULT now()
```

### Care Group Members table (new)
```sql
careGroupId UUID NOT NULL REFERENCES care_groups(id) ON DELETE CASCADE
userId      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
role        TEXT NOT NULL CHECK (role IN ('owner', 'member'))
joinedAt    TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (careGroupId, userId)   -- composite PK prevents duplicate membership
```

### Care Group Invites table (new)
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
careGroupId UUID NOT NULL REFERENCES care_groups(id) ON DELETE CASCADE
token       TEXT NOT NULL UNIQUE
createdBy   UUID NOT NULL REFERENCES users(id)
usedBy      UUID REFERENCES users(id)   -- set on redemption
expiresAt   TIMESTAMPTZ NOT NULL        -- 7 days from creation
revokedAt   TIMESTAMPTZ                 -- set on manual revocation
createdAt   TIMESTAMPTZ DEFAULT now()
```

### Care Profiles table (additions to existing)
```sql
relationship          TEXT    -- expand existing values to include all new options
caregivingExperience  TEXT    -- 'first_time' | 'some_experience' | 'experienced'
primaryConcern        TEXT    -- 'medications' | 'lab_results' | 'coordinating_care' | 'emotional_support'
fieldOverrides        JSONB   -- tracks which fields the user has manually edited, e.g. {"cancerType": true, "stage": true}
                              -- FHIR sync does not overwrite fields where fieldOverrides[field] = true
```

---

## AI Companion Personalization

`primaryConcern` (captured for caregivers; future: extend to patient/self-care) is injected as persistent system context into every AI companion session for that care profile.

| primaryConcern | AI behavior |
|---|---|
| `medications` | Prioritizes medication alerts, explains drug interactions, surfaces missed dose patterns |
| `lab_results` | Proactively summarizes recent labs, explains values in plain language, flags abnormal results |
| `coordinating_care` | Surfaces upcoming specialist appointments, suggests questions to ask doctors, tracks referral status |
| `emotional_support` | Opens with empathetic check-in, offers coping resources, monitors caregiver stress signals |

---

## What Is Not Changing

- Existing NextAuth session/JWT logic
- Existing care team invite system (email-based) remains for adding additional team members post-onboarding
- Existing OnboardingWizard step rendering logic — new steps are additive
- Existing cancer type, stage, treatment phase option values
- Existing priorities selection (up to 3)
- Social sign-in (Apple, Google)
- HIPAA consent flow
- Password strength validation
- Rate limiting on login (50 attempts / 15 min / email)

---

## Post-implementation

- Run `/plan-ceo` review after implementation is complete
- Run `/design-review` on implemented screens
