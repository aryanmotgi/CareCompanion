# CareCompanion — Voice / Siri / App Intents Gap Analysis

> Generated: 2026-05-21 (batch research pass)
> Branch audited: `aryan/dev`
> iOS current: iOS 26 / App Intents iOS 16+, App Shortcuts (AppShortcutsProvider) iOS 16.4+

---

## Top 5 Highest-Leverage Intents

| # | Intent | Why it wins |
|---|--------|-------------|
| 1 | **"Log my [med]"** — `LogMedicationIntent` | Chemo patients log 5–15 meds/day; hands-free logging during nausea removes the biggest daily friction point. Directly backs `medications/new.tsx`. |
| 2 | **"Show my emergency card"** — `ShowEmergencyCardIntent` | One-phrase Siri command that opens `emergency.tsx` with allergy + med list. Could save a life at an ER when the patient can't navigate the app. S complexity, P0 safety value. |
| 3 | **"Log pain level [N]"** — `LogPainIntent` | Pain is tracked multiple times per day; voice entry avoids the tap-heavy `symptom-radar.tsx` flow. First intent to add since `voice-checkin.tsx` is already a stub waiting for a real backend. |
| 4 | **"What's my next appointment?"** — `NextAppointmentIntent` | `CalendarBridge.swift` already fetches events; this intent reads and speaks back the next medical event without opening the app. Near-zero new backend work. |
| 5 | **"Did Mom take her morning meds?"** — `CaregiverMedCheckIntent` | Caregiver use-case with no voice entry today. Surfaces med-adherence status to a caregiver via Siri from the care-group API already used on the Care tab. |

---

## Current Scaffolding Audit

### Info.plist — `apps/mobile/ios/CareCompanion/Info.plist`

| Key | Current value | Gap |
|-----|---------------|-----|
| `NSUserActivityTypes` (line 73) | `["$(PRODUCT_BUNDLE_IDENTIFIER).expo.index_route"]` | Only the Expo stub activity type is registered. No domain-specific activity types for any clinical screen. |
| `INVocabularyFileName` | **MISSING** | No custom vocabulary file for medication/drug names, oncology terminology. |
| `NSSiriUsageDescription` | **MISSING** | Siri capability cannot be enabled until this usage string is present. |
| `NSSupportsLiveActivities` (line 102) | `true` | Good — foundation for infusion-day Live Activity is declared. |
| `NSSupportsLiveActivitiesFrequentUpdates` (line 104) | `true` | Good — supports hydration-timer live counters. |

### Entitlements — `apps/mobile/ios/CareCompanion/CareCompanion.entitlements`

| Entitlement | Present | Notes |
|-------------|---------|-------|
| `com.apple.developer.healthkit` | ✅ line 9 | |
| `com.apple.developer.healthkit.access` → `health-records` | ✅ line 10 | |
| `com.apple.developer.applesignin` | ✅ line 6 | |
| `com.apple.developer.siri` | ❌ **MISSING** | Required for any SiriKit domain usage (INIntent-based). Not required for App Intents / AppShortcutsProvider. |

### AppDelegate.mm — `apps/mobile/ios/CareCompanion/AppDelegate.mm`

- `continueUserActivity:restorationHandler:` is present (line 39) but only routes to `RCTLinkingManager` — intent continuation would fall through silently.
- No `INUIAddVoiceShortcutViewController` delegate, no `INInteraction` handling.

### Native Bridges (existing, can feed intents)

| File | Module | Useful for intent |
|------|--------|-------------------|
| `ios/HealthKitBridge.swift` | `HealthKitBridge` | Lab results query, medication records from HK clinical |
| `ios/WellnessVitals.swift` | `WellnessVitals` | Steps/HR/sleep for "how am I today?" read-back |
| `ios/CalendarBridge.swift` | `CalendarBridge` | `NextAppointmentIntent` — already fetches events |
| `ios/EmergencyWidgetBridge` (implied by `emergencyWidget.ts`) | `EmergencyWidgetBridge` | Shares UserDefaults app-group data — reuse for intent extension |

### Expo Screens (deep-link targets for intents)

