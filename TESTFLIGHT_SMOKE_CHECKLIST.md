# TestFlight Smoke Test Checklist

**App:** CareCompanion  
**Platform:** iOS (TestFlight)  
**Minimum iOS:** 16.0  
**Tester:** ___________________  
**Device:** ___________________  
**OS Version:** ___________________  
**Build number:** ___________________  
**Date:** ___________________  

> **Legend:** ✅ Pass · ❌ Fail · ⚠️ Partial · N/A  
> Screenshot slots: drop `.png` into `/docs/testflight-screenshots/TF-<ID>-<slug>.png`

---

## TF-01 · New User Signup (email + password)

| Field | Detail |
|---|---|
| **Preconditions** | Fresh TestFlight install. No account exists for the test email address. Network connected. |
| **Steps** | 1. Launch app (cold start). 2. Tap **Get Started** on Welcome screen. 3. Choose role (Self / Patient / Caregiver). 4. Enter display name, a fresh test email, and a strong password (≥8 chars, mixed case + number). 5. Confirm password. 6. Tick the consent checkbox. 7. Tap **Create account**. |
| **Expected** | Success overlay animates in. App navigates to email-verification prompt or onboarding wizard. No error toast. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-01-signup-success.png` |

---

## TF-02 · Email Verification Link

| Field | Detail |
|---|---|
| **Preconditions** | Account created in TF-01. Verification email delivered to test inbox. |
| **Steps** | 1. Open test email client. 2. Open the verification email from CareCompanion. 3. Tap the **Verify your email** link. 4. Confirm the app (or browser) opens and shows a confirmed state. 5. Return to app if browser was used. |
| **Expected** | Email verified successfully. App either auto-advances or shows "Email verified — continue" CTA. Unverified-user banner not shown after re-launch. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-02-email-verified.png` |

---

## TF-03 · Onboarding Wizard (all steps)

| Field | Detail |
|---|---|
| **Preconditions** | TF-01 + TF-02 complete. First-time onboarding has not been dismissed. |
| **Steps** | 1. Step indicator visible at top. 2. Complete **Care type** selection. 3. Complete **Care relationship** selection. 4. Complete **Health consent** acceptance. 5. Complete **Insurance** entry (or skip if optional). 6. Complete **Appointments** setup (or skip). 7. Reach the **Setup complete** screen. |
| **Expected** | Each step advances without crashing. Step indicator increments correctly. Final step routes to main tab bar. `cc-welcome-seen` flag persists so wizard does not reappear on re-launch. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-03-onboarding-complete.png` |

---

## TF-04 · HealthKit Authorization — Granted

| Field | Detail |
|---|---|
| **Preconditions** | Device has HealthKit records (or simulator with sample data). Onboarding complete. |
| **Steps** | 1. Navigate to **Health Connect** screen (or reach it through onboarding). 2. Tap **Connect HealthKit**. 3. iOS system permission sheet appears. 4. Tap **Allow** for all requested data types. 5. Observe sync progress indicator. |
| **Expected** | Authorization returns `true`. Sync starts. At least one record category (medications, labs, conditions) appears in the relevant tab within 30 s. `cc-healthkit-connected` key stored in AsyncStorage. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-04-healthkit-granted.png` |

---

## TF-05 · HealthKit Authorization — Denied (graceful fallback)

| Field | Detail |
|---|---|
| **Preconditions** | Fresh account (or revoke HealthKit permission in iOS Settings → Privacy → Health → CareCompanion → turn off all). |
| **Steps** | 1. Navigate to **Health Connect** screen. 2. Tap **Connect HealthKit**. 3. iOS system sheet appears. 4. Tap **Don't Allow**. 5. Observe app response. |
| **Expected** | App does not crash. A user-facing message explains that HealthKit access was not granted and offers a retry / manual-entry path. Core navigation (tabs) remains functional. `cc-healthkit-connected` is NOT set. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-05-healthkit-denied-fallback.png` |

---

## TF-06 · Care Group Create

| Field | Detail |
|---|---|
| **Preconditions** | Logged in as a patient or self-care user. No existing care group on this account. |
| **Steps** | 1. Navigate to **Care** tab → **Care Group Settings** (or the create flow from onboarding). 2. Enter a care group name. 3. Set a care group password. 4. Tap **Create care group**. 5. Note the 5-character join code displayed. |
| **Expected** | Care group created without error. Join code (from `SAFE_ALPHABET`) displayed on screen. Group settings page opens and shows the new group name. API returns 2xx. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-06-care-group-created.png` |

---

## TF-07 · Care Group Join via 5-Character Code

