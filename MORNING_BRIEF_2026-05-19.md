# Morning Brief — 2026-05-19

## TL;DR
- Shipped 14 commits overnight: 10 strategic/tactical docs + 12 live HIPAA PHI redactions; all health checks green across aryan/dev and all 7 feature branches.
- The product's biggest strategic mistake: the most defensible, life-saving feature (clinical trial matching) is free, buried, and given away — it should be the $9.99/mo paywall anchor.
- Biggest blocker: a P0 bug in `memory-conflict.ts:60` (missing `::uuid` cast) is crashing Aurora memory dedup for 10% of canary users in production right now.

---

## What's Done Overnight

| Category | What | Outcome | File |
|---|---|---|---|
| Strategic | First-principles product audit (Maya persona) | 3 cuts identified + paywall move | THE_ONE_THING.md |
| Strategic | Pre-mortem: 5 failure modes ranked | Feature sprawl is #1 kill risk (L5×I4=20) | PREMORTEM.md |
| Strategic | Delete candidates: 8 groups | ~4,300 lines safe to cut; `apps/video/` is #1 (2,519 lines, zero imports) | DELETE_CANDIDATES.md |
| Strategic | Magic moment analysis | Nadir awareness is the moat; 5 amplifications mapped, ship order given | MAGIC_MOMENT.md |
| Strategic | Architecture bets review | Stack is right; Cognito ghost + dual-DB drift are the two live risks | ARCH_BETS.md |
| Strategic | Journey leak map | L1 (journal save no-op) + L2 (voice check-in fakes success) are live trust destroyers | JOURNEY_LEAKS.md |
| Tactical | Phase 2 verification | 4/4 health checks pass; all 7 feature branches pass typecheck+lint | VERIFY_PHASE2.md |
| Tactical | Memory v2 canary decision | HOLD — 2 hard fails; P0 bug live in 10% cohort | CANARY_DECISION.md |
| Tactical | HIPAA Round-2 autofix | 12 new sites fixed (18 cumulative); 2 items flagged for human triage | HIPAA_AUTOFIX_ROUND2.md |
| Housekeeping | Branch cleanup plan | 4 worktrees safe to delete now; 10+ branches need owner triage | CLEANUP_BRANCHES.md |

---

## The Big Strategic Finding

CareCompanion built the right moat and then buried it. No other consumer app tells a caregiver "your dad is in nadir tonight — fever over 100.4°F is an ER call." MyChart shows ANC as a raw number. Epic shows the appointment time. CareCompanion explains what it means at 11pm when the patient feels bad. That is the product.

The parallel mistake: clinical trial matching — the codebase's most expensive infrastructure (300s `maxDuration`, dedicated cron, mutation biomarker schema) — is free, rate-limited at 3 searches/hour, and buried in a tab. Meanwhile the Community feature competes against Reddit and Facebook Groups it will never beat, and two separate symptom-tracking surfaces (journal + daily check-in) split the one habit the app needs to own.

The PREMORTEM's #1 failure mode (feature sprawl, L5×I4=20) is the most likely reason CareCompanion fails: users open to 8 tiles, nothing is 10× better than a Google Doc, and they delete the app on day 4. The fix is subtraction. Kill community, fold journal into check-in, put trial matching behind a paywall. This is a founder-level call — but the evidence across every overnight doc points the same direction.

---

## Decisions You Need to Make Today

1. **Memory v2 canary — HOLD.** Fix the `::uuid` cast first (5 min), verify GitHub Actions history clean (8 runs since b9bbf44), then re-evaluate no earlier than 2026-05-20 (5-day safety gate for a PHI system). My rec: fix today, promote tomorrow if Actions show clean.

2. **P0 PR merge order.** My rec: `p0-security-bundle` first (security scope — worth 10 min of your own review before self-merging), then `aws-oidc-canary` (confirm OIDC IAM role provisioned in AWS console first), then `mobile-symptom-journal` (directly fixes the L1 critical journal no-op), then the rest.

3. **Paywall trial matching?** My rec: yes. $9.99/mo, unlimited searches + push alerts on new matches, "2 new trial matches" as the home-screen anchor. This is the monetization move most supported by the architecture that already exists.

4. **Cut community?** My rec: flag it off today (`NEXT_PUBLIC_COMMUNITY_ENABLED=false`), redirect `/community` to `/chat`. Don't delete the code yet — the in-app care-team threading (schema already has `careTeamMembers` + `careTeamActivity`) is the right replacement, build it before you announce the cut.

5. **Choose one DB driver.** My rec: commit to Aurora RDS Data API — HIPAA BAA is already there, Drizzle+pgvector layer is invested. Retire `supabase/migrations/` in Q3. Decide direction today so both migration trees stop diverging.

---

## If You Only Do ONE Thing Today

**Fix `apps/web/src/lib/memory/memory-conflict.ts:60` — add `::uuid` to the `findCosineDuplicate` query. It's a one-line change that stops Aurora crashes for 10% of your users right now.**

Every other action today is lower-leverage or blocked by this bug. The canary cannot safely promote until it's fixed. The code review flagged it CRITICAL. The fix: `WHERE user_id = ${userId}` → `WHERE user_id = ${userId}::uuid`. Five minutes of work.

Effort: **S** | Impact: **high** | First step: open `apps/web/src/lib/memory/memory-conflict.ts`, go to line 60, add `::uuid`, push to `aryan/feature/p0-security-bundle`.

---

## What Failed

**FAILURE_phi_round2 + FAILURE_a11y_round2** — Both overnight agent tasks stopped because audit files were expected at the repo root but lived in `docs/audits/2026-05-18/`. Root cause: hardcoded paths in task prompts. HIPAA round-2 was retried and succeeded (12 sites fixed). A11Y round-2 has a branch (`aryan/feature/a11y-final-pass`) but the pass itself is unconfirmed — review that branch before merging.

---

## Open PRs Awaiting Your Review

| Branch | What | Action needed |
|---|---|---|
| `aryan/feature/p0-security-bundle` | Security fixes (OIDC, budget TOCTOU, model IDs, journal fix) | Aryan review + self-merge |
| `aryan/feature/aws-oidc-canary` | Migrate canary workflow from static AWS keys to OIDC | Confirm IAM OIDC role provisioned in AWS first |
| `aryan/feature/a11y-p1-fixes` | A11Y round-1 fixes | Aryan self-merge |
| `aryan/feature/mobile-symptom-journal` | Wire journal save to API (fixes L1 critical) | Aryan self-merge — high priority |
| `aryan/feature/mobile-symptom-radar` | Symptom radar chart skeletons (fixes L5) | Aryan self-merge |
| `aryan/feature/bundle-perf-fixes` | Bundle size optimizations | Defer if capacity-constrained |
| `aryan/feature/ts-strictness` | TypeScript strict mode pass | Defer if capacity-constrained |
| `aryan/feature/a11y-final-pass` | A11Y round-2 (unverified — check branch) | Verify before merging |
