# CareCompanion — Apple Watch & Live Activity Strategy

> Prepared: 2026-05-21 (overnight batch)
> Branch: aryan/dev
> Audience: Aryan (web/AI architect), Shreyash (mobile lead)

---

## Executive Summary — Top 5 High-Impact Wearable Bets

| # | Bet | Why it wins |
|---|-----|-------------|
| 1 | **Medication dose Live Activity** (Dynamic Island + Lock Screen) | Closes the #1 adherence gap in cancer care. Push-category actions (TAKEN / SNOOZE / SKIP) already exist in `notifications.ts`; wrapping them in a Live Activity turns a transient alert into a persistent glanceable. Zero new schema needed. |
| 2 | **Nadir countdown complication** (watchOS circular / corner) | Chemo nadir (WBC trough ~day 7–14 post-infusion) is the highest-risk window for febrile neutropenia. A watch face complication showing "Day 9 of 14 — High Risk 🔴" gives patients and caregivers passive situational awareness with no interaction required. Requires one new `nadir_windows` table. |
| 3 | **Quick pain / mood log watch screen** | The 0–10 pain tap on the watch replaces the biggest friction point in symptom data collection. Every data point feeds the symptom radar AI on the web side. `wellnessCheckins` and `symptomEntries` tables already exist. |
| 4 | **Lab result pending → arrived Live Activity** | Patients obsessively check for lab results during and after chemo. A Live Activity that reads "CBC pending…" and then updates to "CBC arrived — WBC 2.1 (↓ Low)" eliminates anxiety-driven polling. Requires new lab-pending status field. |
| 5 | **Caregiver shift handoff Live Activity** | When a caregiver is driving to a patient's home, a shared Live Activity showing ETA + last medication status bridges the information gap between arrival and handoff. Differentiates CareCompanion from all competitors. Requires new caregiver location/shift table. |

---

## Scaffold Audit

### What Exists

| File | Key Finding |
|------|-------------|
| `apps/mobile/ios/CareCompanion/Info.plist:102` | `NSSupportsLiveActivities = true` ✅ |
| `apps/mobile/ios/CareCompanion/Info.plist:104` | `NSSupportsLiveActivitiesFrequentUpdates = true` ✅ |
| `apps/mobile/ios/CareCompanion/Info.plist:106–110` | `UIBackgroundModes: fetch + remote-notification` ✅ |
| `apps/mobile/ios/CareCompanion/CareCompanion.entitlements:9` | `com.apple.developer.healthkit = true` ✅ |
| `apps/mobile/ios/CareCompanion/CareCompanion.entitlements:11–13` | `healthkit.access: health-records` ✅ |
| `apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj:16–24` | Only one target: `CareCompanion.app`. No `LiveActivityExtension`, `WidgetExtension`, or `WatchApp` targets present. |
| `apps/mobile/ios/HealthKitBridge.swift:10–21` | Reads: medicationRecord, labResultRecord, conditionRecord, procedureRecord, allergyRecord, vitalSignRecord, immunizationRecord — full clinical FHIR pipeline ready. |
| `apps/mobile/ios/WellnessVitals.swift:18–21` | Reads: stepCount, heartRate, sleepAnalysis — wellness vitals pipeline ready. |
| `apps/mobile/ios/CalendarBridge.swift:36–70` | Fetches calendar events with location + notes — appointment ETA feasible. |
| `apps/mobile/src/services/notifications.ts:67–99` | Push categories: `dose-reminder` (TAKEN/SNOOZE/SKIP), `appointment-reminder` (CONFIRM/RESCHEDULE), `daily-checkin` (inline pain/energy/sleep reply). |
| `apps/web/src/lib/db/schema.ts:547–558` | `treatmentCycles` table: cycleNumber, startDate, cycleLengthDays, regimenName — nadir calculation anchor. |

### What Is Missing

