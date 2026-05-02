fx# CareCompanion TODO

Generated from: /plan-eng-review + /design-review + /qa  
Branch: preview/trials-impeccable  
Date: 2026-05-02

---

## P0 — Critical (breaks core user flow or clinical integrity)

- [x] **[QA] Silent fetch swallow on trials mount** — `TrialsTab.tsx:112` — `.catch(() => {})` on both `/api/trials/matches` and `/api/trials/saved` fetch errors. User sees empty tab with no error and no retry. Fix: catch, set error state, render error banner with retry button.

- [x] **[QA] `isCloseTrial` override misclassifies high-scoring matched trials** — `clinicalTrialsAgent.ts:109` — Claude scores a trial 95/100 as `'matched'` but `isCloseTrial` downgrade fires if any gap exists, reclassifying it to `'close'`. Fix: only apply `isCloseTrial` as fallback when `rawCat` is neither `'matched'` nor `'close'`, not on all matched results.

- [x] **[QA] Concurrent `runLive` race condition** — `TrialsTab.tsx:116-132` — `ProfileDataPrompt.onSaved` calls `void runLive()` while button-click can trigger a second concurrent POST. Two calls race; second overwrites state non-deterministically. Fix: add `useRef` guard or check `liveRunning` before entering `runLive`.

- [x] **[DESIGN] TrialMatchCard is a light-mode component in a dark app** — `TrialMatchCard.tsx:27-129` — All color tokens (`bg-white`, `text-gray-500`, `bg-green-100`, `bg-blue-600`, `border-gray-300`) are wrong for the dark design system. Every matched trial card renders broken. Fix: rewrite using `bg-[var(--bg-card)]`, `text-[var(--text)]`, Trust Indigo CTAs, and design system semantic colors throughout.

---

## P1 — High (degrades UX, misleads user, or violates design principles)

- [x] **[QA] `hasSearched` not set on `runLive` failure** — `TrialsTab.tsx:309-327` — After a failed live search (`liveError` set), `hasSearched` stays `false`. Empty state reads "Click Find trials now to search" directly below the error banner. Contradictory. Fix: set `hasSearched = true` in the catch block.

- [x] **[QA] Stale threshold 90 days is clinically misleading** — `matches/route.ts:20` — Trial enrollment status changes frequently; an 89-day-old result shows as fresh. Fix: lower to 30 days or show "last checked" label on every result regardless of stale flag.

- [x] **[QA] New user "All clear!" identical to onboarded user with no alerts** — `DashboardView.tsx:437-444` — New user with 0 data sees same green checkmark and "All clear!" as an onboarded user with nothing urgent. Fix: gate "All clear" on `onboardingComplete && (medications.length > 0 || appointments.length > 0)`. Show "Get started" heading for new users.

- [x] **[QA] `searchByEligibility` is a duplicate search** — `clinicalTrialsAgent.ts:38-39` — Function passes `age` but `tools.ts` ignores it; calls same CT.gov endpoint as broad search. Deduplication on line 51 collapses any benefit. Fix: pass age/sex as `query.term` to CT.gov or remove the duplicate call and use one search with `pageSize: 40`.

- [x] **[DESIGN] Hero metric grid in Analytics tab** — `AnalyticsDashboard.tsx:96-111` — Three identical centered stat cards with `text-2xl font-bold` numbers over `text-[10px] uppercase` labels — textbook AI slop hero metric template. Fix: remove grid; fold adherence rate inline into the adherence section below it.

- [x] **[DESIGN] Gradient CTAs throughout** — `DashboardView.tsx:183`, `DashboardView.tsx:595-617`, `TrialsTab.tsx:245` — `bg-gradient-to-r from-[#6366F1] to-[#A78BFA]` used on multiple buttons. DESIGN.md prohibits gradient fills outside primary button. Fix: replace all with solid `bg-[#6366F1] hover:bg-[#4F46E5]`.

