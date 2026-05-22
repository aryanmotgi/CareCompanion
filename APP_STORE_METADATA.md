# App Store Screenshot Capture Plan

## Device Targets

| Slot | Device                      | Resolution    | Required |
|------|-----------------------------|---------------|----------|
| 6.7" | iPhone 16 Pro Max / 15 Pro Max | 1320 × 2868 px | Yes      |
| 6.5" | iPhone 14 Plus / 13 Pro Max | 1242 × 2688 px | Yes      |
| 5.5" | iPhone 8 Plus               | 1242 × 2208 px | Yes      |

Total: 10 screens × 3 sizes = **30 captures**

---

## Screen 01 — Home: Your Care OS

**File prefix:** `01_home`

**What to show:**
- Header: patient name + cancer type pill (e.g. "Sarah · Breast Cancer Stage II")
- Profile completion ring (green, ~85%)
- Nudge card: "Paclitaxel refill due in 2 days"
- Today's Medications card (3 meds: 1 taken, 1 upcoming, 1 overdue)
- Daily Alerts card (1 alert: abnormal WBC)
- Check-in CTA button at bottom: "Log today's check-in"

**Overlay copy (overlay as text on gradient backdrop):**
```
Headline:   Your Care OS
Subhead:    Every medication, appointment, and alert — in one place.
```

**Simulator state:** Morning, one overdue med, one abnormal lab nudge visible.

---

## Screen 02 — Daily Check-In Modal

**File prefix:** `02_checkin`

**What to show:**
- Modal pulled up over blurred home screen
- Sliders set to realistic values: Pain 4/10, Mood 6/10, Sleep 7h, Energy 5/10, Appetite 7/10
- Symptom tag chips: "Fatigue" and "Nausea" selected (purple highlighted)
- "Save Check-In" button visible and active

**Overlay copy:**
```
Headline:   How are you feeling today?
Subhead:    Track symptoms in seconds. Spot trends over time.
```

**Simulator state:** At least 2 symptom tags selected; Save button enabled.

---

## Screen 03 — AI Chat: Multi-Agent Assistant

**File prefix:** `03_chat`

**What to show:**
- User message: "Are there any interactions between Metformin and the new Carboplatin dose?"
- AI response streaming complete — multi-paragraph answer covering drug interaction data, recommendation to confirm with oncologist, disclaimer
- Agent badge visible ("Medication Specialist")
- Mic icon in input bar

**Overlay copy:**
```
Headline:   Ask anything. Know everything.
Subhead:    6 specialist AI agents answer your toughest care questions instantly.
```

**Simulator state:** Conversation showing ≥2 turns; response complete (not streaming).

---

## Screen 04 — Care Hub

**File prefix:** `04_care_hub`

**What to show:**
- Two tabs: "My Care" active, "Care Group" visible
- Medication list: 4 meds (Metformin, Ondansetron, Paclitaxel, Dexamethasone) with dose + time chips
- Upcoming appointment card: "Dr. Chen · Oncology · Tomorrow 10:00 AM"
- Recent lab card: "WBC 2.1 — Abnormal" flagged in red
- FAB (floating action button) for adding medication

**Overlay copy:**
```
Headline:   Your complete care hub
Subhead:    Medications, appointments, and labs — always in sync.
```

**Simulator state:** Mix of taken/upcoming med statuses; at least one abnormal lab visible.

---

## Screen 05 — Symptom Radar

**File prefix:** `05_radar`

**What to show:**
- Radar/spider chart with 6 axes: Pain, Mood, Sleep, Energy, Appetite, Nausea
- Two overlaid polygons: This Week (purple) vs Last Week (teal)
- AI Insight card below: "Pain elevated 40% above your baseline — discuss with Dr. Chen at Tuesday's visit."
- Severity badge: "Warning" in amber

**Overlay copy:**
```
Headline:   See your health at a glance
Subhead:    AI-powered symptom radar surfaces trends before they become problems.
```

**Simulator state:** Pain axis visibly higher this week; insight card fully rendered.

---

## Screen 06 — Treatment Timeline

**File prefix:** `06_timeline`

**What to show:**
- Header: "Treatment Journey"
- Filter bar: "All" selected (Medications / Labs / Appointments / Notes chips visible)
- 5–6 timeline events stacked vertically, newest at top:
  - Cycle 4 Day 1 Infusion
  - WBC Result: 2.1 (Abnormal)
  - Metformin dose adjusted
  - Appointment: Dr. Patel
  - New allergy flagged: Sulfa
- Timeline line connecting events with colored dots