| Gap | Impact |
|-----|--------|
| No `apps/mobile/ios/LiveActivity/` directory | Zero Live Activity Swift code exists — full implementation required. |
| No Xcode widget/watch extension targets in `project.pbxproj` | Requires new `CareCompanionLiveActivity` and `CareCompanionWidgets` extension targets. |
| No `com.apple.developer.activitykit` entitlement (not needed for basic use; required only for frequent-updates token server-side push) | Verify with Apple provisioning portal once targets are added. |
| No native APNs device token registration — `pushSubscriptions` table (`schema.ts:524`) stores Web Push (p256dh/auth/endpoint) not APNs tokens | Need new `apns_tokens` table + device registration endpoint to server-push Live Activity updates. |
| No watchOS Watch app or extension directory | Full Watch app scope is greenfield. |
| No `hydration_logs` table | Hydration ring complication and infusion-day Live Activity require new schema. |
| No `nadir_windows` table | Nadir countdown requires computed nadir window stored from treatment cycle + regimen. |
| No caregiver shift / location table | Shift handoff Live Activity requires new schema. |
| `WellnessVitals.swift` does not read hydration (HKQuantityType.dietaryWater) | Minor bridge addition needed. |

---

## Live Activity Catalog

> **Platform requirements:** iOS 16.1+ (Lock Screen only on non-Dynamic-Island devices), iOS 16.1+ with iPhone 14 Pro for Dynamic Island. Max payload: 4 KB per update. Max lifetime: 12 hours (renewable). Entitlement `NSSupportsLiveActivities` already in Info.plist.

| # | Activity Name | Dynamic Island | Lock Screen | Clinical Rationale | Target User | Required Data | Schema Status | Priority | Complexity |
|---|---------------|----------------|-------------|--------------------|-------------|---------------|---------------|----------|------------|
| LA-1 | **Med Dose Due** | Compact: pill icon + med name + countdown timer. Expanded: dose, prescribing MD, TAKEN / SNOOZE 15m / SKIP buttons. | Full-width: med name, scheduled time, remaining window, 3-button action bar. | Non-adherence is the single largest modifiable risk factor in cancer outcomes. 30–40% of oral chemo doses are missed. | Patient | `medications`, `medicationReminders`, `reminderLogs` | ✅ Exists | P0 | M |
| LA-2 | **Nadir Risk Countdown** | Compact leading: red/amber/green dot. Compact trailing: "Day 9" text. Expanded: "WBC nadir window — Day 9 of 14. Fever → call your care team." | Bar: regimen name, nadir day, severity indicator, "Call Care Team" button. | Febrile neutropenia is life-threatening. Patients need persistent ambient awareness of nadir windows without opening an app. | Patient + Caregiver | `treatmentCycles`, new `nadir_windows` | ⚠️ Partial (cycles exist; nadir window table needed) | P0 | M |
| LA-3 | **Lab Result Pending → Arrived** | Compact: flask icon + "CBC pending". On arrival update: "CBC ✓ WBC 2.1↓". Expanded pending: "Results expected ~2h". Expanded arrived: result values + abnormal flags. | Full: lab panel name, ordered time / elapsed, abnormal highlights on arrival. | Lab result anxiety is clinically documented to worsen QoL during chemo. Real-time result delivery with context reduces repeat portal checks. | Patient + Caregiver | `labResults`, new `lab_orders` table (pending status) | ⚠️ Partial (results exist; pending/ordered status missing) | P0 | L |
| LA-4 | **Chemo / Appointment Travel ETA** | Compact: clock + "22 min to clinic". Expanded: estimated arrival, appointment time, traffic delta, "Navigate" button. | Strip: facility name, ETA, appointment time, buffer warning if running late. | Patients arriving late to infusion suites disrupts chemotherapy scheduling and can affect drug preparation. | Patient + Caregiver | `appointments`, CalendarBridge location | ✅ Exists | P1 | M |
| LA-5 | **Infusion-Day Hydration Goal** | Compact trailing: water drop + "48oz / 64oz". Expanded: circular progress ring, hourly pacing, "Log 8oz" tap button. | Ring progress + oz remaining + time-paced goal line. | Adequate hydration during and after infusion reduces nephrotoxicity, nausea, and fatigue — especially for platinum-based regimens. | Patient | New `hydration_logs` table, `treatmentCycles.phase` | ❌ New schema needed | P1 | M |
| LA-6 | **Caregiver Shift Handoff** | Compact: caregiver avatar + ETA. Expanded: "Alex arriving in 8 min — last med: Methotrexate 2h ago, pain: 4/10". | Handoff card with last vitals, last med, mood, and caregiver ETA. | Care continuity failures during caregiver shift changes cause medication duplication and missed observations. Real-time handoff state eliminates verbal briefing errors. | Caregiver | `careTeamMembers`, `medicationObservations`, `wellnessCheckins`, new `caregiver_shifts` table | ⚠️ Partial | P1 | L |
| LA-7 | **Symptom Escalation Timer** | Compact: thermometer + "Call MD if fever >38.5°C / 101.3°F persists 30m". Minimal: red dot. Expanded: symptom being watched, elapsed time, triage guidance, "Call Now" action. | Timer bar + triage instruction + one-tap emergency contact. | Patients frequently under-report fever / neutropenic emergencies, delaying life-saving care. An active timer that escalates from "call MD" to "go to ER" mirrors clinical escalation protocols (e.g., NCCN Fever & Neutropenia). | Patient + Caregiver | `symptomEntries`, `careProfiles.emergencyContactPhone`, new `escalation_alerts` table | ⚠️ Partial | P0 | L |

