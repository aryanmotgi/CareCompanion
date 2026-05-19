# Magic Moment: CareCompanion WOW Analysis
_2026-05-19_

---

## 3 Candidate Magic Moments

| # | Where in Code | What Happens | Frequency | What Makes It Special |
|---|---------------|--------------|-----------|----------------------|
| **1** | `system-prompt.ts:183–301`, `cron/radar/route.ts:330,398–407` | AI computes the patient's exact cycle day and says "Day 10 of Cycle 3 — you're in nadir. Watch for fever >100.4°F, that's an ER call." Cron pushes this proactively at 6am even if the user never opens chat. | Every chat turn + daily push during nadir (days 7–14 of every 21–28 day cycle) | No other consumer app does oncology cycle math. MyChart shows raw ANC. Epic shows appointments. Neither tells a caregiver what to watch for tonight. |
| **2** | `cron/radar/route.ts:130–162, 433–442` | The daily radar cron compares caregiver app activity over two 7-day windows. A significant drop triggers a `caregiver_burnout` insight. The app notices when Maya is fading before Maya does. | Daily audit; alert fires when burnout pattern detected (~weekly for high-stress caregivers) | Health apps track the patient. This one tracks the caregiver as a clinical signal — the only product that treats caregiver exhaustion as a medical risk, not a personal failing. |
| **3** | `lib/trials/clinicalTrialsAgent.ts:29–114`, `app/api/trials/match/route.ts` | Scores 40 trials from ClinicalTrials.gov per patient, returns `matchScore`, `matchReasons`, and typed `eligibilityGaps` (measurable / conditional / fixed) — not just "you might qualify" but "here's what's missing and whether it's closable." | On-demand, max 3×/hour | Trial matching tools give lists. This one explains why you're close and what would close the gap. Literally life-extending, currently buried and free. |

---

## The One to Double Down On

**Nadir Awareness** (Moment #1).

The nadir moment is the only thing in consumer health software that is simultaneously life-saving, architecturally defensible, and emotionally unforgettable. It requires treatment cycle tracking + oncology domain knowledge + timing logic + push infrastructure — none of which a generic health app can replicate without years of vertical investment. It fires multiple times per cycle (every chat turn + daily cron), which means it compounds in user memory. And the emotional stakes are absolute: a neutropenic fever is a medical emergency; telling a caregiver at 11pm that tonight is the night to have a thermometer out is not a nice-to-have — it is the moment the app becomes irreplaceable. Caregiver burnout detection is emotionally resonant but fires rarely and is invisible to users. Trial matching is high-value but on-demand and currently free (a separate strategic error). Nadir awareness triggers passively, repeatedly, and at the exact moment of highest stakes — that is the moat.

---

## 5 Amplification Changes

**1. Nadir-aware chat greeting card** — Effort: 0.5 days
- When user opens chat during days 7–14 of an active cycle, render a pinned context card above the input: _"Day 11 of Cycle 3 — nadir window. Last ANC: 0.8. Watch for fever > 100.4°F tonight."_
- Files: `apps/web/src/app/(app)/chat/page.tsx` (add NadirContextBanner component), `apps/web/src/lib/system-prompt.ts:289–301` (expose `isNadir` flag to client via chat API response metadata).
- Effect: Turns a passive AI behavior into a visible, named UI state. User sees it every time they open chat during the most dangerous week of the cycle.

**2. Dashboard nadir sticky banner** — Effort: 0.5 days
- When `cycleDay` is 7–14, render a dismissible-but-daily alert card at the top of `apps/web/src/app/(app)/dashboard/page.tsx` above medications: _"⚠️ Nadir Window — Day X of Cycle Y. Fever > 100.4°F = ER."_
- Files: `apps/web/src/app/(app)/dashboard/page.tsx` (add NadirBanner before MedicationReminders), `apps/web/src/app/api/profile/route.ts` or treatment cycle hook to expose `cycleDay` and `isNadir` to the client shell.
- Effect: Makes nadir awareness unavoidable on every app open — not just chat. 10× frequency of exposure.

**3. Family-wide nadir push on cycle day 7** — Effort: 1 day
- Currently nadir push goes only to the user. Extend `cron/radar/route.ts:398–407` to query `careTeamMembers` for the patient and send the nadir push to all of them (subject to their notification preferences).
- Files: `apps/web/src/app/api/cron/radar/route.ts` (extend nadir insight block to loop `careTeamMembers`), `apps/web/src/lib/push.ts` (already supports per-user send).
- Effect: Brings siblings, spouses, and remote family into the nadir moment without asking anyone to open the app. Organic acquisition — family member gets notified, downloads the app.

**4. One-tap ER Protocol Card** — Effort: 2 days
- When chat detects a fever or infection query during nadir (`system-prompt.ts` already knows this), surface a CTA: _"Generate ER Card."_ Produces a single printable/sharable page: patient name, cancer type, current regimen, cycle day, last ANC, and "NEUTROPENIC FEVER PROTOCOL" in 32px type.
- Files: new `apps/web/src/app/api/emergency-card/route.ts` (generate markdown → PDF via existing print styles), `apps/web/src/app/(app)/chat/page.tsx` (detect nadir + fever intent in AI response metadata, show CTA button).
- Effect: Transforms the AI's advice into a physical artifact a caregiver hands to an ER physician. Highest shareability of any feature — caregivers photograph it, text it, post it. This is the moment someone tells their friend about the app.

**5. End-of-nadir "How we did" summary** — Effort: 1.5 days
- On cycle day 15 (first day past nadir window), `cron/radar/route.ts` generates a short summary: pain range, fever occurrence (or absence), any ER visits logged, next cycle start date. Push to user + care team with one-tap share link (using existing share-link infra at `apps/web/src/app/api/share/route.ts`).
- Files: `apps/web/src/app/api/cron/radar/route.ts` (add day-15 trigger block), `apps/web/src/app/api/share/route.ts` (reuse existing weekly summary share).
- Effect: Closes the nadir loop with a shared artifact. Maya sends this to her siblings and the oncology nurse every cycle. Builds habit. Embeds the app into the care team's workflow — not just Maya's phone.

---

## Effort vs Impact Matrix

| Change | Effort | Frequency Gain | Potency Gain | Shareability Gain |
|--------|--------|----------------|--------------|-------------------|
| Chat greeting card | 0.5d | ★★★★ | ★★★ | ★★ |
| Dashboard nadir banner | 0.5d | ★★★★★ | ★★★ | ★★ |
| Family-wide push | 1d | ★★★ | ★★★★ | ★★★★★ |
| ER Protocol Card | 2d | ★★ | ★★★★★ | ★★★★★ |
| End-of-nadir summary | 1.5d | ★★★ | ★★★★ | ★★★★★ |

Ship order: dashboard banner → chat greeting card → family push → end-of-nadir summary → ER card.

---

## The 30-Day Bet

If the team shipped only these five nadir amplifications in the next 30 days, this is what changes: every user with an active treatment cycle would feel — on every app open during their most dangerous week — that the app knows exactly where they are in the journey. The ER Protocol Card would be the first screenshot that circulates in caregiver Facebook groups and cancer forums: _"look what this app generated at 11pm when I asked about my dad's fever."_ The family push brings an average of 1–2 new users per active patient (siblings, spouses) with zero paid acquisition. And the end-of-nadir summary embeds CareCompanion into the oncology nurse's workflow — which is the single fastest path to clinical credibility and word-of-mouth from providers. In 30 days: measurable increase in D7/D14 retention, at least one organic social share moment, and a referral loop that doesn't require a marketing budget.
