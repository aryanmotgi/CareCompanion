# CareCompanion App Audit — Improvement Spec

**Date:** 2026-04-23
**Scope:** Full app audit across mobile (iPhone 17) and web (carecompanionai.org)
**Method:** Real-device screenshots + live browsing, screen-by-screen review

## Summary

21 issues found across 9 screens (5 mobile tabs + 4 web pages). Two P0 blockers, two P1 high-priority bugs, ten P2 improvements, and seven P3 polish items.

---

## P0 — Blockers

### 1. Care tab broken — "Failed to load care data"
- **Platform:** Mobile
- **Screen:** Care tab (all sub-tabs: Meds, Appts, Labs, Journal, Team)
- **Symptom:** Error screen with "Something went wrong — Failed to load care data" and a "Try Again" button
- **Impact:** The core feature of a caregiver app doesn't load. Users can't manage medications, appointments, labs, or care team.
- **Action:** Investigate API response. Check auth token forwarding, profile ID, and API endpoint availability. Fix the root cause.

### 2. Signup page — logo overlaps nav link
- **Platform:** Web
- **Screen:** /signup
- **Symptom:** Heart logo icon positioned over the "Contact" navigation link
- **Impact:** Users can't click "Contact" on the signup page. Looks broken.
- **Action:** Fix z-index or positioning of the logo element on the signup page. The login page handles this correctly (logo is below the nav), so the signup page layout differs.

---

## P1 — High Priority

### 3. Dashboard drawer edge visible
- **Platform:** Mobile
- **Screen:** Home tab
- **Symptom:** A dark panel with a "<" chevron peeks out from the right edge of the screen
- **Impact:** Users will try to swipe/tap it and get confused. Looks unfinished.
- **Action:** Either hide the drawer trigger completely, or make it intentional with proper swipe-to-open behavior.

### 4. app.json userInterfaceStyle set to "light"
- **Platform:** Mobile
- **Screen:** All screens (system-level)
- **Symptom:** `userInterfaceStyle: "light"` in app.json but the app uses a dark theme
- **Impact:** iOS system UI (status bar, safe areas) can flash in light mode before the React theme loads
- **Action:** Change `userInterfaceStyle` to `"dark"` in apps/mobile/app.json

---

## P2 — Should Fix

### 5. Chat prompt cards text truncated
- **Platform:** Mobile
- **Screen:** Chat tab
- **Symptom:** Card titles cut off with "..." — "What should I expect this che...", "Prep for oncology appoi...", "Help me understand my..."
- **Impact:** Users can't read the full prompt. Defeats the purpose of guided conversation starters.
- **Action:** Either make cards taller/wider, reduce font size, or shorten the prompt text to fit.

### 6. Dashboard empty states are plain text
- **Platform:** Mobile
- **Screen:** Home tab
- **Symptom:** "No medications yet" and "No upcoming appointments" are just text on dark background
- **Impact:** New users see a mostly empty, uninviting dashboard. No guidance on what to do next.
- **Action:** Add illustrations, action buttons ("+ Add your first medication"), or contextual tips for each empty state.

### 7. Dashboard gradient lines look unfinished
- **Platform:** Mobile
- **Screen:** Home tab
- **Symptom:** Purple/blue horizontal lines appear between sections inconsistently — some centered, some not
- **Impact:** Looks like a rendering artifact or unfinished design element
- **Action:** Either make them consistent section dividers or remove them entirely. Replace with proper spacing.

### 8. "0 meds" badge highlights emptiness
- **Platform:** Mobile
- **Screen:** Home tab
- **Symptom:** Purple "0 meds" badge next to "TODAY'S MEDICATIONS" draws attention to the fact there are no medications
- **Impact:** Feels like an error state rather than a fresh start
- **Action:** Hide the count badge when zero. Show "+ Add" button instead, or just show the empty state text.

### 9. Scan tab vs Documents naming mismatch
- **Platform:** Mobile
- **Screen:** Scan tab
- **Symptom:** Bottom tab says "Scan" but page title says "Documents"
- **Impact:** Users may think they tapped the wrong tab. Confusing information architecture.
- **Action:** Pick one name. Recommendation: tab = "Scan", title = "Scanned Documents" or just "Scan".

### 10. Settings toggle switches clipped on right edge
- **Platform:** Mobile
- **Screen:** Settings tab
- **Symptom:** Toggle switches appear cut off by the card container's right boundary
- **Impact:** Looks like a layout bug. Toggles may be harder to tap.
- **Action:** Increase card padding or adjust toggle positioning so they sit fully within the container.