---

## watchOS Complication Catalog

> **Platform:** watchOS 9+ WidgetKit complications (replaces ClockKit). Supported families: `.accessoryCircular`, `.accessoryRectangular`, `.accessoryInline`, `.accessoryCorner`. Legacy ClockKit families (`.modularSmall`, `.graphicCircular`, etc.) supported for watchOS 6–8 via separate templates.

| # | Complication | Families | Display Content | Clinical Rationale | Target User | Required Data | Schema Status | Priority | Complexity |
|---|--------------|----------|-----------------|---------------------|-------------|---------------|---------------|----------|------------|
| C-1 | **Next Med Time** | Circular (clock icon + "2h"), Corner (med name + time), Rectangular (med name, dose, time, progress arc) | Next scheduled medication name, dose, countdown to next dose. Red tint if overdue. | Glanceable adherence support reduces missed doses without requiring app launch. | Patient | `medicationReminders`, `reminderLogs` | ✅ Exists | P0 | S |
| C-2 | **Daily Step Goal** | Circular (ring progress), Rectangular (steps / goal + %) | Steps today vs. daily goal (default 5,000 — reduced from standard 10,000 for chemo patients). | Physical activity is a validated predictor of treatment tolerance and QoL in oncology. ECOG status from profile sets the adaptive goal. | Patient | `WellnessVitals` (HealthKit stepCount), `careProfiles.ecogStatus` | ✅ Exists | P1 | S |
| C-3 | **Pain Entry Shortcut** | Circular (pain emoji/number), Corner (current pain + "log"), Inline ("Pain: 4 — update") | Current pain score (0–10). Tap opens Quick Log screen. | Pain documentation drives clinical decision-making. Reducing friction to 2 taps from the watch face increases data frequency and quality. | Patient | `wellnessCheckins.pain` (last entry) | ✅ Exists | P0 | S |
| C-4 | **Hydration Ring** | Circular (ring %), Rectangular (oz logged / oz goal + arc), Corner (water drop + oz) | Fluid intake today as ring. Goal is infusion-day dynamic. | Hydration compliance during chemo reduces nephrotoxicity and nausea. Watch-face ring is more actionable than a phone notification. | Patient | New `hydration_logs` table | ❌ New schema needed | P1 | M |
| C-5 | **Next Appointment** | Rectangular (apt title + day + time), Inline (specialty + "Tue 2pm"), Circular (calendar + day number) | Next upcoming appointment: specialty, date, countdown in days. | Appointment missed rates in oncology patients are 15–25%. A persistent watch face reminder reduces no-shows. | Patient | `appointments` | ✅ Exists | P1 | S |
| C-6 | **Nadir Day Indicator** | Circular (colored arc with day marker), Corner (cycle day + risk label), Rectangular (regimen, cycle day, nadir window, risk color) | Current day in treatment cycle with nadir window highlighted. Risk band: pre-nadir (gray), nadir (red), recovery (amber), safe (green). | Passive ambient awareness of the nadir window helps both patients and caregivers make daily activity and exposure decisions without clinical consultation. | Patient + Caregiver | `treatmentCycles`, new `nadir_windows` | ⚠️ Partial | P0 | M |
| C-7 | **SOS / Call Care Team** | Circular (phone + "SOS"), Corner (care team icon + "Call") | Tap-to-call to care team emergency line or primary oncologist. Configured from `doctors` table. | In a neutropenic emergency, patients may be too ill to navigate a phone. One-tap from the watch face is a genuine safety feature. | Patient | `doctors`, `careProfiles.emergencyContactPhone` | ✅ Exists | P0 | S |

