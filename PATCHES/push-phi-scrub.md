# Push Notification PHI Scrub

**Date:** 2026-05-22  
**Scope:** All `sendPushNotification` call sites in `apps/web/src/`  
**Risk:** Push `body` (and `title`) are rendered on the device lock screen before biometric/PIN unlock — any PHI there is a HIPAA breach.

---

## Audit Results

| # | Template | File:Line | Current body / title | PHI detected? | Sanitized body / title |
|---|----------|-----------|----------------------|---------------|------------------------|
| 1 | Weekly summary push body | `apps/web/src/app/api/cron/weekly-summary/route.ts:226` | `This week's update for ${profile.patientName \|\| 'your loved one'} is ready. Tap to preview and share with family.` | **YES** — patient name | `Your weekly care update is ready. Tap to preview and share with family.` |
| 2 | Nadir alert push title | `apps/web/src/app/api/cron/nadir-alert/route.ts:123` | `⚠️ ${patientLabel} enters nadir week today` | **YES** — patient name in title | `⚠️ Nadir week begins today` |
| 3 | Nadir summary push body | `apps/web/src/app/api/cron/nadir-summary/route.ts:124` | `See how ${patientLabel} did during nadir — tap to view and share.` | **YES** — patient name | `Nadir week is over — tap to view the recap and share with your care team.` |
| 4 | Radar: pain trending up title | `apps/web/src/app/api/cron/radar/route.ts:465` | `${patientName}: pain ${recentAvgPain.toFixed(1)}/10 avg (↑ 3 days)` | **YES** — patient name + pain score | `Pain trending up — check in with your care team` |
| 5 | Radar: pain trending up body | `apps/web/src/app/api/cron/radar/route.ts:466` | `Pain averaged ${recentAvgPain.toFixed(1)}/10 last 3 days, up from ${priorAvgPain.toFixed(1)}/10...` | **YES** — pain scores (clinical metric) | `Pain levels have been rising over the last few days. Tap to review and reach out to the care team.` |
| 6 | Radar: nadir window title | `apps/web/src/app/api/cron/radar/route.ts:476` | `Nadir window — Day ${cycleDay} of Cycle ${cycle.cycleNumber}` | **YES** — treatment cycle day/number (clinical) | `Nadir window active — blood counts at their lowest` |
| 7 | Radar: adherence title | `apps/web/src/app/api/cron/radar/route.ts:506` | `Medication adherence: ${adherenceRate}% this week` | **YES** — medication adherence rate | `Medication check-in: your care routine needs attention` |
| 8 | Radar: adherence body | `apps/web/src/app/api/cron/radar/route.ts:507` | `${takenReminders} of ${totalReminders} doses taken. If something's making it hard...` | **YES** — dose counts (medication info) | `Medication adherence has been lower this week. Tap to review and connect with the care team.` |
| 9 | Radar: mood improving title | `apps/web/src/app/api/cron/radar/route.ts:517` | `${patientName}'s mood is looking brighter` | **YES** — patient name | `Mood improving — great progress this week` |
| 10 | Radar: mood improving body | `apps/web/src/app/api/cron/radar/route.ts:518` | `Mood up to ${recentAvgMood.toFixed(1)}/5 from ${priorAvgMood.toFixed(1)}/5 earlier this week.` | **YES** — mood scores (health metric) | `Things are looking up this week. Tap to see the latest check-in summary.` |
| 11 | Radar: caregiver snapshot title | `apps/web/src/app/api/cron/radar/route.ts:531` | `${patientName}'s weekly snapshot` | **YES** — patient name | `Weekly care snapshot ready` |
| 12 | Radar: caregiver snapshot body | `apps/web/src/app/api/cron/radar/route.ts:532` | `${checkins.length} check-ins, avg pain ${avgPainStr}/10, mood ${avgMoodStr}/5.${cycleTag}` | **YES** — pain/mood scores + cycle info | `This week's check-in summary is ready. Tap to review.` |
| 13 | Radar: gratitude nudge title | `apps/web/src/app/api/cron/radar/route.ts:665` | `${caregiverName} has been checking in every day` | **YES** — caregiver name | `Your care team has been showing up for you` |
| 14 | Radar: gratitude nudge body | `apps/web/src/app/api/cron/radar/route.ts:666` | `${caregiverName} has been checking in on you every day for a month.` | **YES** — caregiver name | `Someone on your care team has been checking in every day for a month. Want to send them a note?` |
| 15 | Check-in: high pain body | `apps/web/src/app/api/checkins/route.ts:175` | `${profile.patientName ?? 'Patient'} reported pain level ${parsed.pain}/10.` | **YES** — patient name + pain level | `A high pain level has been reported. Tap to check in with your care team.` |
| 16 | Check-in: low mood body | `apps/web/src/app/api/checkins/route.ts:181` | `${profile.patientName ?? 'Patient'} reported very low mood (1/5).` | **YES** — patient name + mood score | `A very low mood has been reported. Consider reaching out.` |
| 17 | Check-in: low energy+pain body | `apps/web/src/app/api/checkins/route.ts:187` | `${profile.patientName ?? 'Patient'} reported low energy with pain level ${parsed.pain}/10.` | **YES** — patient name + pain level | `Low energy and elevated pain have been reported. Tap to check in.` |
| 18 | Check-in share body | `apps/web/src/app/api/checkins/share/route.ts:76` | `${moodEmoji} Mood · Pain ${checkin.pain}/10 · Energy ${checkin.energy} · Sleep ${checkin.sleep}` | **YES** — pain, energy, sleep (health metrics) | `A new check-in update is available. Tap to view details.` |
| 19 | Care-hub remind body | `apps/web/src/app/api/care-hub/remind/route.ts:59` | `Your care team is thinking of ${name}. How are you feeling today?` | **YES** — patient first name | `Your care team is thinking of you. How are you feeling today?` |

---

## Clean templates (no PHI on lock screen)

| Template | File | Notes |
|----------|------|-------|
| `notifications.ts` push bodies | `apps/web/src/lib/notifications.ts` | Already redacted generics — compliant |
| Nadir alert body | `nadir-alert/route.ts:124` | Generic medical instruction only — compliant |
| Streak milestones | `radar/route.ts:489-494` | No PHI — compliant |
| Caregiver burnout body | `radar/route.ts:545` | No PHI — compliant |
| `How are YOU doing?` title | `radar/route.ts:544` | No PHI — compliant |
| Care-hub remind title | `care-hub/remind/route.ts:58` | No PHI — compliant |

---

## Patches Applied

All 19 violations fixed directly in `apps/web/src/`. PHI-rich content remains available inside the authenticated app (in-app notifications, DB records, page content) — only the lock-screen-visible push payload was sanitized.