| Field | Detail |
|---|---|
| **Preconditions** | A second TestFlight device (or account) logged in as **Caregiver** role. Care group created in TF-06 and 5-char code is known. |
| **Steps** | 1. Complete signup as Caregiver on second device. 2. Reach **Join Care Group** screen. 3. Select **Code** mode. 4. Enter the 5-char join code from TF-06. 5. Tap **Join**. |
| **Expected** | API call succeeds. Caregiver is routed to **Care Relationship** screen and then to the main tab bar. Care group name appears in Settings. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-07-care-group-join-code.png` |

---

## TF-08 · Care Group Join via Family Name + Password (email fallback)

| Field | Detail |
|---|---|
| **Preconditions** | Same as TF-07. Caregiver does NOT have the 5-char code; uses email-request path instead. |
| **Steps** | 1. On **Join Care Group** screen, tap **Use email instead**. 2. Enter the patient's registered email address. 3. Tap **Request access**. 4. On the patient's device, approve the join request (notification or in-app). 5. Caregiver app advances past the join screen. |
| **Expected** | Request sent without error. Patient receives in-app or push approval prompt. After approval, caregiver is routed into the group. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-08-care-group-join-email.png` |

---

## TF-09 · Chat — Send Message + Streaming Response

| Field | Detail |
|---|---|
| **Preconditions** | Logged in. Network connected. AI chat endpoint live (`/api/ai/chat`). |
| **Steps** | 1. Navigate to **Chat** tab. 2. Type a health-related question (e.g., "What are the side effects of metformin?"). 3. Tap **Send**. 4. Observe the streaming response. |
| **Expected** | Message appears in the conversation thread immediately. AI response streams in token-by-token (animated cursor visible). Full response appears within 15 s. No timeout toast. Conversation persists if you background and return. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-09-chat-stream.png` |

---

## TF-10 · Voice Log (Check-in)

| Field | Detail |
|---|---|
| **Preconditions** | Device has a microphone. Microphone permission not yet granted (first run) or already granted. |
| **Steps** | 1. Navigate to the **Voice Check-in** screen (from home or journal). 2. If first run, grant microphone permission when prompted. 3. Tap the record button. 4. Speak a brief check-in: "Pain is a 4, mood is okay, energy is moderate." 5. Tap the stop/send button. 6. Wait for AI extraction. |
| **Expected** | Recording indicator animates during recording. After stop: processing spinner shows, then extracted fields (pain, mood, energy, notes) render in the confirmation card. Tapping **Save** dismisses the screen. No crash if microphone permission is denied — graceful fallback message shown instead. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-10-voice-log.png` |

---

## TF-11 · Push Notification Token Registration

| Field | Detail |
|---|---|
| **Preconditions** | Physical device (push does not work on simulator). First launch after install. |
| **Steps** | 1. Launch app fresh. 2. When notification permission prompt appears, tap **Allow**. 3. Navigate to **Settings** tab. 4. Open **Notification Settings**. 5. Confirm toggles are present (Medications, Refill Reminders, Dose Reminders, Appointments). |
| **Expected** | iOS grants permission. Expo push token registered with the backend (`/api/notifications/register`). Settings screen shows all notification categories with correct defaults (`medications`, `refillReminders`, `doseReminders`, `appointments` all ON; `criticalMissedDose` OFF). |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-11-push-token-registered.png` |

---

## TF-12 · Push Notification Receive — Foreground

| Field | Detail |
|---|---|
| **Preconditions** | TF-11 complete. Backend access to send a test push (use admin panel or `POST /api/notifications/test`). App in foreground. |
| **Steps** | 1. Keep app in foreground (any screen). 2. Trigger a test push from the backend. 3. Observe in-app notification banner or alert. |
| **Expected** | Notification appears as an in-app overlay or system banner within 5 s. Banner shows title and body text. Tapping it navigates to the relevant screen (e.g., medication reminder → Medications tab). No crash. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-12-push-foreground.png` |

---

## TF-13 · Push Notification Receive — Background / Killed State

| Field | Detail |
|---|---|
| **Preconditions** | TF-11 complete. App backgrounded or force-quit. |
| **Steps** | 1. Background or force-quit the app. 2. Trigger a test push from the backend. 3. Observe system notification in the notification center. 4. Tap the notification. 5. Observe app launch and deep navigation. |
| **Expected** | System notification appears promptly. Tapping it cold-starts the app and routes directly to the correct screen (e.g., DOSE_REMINDER_KIND → medication detail; APPOINTMENT_REMINDER_KIND → appointment detail; DAILY_CHECKIN_KIND → check-in screen). No splash loop. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-13-push-background-deeplink.png` |

---

## TF-14 · Deep Link from Notification — Cold Start

| Field | Detail |
|---|---|
| **Preconditions** | App fully force-quit. A notification with a deep-link payload waiting in notification center (from TF-13 or freshly triggered). |
| **Steps** | 1. Ensure app is NOT running (swipe up in app switcher). 2. Tap the pending notification. 3. Wait for full app launch. 4. Observe final screen. |
| **Expected** | App cold-starts, completes auth check, and lands on the screen specified by the notification payload (not just the home tab). Auth token still valid (no login screen shown mid-launch). Sentry breadcrumb recorded for the open event. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-14-deeplink-cold-start.png` |

---

## TF-15 · Logout + Login Again