---

## watchOS Standalone App Screens

> Requires: watchOS 9+ WatchApp target + WatchConnectivity framework for data sync with iOS parent app. All screens are single-purpose, optimized for the S9 chip with <3 tap interactions.

| # | Screen | Core Interaction | Data Read | Data Write | Clinical Value | Target User | Priority | Complexity |
|---|--------|-----------------|-----------|------------|----------------|-------------|----------|------------|
| W-1 | **Quick Med Log** | Show next due medication. Three buttons: ✓ Taken / ⏱ Snooze 15m / ✗ Skip. Optional: Digital Crown to adjust dose if partial. | `medicationReminders`, `medications` | `reminderLogs.status`, `medicationObservations.observationType` | Closes adherence loop without reaching for phone during nausea or weakness. | Patient | P0 | M |
| W-2 | **Symptom Entry** | Scrollable list: Pain (0–10 crown), Energy (low/med/high), Mood (1–5 emoji), Nausea toggle, Fever toggle. Confirm tap. | `wellnessCheckins` (last entry for pre-fill) | `wellnessCheckins`, `symptomEntries` | Maximal friction reduction for symptom tracking. Watch entry during bad days captures data that phone-first UX misses entirely. | Patient | P0 | M |
| W-3 | **Hydration Tap** | Single screen: ring showing current vs. goal. Large "+" button to log 8oz. Long-press for custom amount via Digital Crown. | `hydration_logs` (today's total) | `hydration_logs` | Infusion-day hydration compliance tracked passively with minimal effort. | Patient | P1 | S |
| W-4 | **Mood Check** | 5 emoji face scale (😣→😊). Single tap to log. Optional one-word note via Scribble. | `wellnessCheckins.mood` (yesterday's for trend) | `wellnessCheckins.mood` | Mood data feeds caregiver awareness and AI burnout detection. Watch-first mood capture removes stigma of opening a health app. | Patient + Caregiver | P1 | S |
| W-5 | **Today Overview** (glance home) | Next med (time + name), today's pain (last entry), next appointment (day + specialty), cycle day + phase color. | `medicationReminders`, `wellnessCheckins`, `appointments`, `treatmentCycles` | None (read-only) | Replaces the morning phone-check with a 3-second wrist glance covering all critical care state. | Patient + Caregiver | P1 | M |
| W-6 | **Emergency SOS** | Single large "Call Care Team" button. Displays care team phone, oncologist name. Tap-to-call via watchOS phone proxy. | `doctors`, `careProfiles.emergencyContactPhone` | None | Febrile neutropenia is a medical emergency. Watch-based one-tap call is faster and more reliable than navigating a phone. | Patient | P0 | S |

---

## Data Dependencies Map

### Tables Already in Aurora (no migration needed)

| Wearable Feature | Primary Tables |
|------------------|----------------|
| Med dose LA + complications | `medications`, `medicationReminders`, `reminderLogs`, `medicationObservations` |
| Lab result pending LA | `labResults` (partial — status field missing) |
| Appointment travel LA + complication | `appointments` |
| Nadir countdown (cycle anchor) | `treatmentCycles` |
| Pain / mood / energy watch screens | `wellnessCheckins`, `symptomEntries` |
| Next appointment complication | `appointments` |
| SOS / care team complication | `doctors`, `careProfiles.emergencyContactPhone` |
| Steps complication | HealthKit (WellnessVitals bridge) — no DB write needed |
| Caregiver awareness | `careTeamMembers`, `careGroupMembers`, `medicationObservations` |

### New Tables Required

```sql
-- Migration 018: nadir windows (computed from treatment cycle + regimen)
CREATE TABLE nadir_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id UUID NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  treatment_cycle_id UUID NOT NULL REFERENCES treatment_cycles(id) ON DELETE CASCADE,
  nadir_start_day INTEGER NOT NULL,  -- days post-infusion-start
  nadir_end_day INTEGER NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate',  -- 'mild' | 'moderate' | 'severe'
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overridden_by_clinician BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```sql
-- Migration 019: hydration logs
CREATE TABLE hydration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id UUID NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  logged_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_oz NUMERIC(5,1) NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'watch' | 'healthkit'
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX hydration_logs_profile_day_idx ON hydration_logs(care_profile_id, logged_at);
```

```sql
-- Migration 020: lab orders (pending state for LA-3)
ALTER TABLE lab_results 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'resulted',  
  -- 'ordered' | 'pending' | 'resulted' | 'cancelled'
  ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resulted_at TIMESTAMPTZ;
```

```sql
-- Migration 021: caregiver shifts (for LA-6 handoff)
CREATE TABLE caregiver_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_group_id UUID NOT NULL REFERENCES care_groups(id) ON DELETE CASCADE,
  caregiver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'en_route',  -- 'scheduled' | 'en_route' | 'active' | 'completed'
  eta_minutes INTEGER,
  location_lat NUMERIC(9,6),  -- ephemeral; never persisted >15 min
  location_lng NUMERIC(9,6),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```sql
-- Migration 022: native APNs tokens (for server-side Live Activity push updates)
CREATE TABLE apns_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL DEFAULT 'apns',  -- 'apns' | 'live_activity'
  bundle_id TEXT NOT NULL DEFAULT 'com.aryanmotgi.carecompanion',
  environment TEXT NOT NULL DEFAULT 'production',  -- 'sandbox' | 'production'
  activity_id TEXT,  -- Live Activity identifier for live_activity tokens
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  CONSTRAINT apns_tokens_user_env_idx UNIQUE (user_id, token, environment)
);
```

```sql
-- Migration 023: escalation alerts (for LA-7 symptom escalation timer)
CREATE TABLE escalation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id UUID NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,  -- 'fever' | 'pain_spike' | 'neutropenia' | 'custom'
  threshold_value NUMERIC,
  current_value NUMERIC,
  escalation_level TEXT NOT NULL DEFAULT 'call_md',  -- 'call_md' | 'go_to_er' | 'call_911'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT  -- 'called_md' | 'went_to_er' | 'resolved_at_home' | 'false_alarm'
);
```

### FHIR Data Already Flowing (via HealthKitBridge)

| FHIR Resource | Bridge Field | Used By |
|---------------|-------------|---------|
| `MedicationStatement` | `HKClinicalTypeIdentifier.medicationRecord` | LA-1, C-1, W-1 |
| `Observation` (lab) | `HKClinicalTypeIdentifier.labResultRecord` | LA-3, C-? |
| `Condition` | `HKClinicalTypeIdentifier.conditionRecord` | Nadir severity calibration |
| `Procedure` | `HKClinicalTypeIdentifier.procedureRecord` | Infusion date anchor for LA-5 |
| Vital signs | `HKQuantityType.heartRate`, `.stepCount` | C-2 |

### Push Infrastructure Gap

The existing `pushSubscriptions` table (`schema.ts:524`) stores **Web Push API** tokens (VAPID, p256dh, auth) for web notifications. It cannot be used for iOS Live Activity server-sent updates. Required additions:
1. `apns_tokens` table (migration 022 above)
2. APNs HTTP/2 provider library on the Next.js API (e.g., `apns2`, `node-apn`)
3. Live Activity push token registered via `Activity<T>.pushTokenUpdates` async stream in Swift

---

## Recommended P0 Ship List — 4-Week Scope

**Week 1 — Infrastructure & Xcode scaffolding**
- [ ] Add `CareCompanionLiveActivity` extension target to `project.pbxproj` (Shreyash)
- [ ] Add `CareCompanionWidgets` extension target (combined complications + Lock Screen widgets) (Shreyash)
- [ ] Run migrations 020 (lab status) and 022 (APNs tokens) (Aryan)
- [ ] Add APNs token registration endpoint `/api/mobile/apns-token` (Aryan)
- [ ] Add APNs sender utility to web app (`apps/web/src/lib/apns.ts`) (Aryan)

**Week 2 — LA-1: Med Dose Live Activity**
- [ ] Define `MedicationActivityAttributes` Swift struct (Shreyash)
- [ ] Build Dynamic Island compact + expanded views (Shreyash)
- [ ] Build Lock Screen view (Shreyash)
- [ ] Wire TAKEN/SNOOZE/SKIP button actions to existing `reminderLogs` API (Shreyash + Aryan)
- [ ] Server-side push update when reminder fires (`reminderLogs` cron → APNs) (Aryan)

**Week 3 — LA-2: Nadir Countdown + C-6: Nadir Complication**
- [ ] Run migration 018 (nadir_windows) (Aryan)
- [ ] Nadir computation from `treatmentCycles` + regimen lookup (standard nadir days per regimen: FOLFOX d7–14, AC d7–10, R-CHOP d7–14) (Aryan)
- [ ] `NadirActivityAttributes` Live Activity + Dynamic Island views (Shreyash)
- [ ] `NadirComplicationView` (`.accessoryCircular` + `.accessoryCorner`) (Shreyash)

**Week 4 — C-1, C-3, C-7: Core Complications + W-1, W-2, W-6: Watch Screens**
- [ ] watchOS Watch app target + WatchConnectivity session (Shreyash)
- [ ] Next Med Time complication (`.accessoryCircular`, `.accessoryRectangular`) (Shreyash)
- [ ] Pain Entry complication shortcut (`.accessoryCircular`, `.accessoryCorner`) (Shreyash)
- [ ] SOS complication + watch screen (Shreyash)
- [ ] Quick Med Log watch screen (Shreyash)
- [ ] Symptom Entry watch screen (Shreyash)

**Post-P0 / P1 Backlog**
- LA-3 Lab result Live Activity (needs lab order FHIR integration)
- LA-4 Appointment travel (ETA from Maps API)
- LA-5 Infusion-day hydration (migration 019)
- LA-6 Caregiver shift handoff (migration 021 + privacy review — location is PHI-adjacent)
- LA-7 Symptom escalation timer (migration 023 + clinical protocol review)
- C-4 Hydration ring (migration 019)
- W-3 Hydration tap (migration 019)
- W-4 Mood check
- W-5 Today Overview glance

---

## Sources

Apple platform knowledge current to iOS 18.x / watchOS 11.x design guidance and WWDC 2024:

| Topic | Reference |
|-------|-----------|
| ActivityKit framework | https://developer.apple.com/documentation/activitykit |
| Live Activities HIG | https://developer.apple.com/design/human-interface-guidelines/live-activities |
| Dynamic Island layout regions | WWDC23 Session 10194 "Update Live Activities with ActivityKit push notifications" |
| watchOS Complications HIG | https://developer.apple.com/design/human-interface-guidelines/complications |
| WidgetKit complications (watchOS 9+) | https://developer.apple.com/documentation/widgetkit/creating-accessory-widgets-and-watch-complications |
| WatchConnectivity | https://developer.apple.com/documentation/watchconnectivity |
| NCCN Fever & Neutropenia Guidelines | https://www.nccn.org/guidelines/guidelines-detail?category=3&id=1457 |
| Chemo nadir timing reference | Lyman GH et al. J Clin Oncol 2011; MASCC/ESMO Febrile Neutropenia Guidelines 2021 |
| Oral chemo adherence statistics | Greer JA et al. J Clin Oncol 2016; Regnier Denois V, Support Care Cancer 2011 |
| Codebase audit | `apps/mobile/ios/CareCompanion/Info.plist`, `CareCompanion.entitlements`, `project.pbxproj`, `HealthKitBridge.swift`, `WellnessVitals.swift`, `CalendarBridge.swift`, `src/services/notifications.ts`, `apps/web/src/lib/db/schema.ts` |
