# THE_ONE_THING: CareCompanion First-Principles Audit

_2026-05-19 — fresh-eyes read of apps/web/src/, apps/mobile/, schema.ts, API routes, system-prompt.ts_

---

## The User

Maya, 34, project manager. Her dad (65, stage-3 lung cancer, EGFR+, on osimertinib) is treated at Stanford; she lives 90 minutes away and coordinates two siblings and a primary care doc who doesn't talk to the oncologist. Her onboarding answers: `coordinating_care`, `first_time`, `anxious`. She has no idea what ANC means but she knows the chemo happened Tuesday and he's feeling bad.

---

## The Magic Moment

The AI says: _"Your dad is around Day 10 of Cycle 3 — nadir. His last ANC was 0.8, which is borderline. Watch for fever above 100.4°F; that's an ER call. Here are 3 questions for Tuesday's visit."_  
→ `apps/web/src/lib/system-prompt.ts:182–186` (treatment cycle awareness, combined with L3 dynamic context per turn)

No other app on earth says this. Not MyChart. Not a nurse hotline at 11pm.

---

## The Value ($9.99/mo for)

Unlimited clinical trial matching with mutation-aware AI eligibility screening and email alerts when a new match opens — the one feature that can literally extend a life.

_(Currently free and buried in a tab. Three searches per hour, no alerts, no paywall — this is the product's biggest strategic mistake.)_

---

## The MVP

Five features that must survive ruthless cuts:

- **AI chat with treatment-cycle awareness** — the whole product hinges on this; everything else feeds it context
- **Medication tracking + reminders** — daily utility that earns the app a home-screen slot
- **Daily check-in (30 seconds)** — mood, pain, energy; pushes result to caregivers automatically
- **One-click share link** — weekly health summary to the family; replaces the group-text chaos
- **Lab result plain-English translation** — "Your CEA dropped 40% — that's the tumor marker; good trend" is irreplaceable

---

## The Bet

The hospital EHR is where the data lives but where comprehension dies — CareCompanion wins by being the intelligence layer that sits on top of MyChart and actually tells you what to do next.

---

## What I'd Change

- **Move trial matching to a $9.99/mo paywall and put it on the home screen.** "2 new trial matches for KRAS G12C" as the first thing Maya sees. It's already the most expensive infrastructure (`/api/trials/match` maxDuration 300s, dedicated cron, mutation biomarker schema) — charging zero for it is irrational. Free tier: 1 search/week. Paid: unlimited + push alerts on new openings.

- **Delete `/journal` and redirect to `/home`; merge symptom fields into the daily check-in.** Two separate symptom-tracking surfaces (journal + check-in) split engagement and confuse new users. One 30-second daily ritual beats two half-hearted ones. Kill the route, fold the 5 fields in.

- **Kill `/community` and replace with in-app care-team chat.** An anonymous cancer forum competing against Reddit/Facebook Groups will never win. The schema has `careTeamActivity` logs and `careTeamMembers` — build a threaded conversation there instead. Maya doesn't need strangers; she needs her sister and her dad's nurse on the same thread.
