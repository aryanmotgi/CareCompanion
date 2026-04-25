# Auth & Onboarding Redesign — Design Spec

**Date:** 2026-04-25
**Status:** Approved for implementation

---

## Problem

The current login and onboarding flow has three compounding issues:

1. **Role selection is too late.** Users sign up before ever indicating whether they are a caregiver or a patient. Role is buried in step 1 of the onboarding wizard, after signup is already complete.
2. **Account linking is buried.** Connecting a caregiver account to a patient account happens via "Care Team" settings — a separate area users rarely discover during initial setup.
3. **Onboarding step order is wrong.** The wizard asks "who is this for?" after the user already signed up, and asks patients to manually enter diagnosis info that Apple Health can provide automatically.

---

## Solution Overview

**Approach A: Sign Up First, Connect Second.**

- Role is a required field on the signup form itself.
- Immediately after signup, users are taken to a standalone **Care Group screen** to create, join, or skip linking their account to a caregiver or patient.
- The onboarding wizard then runs with role-aware steps tailored to the user's account type.
- Login supports two paths: email login and Care Group login (family name + shared password).

---

## User Paths

### Path 1 — Caregiver Only (no patient account)
Signup → Care Group (create/skip) → Wizard → Dashboard

### Path 2 — Patient / Self-care
Signup → Care Group (create/skip) → Wizard (HealthKit first) → Dashboard

### Path 3 — Linked (both have accounts)
Either person goes first and creates a Care Group. The other person signs up and joins it. No coordination of timing required — whoever goes second just joins. The patient is always the one who connects Apple Health on their own device.

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
  - 🤒 **Patient** — "Managing my own care"
  - 👤 **Self-care** — "Independent, no caregiver"

**Social sign-in:** Apple and Google remain available. Role selector appears before social buttons so the user sets their role regardless of signup method.

**Existing signup logic** (email validation, password strength, HIPAA consent) is preserved.

---

### 2. Care Group Screen (new — appears immediately after signup for all users)

**Heading:** "Set up your Care Group"
**Subheading:** "Connect with your caregiver or patient so you can share health data."

**Options (single select):**
- **Create a new Care Group** — User picks a family/group name and sets a shared password. They receive a shareable invite link/code to give to the other person.
- **Join an existing Care Group** — User enters the family name + shared password provided by the other person. Instantly linked on submission.
- **Skip for now** — Solo mode. Can connect later from settings.

**After creating or joining a Care Group (caregiver path only):**
Show an invite prompt:
> "Invite your patient to connect their Apple Health records."

Offer two share options:
- Share via SMS (pre-filled message with deep link)
- Copy link

The deep link routes the patient directly into the Patient onboarding path with the Care Group pre-joined — they do not need to manually enter the group name/password.

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

**Note:** Care Group login authenticates the user and loads their associated individual account. It is a convenience login path, not a separate account type.

---

## Caregiver Onboarding Wizard

Steps run after the Care Group screen.

### Step 1 — About your patient (updated)
- Patient name (required)
- Patient age (optional)
- **Your relationship to patient** (dropdown): Spouse / Parent / Child / Sibling / Friend / Professional caregiver / Other
- **Caregiving experience level** (single select): First time caregiver / Some experience / Experienced caregiver

### Step 2 — Primary concern (new)
**Question:** "What's your biggest challenge right now?"

**Options (single select, tappable tiles):**
- 💊 Managing medications
- 🧪 Understanding lab results and appointments
- 🏥 Coordinating care and specialists
- 💙 Emotional support and guidance

**Behavior:** Selection is saved to the user profile. It is passed as context to the AI companion so its **first message is personalized** to that specific concern. Example: if the user selects "Managing medications," the AI companion opens with a message about medication tracking rather than a generic greeting.

### Step 3 — Apple Health heads-up
**Copy:** "Ask your patient to connect their hospital through Apple Health on their phone. Once they do, their diagnosis, medications, and lab results will sync here automatically."

CTA: "Got it" (continues)
Optional: "Resend invite link" (if they created/joined a Care Group)

### Step 4 — Diagnosis (placeholder)
Cancer type · Stage · Treatment phase