| Field | Detail |
|---|---|
| **Preconditions** | Logged in with a known email/password. At least one record visible in app. |
| **Steps** | 1. Navigate to **Settings** tab. 2. Scroll to bottom and tap **Sign out**. 3. Confirm sign-out in the alert. 4. Observe the app return to the Welcome / Login screen. 5. Tap **Sign in**. 6. Enter the same credentials. 7. Tap **Sign in** button. |
| **Expected** | Sign-out clears `cc-session-token`, `cc-profile`, and `cc-csrf-token` from SecureStore. Welcome screen shown. Re-login succeeds, new token stored. Home tab data loads correctly. Previous session data not leaked across the sign-out boundary. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-15-logout-login.png` |

---

## TF-16 · Biometric Re-auth (Face ID / Touch ID)

| Field | Detail |
|---|---|
| **Preconditions** | Device has Face ID or Touch ID enrolled and enabled in iOS Settings. App has biometric permission. |
| **Steps** | 1. Background the app for >60 s (or trigger the re-auth timer via test mode if available). 2. Return to app. 3. Biometric prompt should appear automatically. 4. Authenticate with Face ID / Touch ID. |
| **Expected** | System biometric prompt appears without navigating away from the current screen. After successful auth, app resumes immediately. If biometric fails 3 times, fallback to passcode or full login screen is offered. App does not crash if biometrics are not enrolled. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-16-biometric-reauth.png` |

---

## TF-17 · Account Delete

| Field | Detail |
|---|---|
| **Preconditions** | Logged in as a test account that can be safely deleted. Network connected. |
| **Steps** | 1. Navigate to **Settings** tab. 2. Tap **Delete account** (or find the deletion option in account settings). 3. Confirm the deletion in the confirmation dialog (type "DELETE" if required). 4. Observe app state after confirmation. |
| **Expected** | DELETE request sent to backend (`/api/users/me` or equivalent). Account is removed server-side. App signs out and returns to Welcome screen. Session data wiped from SecureStore and AsyncStorage. Attempting to log in with the deleted credentials returns an appropriate error. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-17-account-delete.png` |

---

## TF-18 · Offline Mode — Read-only Resilience

| Field | Detail |
|---|---|
| **Preconditions** | Logged in. App has been used at least once so local cache exists. |
| **Steps** | 1. Enable Airplane Mode (or turn off Wi-Fi + cellular in Settings). 2. Return to CareCompanion. 3. Navigate between tabs: Home, Care, Chat, Labs, Settings. 4. Attempt to send a chat message. 5. Re-enable network. 6. Observe recovery. |
| **Expected** | Previously loaded data (medications, timeline, labs) displays from cache — no blank screens. Chat shows an appropriate offline error (not a crash or silent failure). When network returns, data refreshes automatically within 10 s. No unhandled JS exception. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-18-offline-mode.png` |

---

## TF-19 · Background HealthKit Sync

| Field | Detail |
|---|---|
| **Preconditions** | HealthKit connected (TF-04). Device connected to power (required for background task eligibility). |
| **Steps** | 1. Background the app. 2. Wait 15–30 min (or trigger `BGTaskScheduler` debug via Xcode). 3. Return to app. 4. Check the **Health** / **Labs** tab for updated data. |
| **Expected** | Background sync task fires (`cc-healthkit-sync` TaskManager task). `cc-healthkit-last-synced` timestamp in AsyncStorage is updated. No crash logged in Sentry. HealthKit data visible after returning to foreground (may require pull-to-refresh). |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-19-background-sync.png` |

---

## TF-20 · Social Auth — Sign in with Apple

| Field | Detail |
|---|---|
| **Preconditions** | Device signed into an Apple ID. Fresh install or logged-out state. |
| **Steps** | 1. On the Login or Signup screen, tap **Continue with Apple**. 2. Complete the Face ID / Touch ID or passcode confirmation. 3. Choose whether to share or hide email. 4. Observe app response. |
| **Expected** | `isAppleSignInAvailable()` returns `true` on physical device. Apple credential returned and exchanged for a CareCompanion session token. App advances to onboarding wizard (new user) or home tab (returning user). No token stored in plaintext. |
| **Pass/Fail** | ☐ |
| **Screenshot slot** | `TF-20-apple-signin.png` |

---

## Regression Notes

| # | Note | Severity |
|---|---|---|
| 1 | No PHI (names, DOBs, diagnoses) should appear in any Sentry breadcrumb or console log. | Critical |
| 2 | `TestModeBanner` must NOT be visible in the production TestFlight build (only in dev/internal). | High |
| 3 | App version and build number in **Settings** must match the TestFlight build metadata. | Medium |
| 4 | Shake gesture → Bug Report Sheet must open on any screen; submission must not expose PHI. | Medium |
| 5 | All deep-link routes (`/care`, `/chat`, `/labs`, `/notifications`) must resolve without a 404 nav error. | High |

---

## Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| QA Lead | | | |
| iOS Dev | | | |
| Product | | | |