| Screen | Route | Intent candidate |
|--------|-------|------------------|
| `voice-checkin.tsx` | `/voice-checkin` | Stub — `DailyCheckinIntent` target. Audio not wired (`expo-av` commented out). |
| `emergency.tsx` | `/emergency` | `ShowEmergencyCardIntent` — full impl, just needs deep-link donation |
| `symptom-radar.tsx` | `/symptom-radar` | `LogSymptomIntent` |
| `medications/new.tsx` | `/medications/new` | `LogMedicationIntent` |
| `appointments/new.tsx` | `/appointments/new` | `AddAppointmentIntent` |
| `visit-prep.tsx` | `/visit-prep` | `PrepareForVisitIntent` |
| `treatment-cycle.tsx` | `/treatment-cycle` | `NadirWindowIntent` |
| `journal.tsx` | `/journal` | `OpenJournalIntent` |
| `(tabs)/chat.tsx` | `/(tabs)/chat` | `AskOncologyAIIntent` |

### Dependencies — `apps/mobile/package.json`

| Package | Present | Notes |
|---------|---------|-------|
| `expo-live-activity ^0.4.2` | ✅ | LiveActivity for infusion-day timer |
| `expo-quick-actions` | ❌ | Home-screen quick actions (3D Touch) — not same as App Intents but easy win |
| Any AppIntents native module | ❌ | None — full gap |
| `expo-av` (Audio recording) | ❌ | Needed to wire `voice-checkin.tsx` |

### Summary Verdict

**Zero** App Intents or SiriKit scaffolding exists beyond the default Expo `NSUserActivity` index-route stub. No intent extension targets in the Xcode project, no `AppShortcutsProvider`, no `com.apple.developer.siri` entitlement, no vocabulary file. The app has strong native bridge foundations (HealthKit, Calendar, Live Activities, Emergency Widget) that make intent implementation straightforward — the surface area to cross is a Swift App Intents extension and a JS deep-link handler.

---

## Intent Catalog

### Patient Intents — Daily Self-Care

| ID | Spoken Phrase Variants | Parameters | Return Shape | Target User | Priority | Complexity |
|----|------------------------|------------|--------------|-------------|----------|------------|
| `LogMedicationIntent` | "Log my [med]", "I took [med]", "Mark [med] as taken", "Log [dose] of [med]" | `medicationName: MedicationEntity`, `dose: Measurement?` | Confirmation: "Logged 500mg Methotrexate at 8:42 AM" | Patient | P0 | M |
| `LogPainIntent` | "Log pain level [N]", "My pain is [N] out of ten", "Pain score [N]", "Rate my pain [N]" | `level: Int (0–10)`, `location: String?` | Confirmation: "Pain level 6 logged" | Patient | P0 | S |
| `DailyCheckinIntent` | "How am I today?", "Start my daily check-in", "Log how I feel", "Voice check-in" | none (opens screen) | Opens `/voice-checkin` — AI extracts pain/mood/energy | Patient | P0 | M |
| `NextAppointmentIntent` | "What's my next appointment?", "When is my next doctor visit?", "Next appointment", "When do I see my oncologist?" | none | Spoken: "Your next appointment is Tuesday May 26 at 2 PM with Dr. Patel at UCSF" | Patient | P1 | S |
| `NextDoseIntent` | "When is my next dose of [med]?", "When do I take [med] again?", "Next [med] dose" | `medicationName: MedicationEntity` | Spoken: "Your next Ondansetron dose is at 6:00 PM" | Patient | P1 | M |
| `LogSymptomIntent` | "I'm feeling nauseous", "Log nausea", "I have a fever", "Log [symptom]" | `symptom: SymptomEntity`, `severity: Int?` | Opens `/symptom-radar` pre-filled | Patient | P1 | M |
| `HydrationTimerIntent` | "Start hydration timer", "Remind me to drink water", "Start my hydration goal" | `goalOzOrMl: Measurement?` | Starts Live Activity hydration timer via `expo-live-activity` | Patient | P1 | M |
| `LastVisitSummaryIntent` | "What did my doctor say last visit?", "Recap my last appointment", "Show last visit notes" | none | Returns AI-generated visit summary; opens `/visit-prep` | Patient | P2 | L |
| `LabResultsIntent` | "What are my latest labs?", "Show my blood work", "What's my ANC?" | `labType: LabEntity?` | Spoken ANC/WBC/platelets or opens labs tab | Patient | P1 | M |
| `WellnessTodayIntent` | "How many steps today?", "What's my heart rate?", "How did I sleep?" | none | Reads from `WellnessVitals.swift` — steps/HR/sleep | Patient | P2 | S |

### Caregiver Intents

