# iOS Parity Audit — Premium Care OS

**Date:** 2026-05-18  
**Branch:** aryan/dev  
**Auditor:** automated scan via Claude Code

---

## Summary

10 features audited, 8 gaps identified (6 fully missing, 2 partial).

---

## Per-Feature Table

| # | Feature | Web Path | Mobile Path | Status | Complexity | Priority |
|---|---------|----------|-------------|--------|------------|----------|
| 1 | Symptom Journal | `apps/web/src/app/(app)/journal/page.tsx` + `SymptomJournal.tsx` | MISSING | ❌ Missing | L | P1 |
| 2 | Symptom Radar Card | `apps/web/src/components/SymptomRadarCard.tsx` | MISSING | ❌ Missing | M | P1 |
| 3 | Voice Check-in | `apps/web/src/components/VoiceCheckin.tsx` | MISSING | ❌ Missing | M | P2 |
| 4 | Treatment Cycle Tracker | `apps/web/src/components/TreatmentCycleTracker.tsx` | MISSING | ❌ Missing | M | P2 |
| 5 | Caregiver Burnout Card | `apps/web/src/components/CaregiverBurnoutCard.tsx` | MISSING | ❌ Missing | S | P2 |
| 6 | Share Health Card | `apps/web/src/components/ShareHealthCard.tsx` | MISSING | ❌ Missing | S | P3 |
| 7 | Analytics Page | `apps/web/src/app/(app)/analytics/page.tsx` | MISSING | ❌ Missing | L | P3 |
| 8 | Calendar | `apps/web/src/app/(app)/calendar/page.tsx` | MISSING | ❌ Missing | M | P3 |
| 9 | Notification Preferences | `apps/web/src/components/NotificationPreferences.tsx` | `apps/mobile/app/notification-settings.tsx` | ⚠️ Partial — missing category-level toggles + quiet hours | S | P2 |
| 10 | Self Care Dashboard | `apps/web/src/components/SelfCareDashboardView.tsx` | MISSING (index.tsx covers patient only) | ❌ Missing | M | P3 |
| — | Check-in Card/Modal | `apps/web/src/components/CheckinCard.tsx` | `apps/mobile/src/components/home/CheckInModal.tsx` | ✅ Present | — | — |
| — | Timeline | `apps/web/src/app/(app)/timeline/page.tsx` | `apps/mobile/app/timeline.tsx` | ✅ Present | — | — |
| — | Notifications List | `apps/web/src/components/NotificationsView.tsx` | `apps/mobile/app/notifications.tsx` | ✅ Present | — | — |
| — | Care Hub | `apps/web/src/components/CareHubView.tsx` | `apps/mobile/app/(tabs)/care.tsx` | ✅ Present | — | — |

---

## Prioritized Punch List (Top 10)

### P1 — Ship ASAP

1. **Symptom Journal** (`apps/mobile/app/journal.tsx`)  
   Users log symptoms, mood, pain, energy per day. Web shows 14-day history with tag-based symptom picker. No equivalent exists on mobile. Blocks daily engagement loop.  
   _Owner: Shreyash. Depends on `/api/checkins` + `/api/symptom-entries` (already wired for mobile)._

2. **Symptom Radar Card** (`apps/mobile/app/symptom-radar.tsx`)  
   Orb-based visual displaying pain/mood/energy sparklines with last check-in timestamp. Web: `SymptomRadarCard.tsx`. Pure read view — fetch from `/api/checkins`, render orbs + mini sparklines.  
   _Owner: Shreyash. API parity: complete (checkins endpoint already used by mobile)._

### P2 — Next Sprint

3. **Voice Check-in** (`apps/mobile/app/voice-checkin.tsx`)  
   User records voice note, server extracts pain/mood/energy via `/api/checkins/voice-extract`. Web uses `MediaRecorder`; mobile should use `expo-av`. Key accessibility/premium feature.  
   _Owner: Shreyash. Blocked until `expo-av` confirmed in package.json._

4. **Treatment Cycle Tracker** (`apps/mobile/app/treatment-cycle.tsx`)  
   Shows current chemo cycle day, phase (infusion/rest/recovery), side-effect severity dots, and overall progress bar. Parses cycle info from medication notes. Web: `TreatmentCycleTracker.tsx`.  
   _Owner: Shreyash. Complexity: M — pure local computation from existing meds data._

5. **Caregiver Burnout Card** (`apps/mobile/app/caregiver-burnout.tsx`)  
   Fetches `/api/caregiver-burnout` assessment, shows burnout risk badge + suggested actions. Web: `CaregiverBurnoutCard.tsx`. Fully additive, no schema changes needed.  
   _Owner: Shreyash._

6. **Notification Preferences** — extend `apps/mobile/app/notification-settings.tsx`  
   Add per-category toggle rows (appointments, medications, wellness_checkins, shared_records, clinical_alerts) and quiet-hours time-picker to match web's `NotificationPreferences.tsx`.  
   _Owner: Shreyash. API: `/api/notifications/preferences` already exists._

### P3 — Backlog

7. **Share Health Card** (`apps/mobile/app/share-health.tsx`)  
   Generate shareable one-page health card (PDF / share sheet). Web: `ShareHealthCard.tsx` calls `/api/export/pdf`. Mobile can use `Share.share()` from react-native + base64 PDF.

8. **Analytics Page** (`apps/mobile/app/analytics.tsx`)  
   Charts: weekly symptom trends, medication adherence heatmap, caregiver engagement score. Web: `AnalyticsPage`. High complexity (recharts → Victory Native or custom SVG).

9. **Self Care Dashboard** (`apps/mobile/app/self-care-dashboard.tsx`)  
   Mood support banner + quick-action tiles for patient self-care (check-in, journal, chat). Web: `SelfCareDashboardView.tsx`. Currently masked by the combined home screen.

10. **Calendar** (`apps/mobile/app/calendar.tsx`)  
    Monthly view of appointments, medication days, and chemo cycles. Web: `CalendarPage`. Requires `react-native-calendars` or similar; coordinate with Shreyash.

---

## Stub Files Generated

The following stubs were scaffolded for the top 5 P1/P2 gaps:

- `apps/mobile/app/journal.tsx`
- `apps/mobile/app/symptom-radar.tsx`
- `apps/mobile/app/voice-checkin.tsx`
- `apps/mobile/app/treatment-cycle.tsx`
- `apps/mobile/app/caregiver-burnout.tsx`
