# CareCompanion Manual QA Checklist

**Version:** v1
**Last updated:** 2026-04-23
**Applies to:** Web (Next.js) + iOS (Expo)

Use this checklist before every release. Mark each step Pass / Fail / Skip and note any issues in the Findings column.

---

## Setup

- [ ] Deploy staging build with `NEXT_PUBLIC_TEST_MODE=true` / `EXPO_PUBLIC_TEST_MODE=true`
- [ ] Confirm Staging Mode banner appears on launch (fades after ~4 s)
- [ ] Log in as `tester1@test.carecompanionai.org` using the QA password

---

## 1. Auth

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 1 | Sign in with valid credentials | Redirects to dashboard | |
| 2 | Sign out | Returns to login screen | |
| 3 | Sign in with wrong password | Error message shown, no redirect | |
| 4 | Sign in with non-existent email | Error message shown, no redirect | |
| 5 | Attempt to access `/dashboard` while signed out (web) | Redirects to `/login` | |

---

## 2. Onboarding

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6 | Complete full onboarding flow with test patient info | Redirects to dashboard after completion | |
| 7 | Skip optional onboarding steps | Proceeds without error | |
| 8 | After onboarding, visit dashboard | Patient name and profile data appear correctly | |

---

## 3. Dashboard

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 9 | Load dashboard | Renders within 3 s on a standard connection | |
| 10 | Verify patient name | Displays seeded patient name (Alex Test-Patient) | |
| 11 | Check medication count | Shows 3 seeded medications | |
| 12 | Check upcoming appointments | Shows 2 seeded appointments | |
| 13 | Check notifications badge | Shows 3 unread notifications | |
| 14 | Check health score / summary card | Renders without error (value may be placeholder) | |

---

## 4. Medications

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 15 | View medication list | All 3 seeded medications listed | |
| 16 | Add a new medication | Medication appears in list after save | |
| 17 | Edit an existing medication | Changes persist after save | |
| 18 | Delete a medication | Medication removed from list | |
| 19 | Add a medication reminder | Reminder saved and listed in settings | |

---

## 5. Lab Results

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 20 | View lab results list | All 3 seeded labs shown | |
| 21 | Verify abnormal labs are flagged | CEA and Hemoglobin shown with abnormal indicator | |
| 22 | Tap/click a lab result for detail view | Detail view renders with values and reference range | |
| 23 | Check lab trends view | Trends chart renders without error | |

---

## 6. AI Chat

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 24 | Load chat screen | Chat interface renders within 2 s | |
| 25 | Send a simple message | AI response received within 15 s | |
| 26 | Send a long message (200+ chars) | Message sent and response received without layout issues | |
| 27 | Navigate away and return to chat | Previous message history still visible | |

---

## 7. Notifications

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 28 | View notifications list | 3 seeded notifications shown | |
| 29 | Verify unread notifications are visually distinct | Unread items styled differently from read ones | |
| 30 | Mark a notification as read | Item updates to read state without reload | |
| 31 | Tap a notification (mobile) | Navigates to the relevant screen | |

---

## 8. Settings

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 32 | Load settings page | All sections render without error | |
| 33 | Toggle a notification preference | Toggle state persists after page reload | |
| 34 | Change theme (web: toggle, mobile: light/dark/system) | Theme applies immediately | |
| 35 | Sign out from settings | Returns to login screen | |
| 36 | Reset test data button (staging + isDemo only) | Button visible; tap resets data and reloads | |
| 37 | Reset test data — verify result | Dashboard shows original 3 meds, 2 appts, 3 notifications after reset | |

---

## 9. Caregiver / Multi-Profile

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 38 | Add a second care profile | Profile created and appears in profile switcher | |
| 39 | Switch to the second profile | Dashboard and data reflect the newly selected profile | |
| 40 | Verify data separation | First profile's data not shown when second profile is active | |

---

## 10. iOS-Specific

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 41 | Cold start the app | App loads to dashboard (or login) within 4 s | |
| 42 | Background and foreground the app | State preserved; no crash on foreground | |
| 43 | Pull-to-refresh on dashboard | Data refreshes without error | |
| 44 | Tap a text input, then dismiss keyboard | Keyboard dismisses cleanly; layout does not shift unexpectedly | |
| 45 | Verify safe area insets | Content not clipped by notch, home indicator, or status bar on iPhone with Dynamic Island | |
| 46 | Trigger a haptic action (e.g. send message) | Haptic feedback fires as expected | |

---

## 11. Performance

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 47 | Dashboard first load time | Under 3 s on a standard connection | |
| 48 | Tab / screen navigation | Transitions feel instant (< 300 ms perceived) | |
| 49 | Scroll through medications list | No dropped frames; smooth at 60 fps | |
| 50 | Open browser DevTools console (web) | No unhandled errors or warnings during normal navigation | |

---

## Findings

Record any failures, regressions, or observations here.

| # | Screen / Feature | Description | Severity (P1–P4) |
|---|-----------------|-------------|-----------------|
|   |                 |             |                 |

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| QA   |      |      |
| Eng  |      |      |