| ID | Spoken Phrase Variants | Parameters | Return Shape | Target User | Priority | Complexity |
|----|------------------------|------------|--------------|-------------|----------|------------|
| `CaregiverStatusIntent` | "How is [patient] doing?", "How is Mom doing?", "What's [patient]'s status?" | `patient: PatientEntity` | Summary: last check-in, pain level, last med logged | Caregiver | P1 | M |
| `CaregiverMedCheckIntent` | "Did Mom take her morning meds?", "Did [patient] take [med]?", "Has [patient] logged their meds?" | `patient: PatientEntity`, `medName: MedicationEntity?`, `timeOfDay: String?` | "Yes, she logged Ondansetron at 7:14 AM" or "Not yet" | Caregiver | P0 | M |
| `AddPatientMedIntent` | "Add [med] to [patient]'s schedule", "Add [dose] of [med] for [patient]" | `patient: PatientEntity`, `medicationName: String`, `dose: String?`, `frequency: String?` | Confirmation + opens caregiver med-add flow | Caregiver | P2 | L |
| `PatientSymptomsTodayIntent` | "Show me [patient]'s symptoms today", "What symptoms has [patient] had today?" | `patient: PatientEntity` | Symptom summary card / spoken read-back | Caregiver | P1 | M |
| `NadirWindowIntent` | "When does [patient]'s nadir start?", "When is [patient]'s nadir?", "How many days until nadir?" | `patient: PatientEntity?` | "Nadir window starts May 29 (day 10). ANC may bottom out May 31." | Both | P1 | M |

### Emergency Intents

| ID | Spoken Phrase Variants | Parameters | Return Shape | Target User | Priority | Complexity |
|----|------------------------|------------|--------------|-------------|----------|------------|
| `ShowEmergencyCardIntent` | "Show my emergency card", "Open my medical ID", "Emergency info" | none | Opens `/emergency` full-screen | Patient | P0 | S |
| `CallOncologyTeamIntent` | "Call my oncology team", "Call my cancer nurse", "Call my care team" | none | `tel:` deep link to stored oncology contact; confirmation dialog | Patient | P0 | S |
| `TriageChestPainIntent` | "I'm having chest pain", "I think I'm having a reaction", "I feel very sick" | none | Opens `/emergency` + surfaces 911 button + sends push to caregiver | Patient | P0 | M |
| `NavigateToERIntent` | "Get me to the ER", "Directions to the nearest emergency room", "Take me to the hospital" | none | Opens Maps with nearest ER or stored hospital address from profile | Patient | P0 | S |

### Routine Shortcuts (Shortcuts.app gallery)

| ID | Spoken Phrase Variants | Actions Bundled | Target User | Priority | Complexity |
|----|------------------------|-----------------|-------------|----------|------------|
| `MorningRoutineShortcut` | "Start my morning routine", "Morning check-in", "Good morning CareCompanion" | Log weight + BP + all scheduled morning meds in sequence | Patient | P1 | M |
| `BedtimeRoutineShortcut` | "Start bedtime routine", "Bedtime check-in", "End of day check-in" | Log pain (0–10) + sleep quality + bedtime meds | Patient | P1 | M |
| `InfusionDayShortcut` | "It's infusion day", "Start infusion day", "Log infusion day" | Log hydration goal + pre-meds + start Live Activity timer for infusion duration | Patient | P0 | L |

---

## Shortcuts Gallery Seed Examples

These are pre-built `.shortcut` actions or `AppShortcut` declarations in Swift that should be submitted/discoverable in the Shortcuts gallery and suggested by Siri proactively.

### 1. Morning Meds Shortcut

```
Name: "Morning Meds"
Phrase: "Start my morning CareCompanion routine"
Actions:
  1. CareCompanion → Log each scheduled morning medication (loop via MedicationEntity)
  2. CareCompanion → Log wellness vitals (reads HK steps/HR)
  3. CareCompanion → Open daily check-in
Donation trigger: auto-donated every day user opens app between 6–10 AM
```

### 2. Quick Pain Log

```
Name: "Log Pain"
Phrase: "Hey Siri, log pain in CareCompanion"
Actions:
  1. Ask for Input: "Pain level 0–10?"
  2. CareCompanion → LogPainIntent(level: Provided Input)
  3. Speak: "Pain level [N] logged at [time]"
Donation trigger: whenever user visits symptom-radar screen
```

### 3. Emergency Card Shortcut

```
Name: "My Emergency Info"
Phrase: "Show my emergency card in CareCompanion"
Actions:
  1. CareCompanion → ShowEmergencyCardIntent
Donation trigger: each time user views emergency.tsx; also donated on first app launch
Tile color: .systemRed
```

### 4. Infusion Day