Shown with a note: "You can update this once your patient syncs their health records."
This data is overridden when the patient connects Apple Health + hospital.

### Step 5 — Priorities
Pick up to 3 focus areas from: side effects, medications, appointments, lab results, insurance, emotional support. (Existing logic preserved.)

### Step 6 — Notifications (new)
**Copy:** "Stay on top of medications, appointments, and care updates."
- Primary CTA: "Enable notifications" (triggers OS permission prompt)
- Secondary CTA: "Maybe later"

### → Dashboard

---

## Patient Onboarding Wizard

Steps run after the Care Group screen.

### Step 1 — Connect Apple Health + Hospital
**Copy:** "Connect your hospital through Apple Health — we'll automatically pull in your diagnosis, medications, and lab results."

- Primary CTA: "Connect Apple Health" → triggers HealthKit + Health Records authorization
- Secondary CTA: "Skip for now" → branches to manual entry fallback (see below)

**On successful connection:** The app reads FHIR clinical records from Apple Health to pull diagnosis (cancer type, stage), current medications, recent lab results, and upcoming appointments.

### Step 2a — Confirm records (if HealthKit connected)
App displays what it pulled from the hospital connection:
- Diagnosis (cancer type + stage)
- Medications list
- Recent lab results
- Next appointment date

**Copy:** "Does this look right? Tap any item to edit."

All fields are editable inline. User confirms and continues.

### Step 2b — Manual entry fallback (if HealthKit skipped)
Instead of landing on an empty dashboard, show a lightweight manual entry screen:
- Diagnosis (cancer type + stage)
- Current medications (add up to 3)
- Next appointment date

**Copy:** "You can update these anytime from your profile."

This screen replaces the empty dashboard state entirely.

### Step 3 — Priorities
Pick up to 3 focus areas. (Existing logic preserved.)

### Step 4 — Notifications (new)
Same as caregiver:
**Copy:** "Stay on top of medications, appointments, and care updates."
- "Enable notifications" / "Maybe later"

### → Dashboard
If connected via Care Group: caregiver now has visibility into synced records.

---

## Data Model Changes

### Users table
- Add `role` field: `'caregiver' | 'patient' | 'self'` — set at signup, not onboarding

### Care Groups table (new)
```
- id (UUID)
- name (string, unique) — the "family name"
- passwordHash (string) — hashed shared password
- createdBy (FK → users)
- createdAt (timestamp)
```

### Care Group Members table (new)
```
- careGroupId (FK → care_groups)
- userId (FK → users)
- role ('owner' | 'member')
- joinedAt (timestamp)
```

### Care Profiles table (existing — additions)
- `relationship`: expand to include all new dropdown values (Spouse, Parent, Child, Sibling, Friend, Professional caregiver, Other)
- `caregivingExperience`: `'first_time' | 'some_experience' | 'experienced'`
- `primaryConcern`: `'medications' | 'lab_results' | 'coordinating_care' | 'emotional_support'`

### Invite Links
- Deep link format: `carecompanion://join?group={groupId}&token={inviteToken}`
- Token expires after 7 days
- On open: pre-fills Care Group join step, skips manual entry

---

## AI Companion Personalization

The `primaryConcern` field (caregiver only) is passed as system context to the AI companion on first load. Mapping:

| primaryConcern | First message tone |
|---|---|
| `medications` | Opens with medication tracking tip or medication schedule prompt |
| `lab_results` | Opens with offer to explain recent lab results |
| `coordinating_care` | Opens with specialist coordination or appointment overview |
| `emotional_support` | Opens with empathetic check-in message |

---

## What Is Not Changing

- Existing NextAuth session/JWT logic
- Existing care team invite system (email-based) remains for adding additional team members post-onboarding
- Existing OnboardingWizard step rendering logic — new steps are additive
- Existing cancer type, stage, treatment phase options
- Existing priorities selection (up to 3)
- Social sign-in (Apple, Google)
- HIPAA consent flow
- Password strength validation

---

## Post-implementation

- Run `/plan-ceo` review after implementation is complete
- Run `/design-review` on implemented screens
