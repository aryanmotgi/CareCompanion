# Customer Journey Leak Map

_Pure code inference — no live data. Date: 2026-05-19._

---

## Flow Map

```
SIGNUP
  landing (/) ──► /signup ──► email verify ──► /onboarding ──► /dashboard
                                                  │
                              ⚠️ L4: No step progress indicator (role→profile→care-group, 3+ steps)

FIRST-USE
  /dashboard ──► check-in ──► /chat ──► memory created ──► care group action
                   │
       ⚠️ L1: journal.tsx Save is a no-op (data silently dropped)

DAILY
  home ──► voice-checkin ──► journal ──► dashboard ──► close
              │                  │
  ⚠️ L2: stub (fakes success,  ⚠️ L1: same no-op save
          nothing persisted)

RETENTION
  push notification ──► notification tap ──► action handler ──► re-engagement
                                                   │
                    ⚠️ L3: dose/appointment handlers missing (_layout.tsx:570)
                                                   ▼
  weekly-summary cron ──► ??? ──► milestones (not tracked in UI)
  symptom-radar ──► charts ──► ⚠️ L5: empty stubs (no chart rendering)
```

---

## Top 5 Leaks

| # | Stage | Signal | Code Location | Severity | Fix Sketch |
|---|-------|--------|---------------|----------|------------|
| **L1** | FIRST-USE / DAILY | Journal Save calls `router.back()` with **no API call** — every check-in is silently discarded | `apps/mobile/app/journal.tsx:169-170` | 🔴 Critical — permanent trust loss when user notices data vanished | Add `await fetch('/api/checkins', { method: 'POST', body: JSON.stringify({...}) })` before `router.back()` |
| **L2** | DAILY | Voice check-in **fakes success** — hardcoded stub data shown, nothing POSTed, recording never happens | `apps/mobile/app/voice-checkin.tsx:40,48-49,63-64` | 🔴 Critical — deceptive: user believes they logged, history is empty | At minimum show error state; long-term: wire `expo-av` + POST `/api/checkins/voice-extract` |
| **L3** | RETENTION | Dose and appointment notification taps **fall through silently** — the only re-engagement mechanism for medication adherence | `apps/mobile/app/_layout.tsx:570-572` | 🟠 High — push is the primary daily activation hook; silent tap = trained ignore |  Add `router.push('/medications')` / `router.push('/appointments')` for `DOSE_*` / `APPT_*` action IDs |
| **L4** | SIGNUP | Onboarding wizard has **no step progress indicator** — role → care profile → care group is 3+ steps with no "Step 2 of 4" signal | `apps/web/src/app/onboarding/page.tsx → OnboardingShell` | 🟠 High — early funnel; users abandon because they don't know how much effort remains | Add `currentStep` / `totalSteps` props to `OnboardingShell` and render a dot-stepper in the header |
| **L5** | DAILY | Symptom radar and treatment cycle **render empty chart areas** — Victory Native TODOs, users see blank cards and assume broken app | `apps/mobile/app/symptom-radar.tsx:175,181` `apps/mobile/app/treatment-cycle.tsx:218` | 🟡 Medium — erodes confidence in analytics features; less catastrophic than data loss |  Add skeleton placeholder (`<View style={{height:120, backgroundColor: theme.border, borderRadius: 8}} />`) until charts land |

---

## Quick Wins (sub-1hr)

**L1 — Wire journal save** (~20 min)
```diff
-  // TODO: POST to /api/checkins with { mood: selectedMood, pain: painLevel, symptoms: selectedSymptoms, notes }
-  router.back()
+  await fetch('/api/checkins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mood: selectedMood, pain: painLevel, symptoms: selectedSymptoms, notes }) })
+  router.back()
```
`apps/mobile/app/journal.tsx:169-170`

**L2 — Surface voice check-in failure instead of fake success** (~10 min)
```diff
-  setState('done')
-  setExtracted({ pain: 4, mood: 'okay', energy: 'moderate', notes: 'Voice stub placeholder' })
+  setState('error')
+  setErrorMsg('Voice recording is coming soon — use the journal form for now.')
```
`apps/mobile/app/voice-checkin.tsx:48-50`

**L3 — Route dose/appointment notification taps** (~15 min)
```diff
-  // Other action handlers (dose / appointment) — left as TODO until
-  if (__DEV__) console.log('[notif-action]', resp.actionId)
+  if (actionId?.startsWith('DOSE')) { router.push('/(tabs)/care'); return }
+  if (actionId?.startsWith('APPT')) { router.push('/appointments'); return }
```
`apps/mobile/app/_layout.tsx:570-572`

**L5 — Add chart skeleton** (~15 min)
```diff
-  {/* TODO: render mini sparklines per metric */}
+  <View style={{ height: 80, backgroundColor: theme.border + '33', borderRadius: 10 }} />
```
`apps/mobile/app/symptom-radar.tsx:175`

---

## Long-Term Fixes

| Fix | Effort | What It Unlocks |
|-----|--------|-----------------|
| **Implement `expo-av` voice recording** in `voice-checkin.tsx` | 2–3 days (audio permissions, upload, transcription) | Voice check-ins become real; sticky daily-use habit loop |
| **Onboarding step progress** in `OnboardingShell` | 1 day | Measurable signup completion lift; A/B-testable |
| **Victory Native charts** in `symptom-radar.tsx` + `treatment-cycle.tsx` | 2 days | Data visualization is a core retention driver for patients tracking treatment |
| **Milestone / streak tracking** in home tab | 3 days | Gamified retention without a separate backend; surfaces in weekly-summary cron |