```
Name: "Infusion Day"
Phrase: "Start infusion day"
Actions:
  1. CareCompanion → Log pre-meds (MorningMeds subset)
  2. CareCompanion → HydrationTimerIntent (goal: 2000ml)
  3. CareCompanion → Start Live Activity (infusion timer)
  4. Notify caregiver care group: "Infusion started at [time]"
Donation trigger: calendar event containing "infusion", "chemo", "Taxol" etc.
```

### 5. Caregiver Daily Briefing

```
Name: "Care Check-In"
Phrase: "How is my patient doing?"
Actions:
  1. CareCompanion → CaregiverStatusIntent(patient: default linked patient)
  2. Speak result
Donation trigger: each time caregiver opens Care tab
```

---

## Discoverability Strategy

### A. NSUserActivity Donations (Immediate — No Extension Required)

For every key screen, call `userActivity.becomeCurrent()` with a typed activity identifier and relevant `userInfo`. This seeds Siri Suggestions in Spotlight, Siri widget, and Lock Screen.

| Screen | Activity Type | When to Donate |
|--------|---------------|----------------|
| `emergency.tsx` | `…carecompanion.emergency` | On mount |
| `voice-checkin.tsx` | `…carecompanion.checkin` | On mount |
| `symptom-radar.tsx` | `…carecompanion.log-symptom` | On mount |
| `medications/new.tsx` | `…carecompanion.log-medication` | On successful save |
| `appointments.tsx` | `…carecompanion.appointments` | On mount |

Implement via `expo-linking` + a thin native bridge that calls `NSUserActivity.becomeCurrent()`. No Siri entitlement required.

### B. AppShortcutsProvider (iOS 16.4+) — Swift Extension

Create a new Xcode target `CareCompanionIntents` (App Intent Extension). Implement:

```swift
struct CareCompanionShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ShowEmergencyCardIntent(),
            phrases: ["Show my emergency card in \(.applicationName)",
                      "Emergency info in \(.applicationName)"],
            shortTitle: "Emergency Card",
            systemImageName: "cross.circle.fill"
        )
        AppShortcut(
            intent: LogPainIntent(),
            phrases: ["Log pain in \(.applicationName)",
                      "Pain score \(\.$level) in \(.applicationName)"],
            shortTitle: "Log Pain",
            systemImageName: "waveform.path.ecg"
        )
        AppShortcut(
            intent: NextAppointmentIntent(),
            phrases: ["Next appointment in \(.applicationName)",
                      "When do I see my doctor in \(.applicationName)"],
            shortTitle: "Next Appointment",
            systemImageName: "calendar.badge.clock"
        )
    }
}
```

This makes all three phrases **available in Siri without any prior use** — the user just says it and it works. No donation history needed.

### C. Proactive Siri Suggestions

| Trigger | Suggestion | API |
|---------|------------|-----|
| 7–10 AM daily | Morning Routine shortcut | `INShortcut` + `INVoiceShortcutCenter.setShortcutSuggestions` |
| Calendar event containing "infusion", "chemo" | Infusion Day shortcut the morning of | Donate `INInteraction` on calendar sync |
| Nadir window days | "Check patient status" caregiver suggestion | Donate on treatment-cycle screen view |
| Pain logged > 3 times today | "Call oncology team" suggestion | Donate after 3rd pain log in `LogPainIntent` |
| Post-appointment (1 hour after event ends) | "Log visit notes" suggestion | Calendar bridge post-event trigger |

### D. ShortcutTile Suggestions in App

Add a `<ShortcutTile />` React Native component (wraps `INUIAddVoiceShortcutButton` via native bridge) on:
- Bottom of `symptom-radar.tsx`: "Add 'Log pain' to Siri"
- Bottom of `emergency.tsx`: "Add 'Emergency card' to Siri"
- Onboarding step after setup: "Set up your Siri shortcuts"

---

## Implementation Complexity Reference