- [x] **[DESIGN] Celebratory/gamified microcopy** — `DashboardView.tsx:419`, `ProfileCompleteness.tsx:309` — "Looking good!" on empty dashboard, "Profile complete!" with exclamation. Wrong emotional register for cancer caregivers. Fix: `"[name]'s care is up to date."` / `"Profile complete"` (no exclamation).

- [x] **[DESIGN] All symptom pills styled as alerts** — `AnalyticsDashboard.tsx:182` — `bg-red-500/10 text-red-400` applied to every reported symptom regardless of severity. Fatigue appears as alarming as a critical lab. Fix: use neutral `bg-white/[0.06] text-[var(--text-secondary)]`; reserve red for clinically flagged symptoms only.

- [x] **[ENG] weeklyUpdate error buried below fold** — `DashboardView.tsx:636-638` — Error state renders as small muted text after all action cards. No retry affordance. Fix: show error inline where the card would appear, with a retry button.

---

## P2 — Medium (polish, accessibility, consistency)

- [x] **[QA] `trialUrl` empty string instead of null** — `clinicalTrialsAgent.ts:123` — `String(t.url ?? '')` writes `""` to DB when LLM omits url; TrialMatchCard renders a broken empty anchor. Fix: `t.url ? String(t.url) : null`.

- [x] **[QA] Trials mount fetch has no timeout** — `TrialsTab.tsx:89-113` — If either fetch never resolves (network hang), spinner shows indefinitely. Fix: add `AbortController` with 10s timeout.

- [x] **[DESIGN] `text-[10px]` throughout** — `AnalyticsDashboard.tsx:99,103,109`, `PriorityCard.tsx:77` — Below WCAG AA minimum for body text. Fix: bump all to `text-xs` (12px) minimum.

- [x] **[DESIGN] Hardcoded hex instead of CSS vars** — `DashboardView.tsx:450,540`, `TrialsTab.tsx:166,245` — `text-[#64748b]`, gradient inline styles bypass the design token system. Fix: replace with `text-[var(--text-muted)]` and `bg-[#6366F1]` Tailwind classes.

- [x] **[DESIGN] Emoji in clinical data** — `TrialMatchCard.tsx:101` — `📍` for location is inaccessible and tone-inappropriate. Fix: SVG pin icon with `aria-hidden="true"` + visible text.

- [x] **[DESIGN] Trials loading overlay uses off-token background** — `TrialsTab.tsx:166` — `linear-gradient(135deg, #0a0814 0%, #110d24 100%)` diverges from design token `#0C0E1A`. Fix: `bg-[#0C0E1A]`.

- [x] **[ENG] Lab trend direction has no direction-semantics field** — `AnalyticsDashboard.tsx:215-219` — `↑`/`↓` are now neutral (fixed this session) but there's no `directionIsGood` field on `LabResult` type. Future dev could re-introduce red/green. Fix: add `directionIsGood: boolean | null` to `LabResult` schema and Aurora table.

- [x] **[DESIGN] `"Profile complete"` exclamation and `"Your care team has everything they need."` copy** — `ProfileCompleteness.tsx:309` — Remove exclamation. Keep supporting copy.

---

## Already fixed this session (do not re-open)

- ~~Dashboard layout contract: action cards first, secondary surfaces below fold~~
- ~~Lab trend direction: neutral ↑↓ arrows instead of red/green~~
- ~~ProfileCompleteness: +11% gamification badges removed~~
- ~~PriorityCard: expand affordance chevron + "Action steps" label added~~
- ~~weeklyUpdate fetch: error state added (basic)~~
- ~~"AI ASSISTANT" label → "ASK ANYTHING"~~
- ~~CT.gov query: strips (TEST) suffix from cancerType~~
- ~~System prompt: strips (TEST) from cancer type shown to Claude~~
- ~~Phase field: added to Claude scoring output spec~~
- ~~LoginForm: window.location.href instead of router.push after signIn~~
- ~~AnalyticsDashboard: unused `changeStr` variable removed (ESLint)~~