### 11. Settings "Medications" label duplicated
- **Platform:** Mobile
- **Screen:** Settings tab
- **Symptom:** "Medications" appears as both a section header and a toggle label immediately below it
- **Impact:** Redundant and confusing — user reads "Medications" twice in a row
- **Action:** Rename the section header to "Medication Alerts" or remove the duplicate.

### 12. Settings missing essential items
- **Platform:** Mobile
- **Screen:** Settings tab
- **Symptom:** No app version, no Help/Support link, no Privacy Policy link, no Terms of Service link, no Delete Account option
- **Impact:** App Store requirement (delete account), legal requirement (privacy links), user expectation (help/version)
- **Action:** Add: App version, Help & Support, Privacy Policy, Terms of Service, Delete Account, About section.

### 13. No password requirements shown on signup
- **Platform:** Web
- **Screen:** /signup
- **Symptom:** Password field has no hint about requirements (length, special chars, etc.)
- **Impact:** Users fail on submit and don't know why. Creates friction in signup flow.
- **Action:** Show password requirements below the field (e.g., "At least 8 characters, one number").

### 14. No inline form validation
- **Platform:** Web
- **Screen:** /login and /signup
- **Symptom:** Form validation only happens on submit — no live feedback as user types
- **Impact:** Users fill out the entire form, submit, then discover errors. Higher abandonment.
- **Action:** Add inline validation: email format check on blur, password requirements on keyup, confirm password match check.

---

## P3 — Polish

### 15. Empty gap below AI companion card on dashboard
- **Platform:** Mobile
- **Screen:** Home tab
- **Symptom:** Large blank space between the AI card and the tab bar
- **Action:** Add a daily tip card, mood check-in prompt, or quick-action buttons.

### 16. Chat uses emoji icons instead of brand icons
- **Platform:** Mobile
- **Screen:** Chat tab
- **Symptom:** Prompt cards use standard emojis (chart, microscope, calendar, sparkles)
- **Action:** Replace with custom-designed icons or Ionicons that match the app's indigo/lavender aesthetic.

### 17. Login/signup nav bar too cluttered
- **Platform:** Web
- **Screen:** /login and /signup
- **Symptom:** Full navigation (Home, Features, About, Contact, Privacy, Terms) shown on auth pages
- **Action:** Simplify to logo + "Sign Up" or logo + "Log In" only. Auth pages should minimize distraction.

### 18. Web skeleton loaders too faint
- **Platform:** Web
- **Screen:** Authenticated app routes
- **Symptom:** Skeleton cards at 2% opacity — barely visible on dark background
- **Action:** Increase to `bg-white/[0.06]` for better loading feedback.

### 19. "SCROLL TO EXPLORE" on landing page
- **Platform:** Web
- **Screen:** Landing page
- **Symptom:** Text + mouse icon telling user to scroll feels dated
- **Action:** Remove or replace with a subtle scroll indicator (arrow or fade hint).

### 20. All notification toggles default ON
- **Platform:** Mobile
- **Screen:** Settings tab
- **Symptom:** All 6 notification types enabled by default
- **Action:** Consider defaulting to 2-3 critical ones (medication reminders, appointment reminders) and letting users opt into the rest.

### 21. No social login (Google/Apple Sign-In)
- **Platform:** Both
- **Screen:** /login, /signup, mobile login
- **Symptom:** Only email/password authentication available
- **Action:** Add Apple Sign-In (required for App Store if you offer any third-party login) and Google Sign-In. Reduces signup friction significantly.

---

## Screens Not Yet Audited

The following screens were not reviewed in this audit and should be covered in a follow-up:

**Web (authenticated):**
- Dashboard
- Chat (logged in)
- Care hub (Medications, Appointments, Labs, Documents)
- Calendar
- Health Summary
- Emergency Card
- Care Team
- Visit Prep
- Journal
- Profile
- Insurance

**Mobile sub-screens:**
- Profile setup flows (cancer type, stage, treatment phase)
- Chat conversation (after sending a message)
- Document scan flow (camera → extraction → review)
- Any modal or bottom sheet screens

---

## Implementation Priority

| Phase | Issues | Focus |
|-------|--------|-------|
| **Phase 1: Unblock** | #1, #2, #3, #4 | Fix P0/P1 — make the app functional |
| **Phase 2: Core UX** | #5, #6, #7, #8, #9, #12, #13, #14 | Fix the most visible P2 issues |
| **Phase 3: Polish** | #10, #11, #15, #16, #17, #18, #19, #20 | Visual refinement |
| **Phase 4: Features** | #21 | Social login (larger effort, App Store requirement) |