| ID | Complexity | Notes |
|----|------------|-------|
| `ShowEmergencyCardIntent` | **S** | NSUserActivity donation + URL scheme open. No extension needed. |
| `CallOncologyTeamIntent` | **S** | `tel:` URL from profile + UserActivity donation. |
| `NavigateToERIntent` | **S** | Maps deep link. |
| `NextAppointmentIntent` | **S** | Read-only: CalendarBridge data → intent result. Swift extension reads from shared UserDefaults. |
| `WellnessTodayIntent` | **S** | Read-only: WellnessVitals HK data → spoken result. |
| `LogPainIntent` | **M** | Parameter (`level: Int`), write to API, return confirmation. |
| `DailyCheckinIntent` | **M** | Opens stub screen; also needs `expo-av` wired. |
| `LogMedicationIntent` | **M** | `MedicationEntity` requires entity query resolving local med list. |
| `NextDoseIntent` | **M** | Needs schedule data exposed to the intent extension via shared UserDefaults / App Group. |
| `LogSymptomIntent` | **M** | `SymptomEntity` enum parameter, write to API. |
| `HydrationTimerIntent` | **M** | `expo-live-activity` already in deps — bridge from intent to LiveActivity start. |
| `CaregiverStatusIntent` | **M** | Read care-group API; multi-patient entity resolution. |
| `CaregiverMedCheckIntent` | **M** | Read med-adherence API; spoken boolean response. |
| `PatientSymptomsTodayIntent` | **M** | Read symptom log API. |
| `NadirWindowIntent` | **M** | Reads treatment cycle day from shared UserDefaults. |
| `TriageChestPainIntent` | **M** | Opens emergency screen + sends caregiver push notification. |
| `MorningRoutineShortcut` | **M** | Multi-action shortcut; sequential med-log loop. |
| `BedtimeRoutineShortcut` | **M** | Multi-action shortcut. |
| `LabResultsIntent` | **M** | `LabEntity` query from HK clinical records or API. |
| `LastVisitSummaryIntent` | **L** | Requires visit-notes AI summary endpoint + entity resolution. |
| `AddPatientMedIntent` | **L** | Write + caregiver permission check + multi-entity resolution. |
| `InfusionDayShortcut` | **L** | Orchestrates 4+ actions + Live Activity + push. |

**Size key:** S = 1–3 days, M = 3–7 days, L = 1–2+ weeks

---

## Required Infrastructure Changes

Before any intent can ship, these four changes are needed:

1. **Add Siri entitlement** to `CareCompanion.entitlements`:
   ```xml
   <key>com.apple.developer.siri</key>
   <true/>
   ```

2. **Add to Info.plist**:
   ```xml
   <key>NSSiriUsageDescription</key>
   <string>CareCompanion uses Siri to let you log symptoms, medications, and check-ins hands-free during treatment.</string>
   <key>NSUserActivityTypes</key>
   <array>
     <string>$(PRODUCT_BUNDLE_IDENTIFIER).expo.index_route</string>
     <string>$(PRODUCT_BUNDLE_IDENTIFIER).emergency</string>
     <string>$(PRODUCT_BUNDLE_IDENTIFIER).checkin</string>
     <string>$(PRODUCT_BUNDLE_IDENTIFIER).log-symptom</string>
     <string>$(PRODUCT_BUNDLE_IDENTIFIER).log-medication</string>
     <string>$(PRODUCT_BUNDLE_IDENTIFIER).appointments</string>
   </array>
   ```

3. **Add App Group** entitlement (`group.com.aryanmotgi.carecompanion`) so the App Intents extension can read medications, schedule, and profile data from shared UserDefaults without an API round-trip.

4. **Create Xcode target** `CareCompanionIntents` (App Intent Extension) with `AppShortcutsProvider` — separate Swift target, linked against the app group container.

---

## Sources

- Apple App Intents framework: https://developer.apple.com/documentation/appintents
- Apple App Shortcuts: https://developer.apple.com/documentation/appintents/app-shortcuts
- SiriKit overview: https://developer.apple.com/documentation/sirikit
- Live Activities: https://developer.apple.com/documentation/activitykit
- Expo Live Activity: https://docs.expo.dev/versions/latest/sdk/live-activity/
- Current iOS version: iOS 26 (as of 2026-05-20)
- Codebase branch: `aryan/dev` @ `https://github.com/aryanmotgi/CareCompanion`
- Files audited:
  - `apps/mobile/ios/CareCompanion/Info.plist`
  - `apps/mobile/ios/CareCompanion/CareCompanion.entitlements`
  - `apps/mobile/ios/CareCompanion/AppDelegate.mm`
  - `apps/mobile/ios/HealthKitBridge.swift`
  - `apps/mobile/ios/WellnessVitals.swift`
  - `apps/mobile/ios/CalendarBridge.swift`
  - `apps/mobile/src/services/emergencyWidget.ts`
  - `apps/mobile/app/voice-checkin.tsx`
  - `apps/mobile/app/emergency.tsx`
  - `apps/mobile/app/symptom-radar.tsx`
  - `apps/mobile/app/medications/new.tsx`
  - `apps/mobile/app/treatment-cycle.tsx`
  - `apps/mobile/package.json`
  - `apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj`