**Overlay copy:**
```
Headline:   Every moment of their journey
Subhead:    A living record of treatments, labs, and milestones — shareable with any doctor.
```

**Simulator state:** At least 5 timeline cards; filter bar visible at top.

---

## Screen 07 — Document Scanner

**File prefix:** `07_scan`

**What to show:**
- Camera viewfinder active with corner bracket guides overlaid
- Document being scanned: insurance EOB or lab report (mock document)
- Bottom sheet: "Detecting document…" with spinner then "Insurance EOB detected — tap to extract"
- Category chips: Insurance / Lab / Prescription / Other

**Overlay copy:**
```
Headline:   Scan. Extract. Remember.
Subhead:    Point your camera at any health document — CareCompanion reads it for you.
```

**Simulator state:** Post-scan state showing the detected document type; extraction prompt visible.

---

## Screen 08 — Lab Results

**File prefix:** `08_labs`

**What to show:**
- Labs screen with filter tabs: All / Abnormal / Recent
- "Abnormal" tab active
- 3 result rows:
  - WBC 2.1 K/µL — Low (red chip)
  - Neutrophils 38% — Low (red chip)
  - Hemoglobin 10.2 g/dL — Low (amber chip)
- Each row shows date, reference range, and status chip
- AI summary banner: "3 abnormal values — recommend contacting your care team today."

**Overlay copy:**
```
Headline:   Lab results, explained
Subhead:    Flag abnormal values instantly and get plain-language explanations.
```

**Simulator state:** Abnormal tab active, 3 flagged results; AI banner pinned at top.

---

## Screen 09 — Emergency Info Card

**File prefix:** `09_emergency`

**What to show:**
- Full-screen card on deep red/dark background
- Large "Sarah Johnson · 62 · Female" header
- Allergies section (highlighted in red): Penicillin, Sulfa drugs
- Current Medications (abbreviated list): Metformin, Paclitaxel, Dexamethasone
- Conditions: Type 2 Diabetes, Breast Cancer Stage II
- Insurance: Aetna PPO — Member #12345678
- Emergency Contact: David Johnson · (415) 555-0182
- Two large buttons: "Call 911" (red) and "988 Crisis Line" (purple)

**Overlay copy:**
```
Headline:   Emergency info. One tap away.
Subhead:    Critical details for first responders — always accessible, even offline.
```

**Simulator state:** All fields populated; Call 911 button clearly visible.

---

## Screen 10 — Care Team

**File prefix:** `10_care_team`

**What to show:**
- "Care Group" tab active within Care Hub
- 3 members listed with role badges: Owner (you), Editor (Sarah), Viewer (Mom)
- Activity feed below: "Sarah added Metformin · 2h ago", "David joined the care team · Yesterday"
- "Invite Member" button at bottom
- Small avatar initials circles for each member

**Overlay copy:**
```
Headline:   Care is a team sport
Subhead:    Invite family members to stay in the loop — with role-based access control.
```

**Simulator state:** 3 members listed; activity feed showing at least 2 events.

---

## Capture Checklist

For each screen, capture at all three sizes in the same session:

- [ ] 01_home_6.7.png / 01_home_6.5.png / 01_home_5.5.png
- [ ] 02_checkin_6.7.png / 02_checkin_6.5.png / 02_checkin_5.5.png
- [ ] 03_chat_6.7.png / 03_chat_6.5.png / 03_chat_5.5.png
- [ ] 04_care_hub_6.7.png / 04_care_hub_6.5.png / 04_care_hub_5.5.png
- [ ] 05_radar_6.7.png / 05_radar_6.5.png / 05_radar_5.5.png
- [ ] 06_timeline_6.7.png / 06_timeline_6.5.png / 06_timeline_5.5.png
- [ ] 07_scan_6.7.png / 07_scan_6.5.png / 07_scan_5.5.png
- [ ] 08_labs_6.7.png / 08_labs_6.5.png / 08_labs_5.5.png
- [ ] 09_emergency_6.7.png / 09_emergency_6.5.png / 09_emergency_5.5.png
- [ ] 10_care_team_6.7.png / 10_care_team_6.5.png / 10_care_team_5.5.png

## Overlay Design Notes

- Gradient backdrop: match app's `gradientA` (`#0f0c29` → `#302b63` → `#24243e`)
- Headline font: SF Pro Display Bold, 34pt, white
- Subhead font: SF Pro Text Regular, 17pt, white 80% opacity
- Overlay block: bottom 28% of frame, with 32px horizontal padding
- Device frame: use official Apple device frames (Figma Apple Design Resources)
- Localization: English (US) only for v1.0 submission
