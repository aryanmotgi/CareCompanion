# Memory v2 Canary Promote Decision

**Generated:** 2026-05-19  
**Analyst:** Aryan (via automated session)  
**Branch:** `aryan/dev`

---

## Current State

| Property | Value |
|----------|-------|
| Current rollout | `ENABLE_MEMORY_HYBRID=10pct` (10% of users, deterministic by `sha256(userId) % 100 < 10`) |
| Canary gate logic | `apps/web/src/lib/memory/gate.ts` — supports `true` / `false` / `10pct` |
| Memory v2 merged | PR #48 — `2026-05-15 23:17 -0700` (commit `7128098`) |
| Canary monitor merged | PR #49 — `2026-05-15 23:55 -0700` (commit `0b84150`) |
| Monitor stabilized | PR #51 fix — `2026-05-16 01:20 -0700` (commit `b9bbf44`) — "always exit 0, let workflow signal abort" |
| Monitor stability age | ~3 days (b9bbf44 → today 2026-05-19) |
| Canary age from PR #48 | ~4 days (2026-05-15 → 2026-05-19) |
| Cron cadence | Every 6 hours (`0 */6 * * *`) → ≈8 runs since stabilization |
| Auto-promote threshold | 48 h after `ENABLE_MEMORY_HYBRID` set on Vercel (baked into `canary-monitor.ts:31`) |
| gh CLI status | **Unavailable** — not authenticated in this remote session |
| Last 5 cron conclusions | **Cannot retrieve** — gh CLI required; check GitHub Actions UI directly |

> **Note on auto-promote:** The canary monitor script promotes automatically at 48 h if no stop conditions fire. The 48-hour window elapsed ~2026-05-18 08:20 UTC. Whether the workflow actually promoted (or aborted during the 3-iteration stabilization window) **cannot be confirmed without Vercel API access or gh CLI.** Check `vercel env pull --environment=production` to confirm the current production value before acting on this document.

---

## Decision Criteria

| Criterion | Threshold | Actual | Pass/Fail |
|-----------|-----------|--------|-----------|
| Error rate increase vs baseline | < 0.1% | Unknown — no observability hooks visible; gh CLI unavailable; no APM data in audits | ⚠️ UNKNOWN |
| p95 latency vs baseline | ≤ +20% | Unknown — `PERF_BASELINE.md` is static bundle analysis only, no runtime latency data; gh run duration not a valid proxy | ⚠️ UNKNOWN |
| No regression alerts last 48 hr | 0 failures in `production-monitor.yml` last 48 hr | Unknown — gh CLI unavailable; retro flags "worth verifying no false auto-promotes fired" (W20 action item #3) | ⚠️ UNKNOWN |
| Canary running ≥ 5 days | ≥ 5 days from 2026-05-15 | **4 days** (PR #48 2026-05-15 → 2026-05-19); monitor stable only since 2026-05-16 (~3 days) | ❌ **FAIL** |
| No unfixed P0 bugs in canary path | Zero known runtime crashes | `findCosineDuplicate` missing `::uuid` cast in `memory-conflict.ts:60` — Aurora runtime crash on memory dedup (CODE_REVIEW_2026-05-18.md: CRITICAL, unresolved) | ❌ **FAIL** |

---

## Decision: HOLD

Two criteria are hard FAILs; three are unknowable from this environment. Do not promote.

---

## Confidence: Low

The `gh` CLI is unavailable and there are no observability hooks (no APM, no error-rate dashboard, no structured canary metrics) accessible from this session. The three UNKNOWN rows cannot be resolved without external tool access. The two FAIL rows are code-verifiable and definitive.

---

## If HOLD: What Data Is Needed Before Next Decision

Ordered by priority. Do all of these before re-evaluating:

1. **Fix the `::uuid` cast bug first (P0 — blocks safe promotion regardless of timeline).**
   - File: `apps/web/src/lib/memory/memory-conflict.ts:60`
   - Fix: add `::uuid` cast to the `findCosineDuplicate` query parameter.
   - Until this is fixed, 10% of users hitting the canary path get Aurora runtime crashes on memory dedup. Promoting to 100% would crash all users doing memory dedup.

2. **Verify the production `ENABLE_MEMORY_HYBRID` value hasn't already been auto-promoted.**
   - Run: `vercel env pull --environment=production /tmp/env && grep ENABLE_MEMORY_HYBRID /tmp/env`
   - The 48 h auto-promote threshold elapsed ~2026-05-18 08:20 UTC. If the monitor's stop conditions didn't fire, it may have already set the value to `true` and triggered a redeploy. If so, this decision is moot — monitor for errors and treat it as a 100% rollout.

3. **Check last 5 canary workflow run conclusions in GitHub Actions UI.**
   - URL: `https://github.com/aryanmotgi/carecompanion/actions/workflows/canary-monitor.yml`
   - Need: at minimum the 8 runs since b9bbf44 stabilized (2026-05-16 08:20 UTC). All should be `success` (heartbeat) or one `promoted`. Any `failure` (abort) = rollback investigation before promoting.

4. **Reach ≥ 5 full days from launch.** 
   - Re-evaluate no earlier than **2026-05-20** (5 days from PR #48 merge 2026-05-15). The monitor's own 48 h threshold is already met; the 5-day bar is a human safety gate for a healthcare app handling PHI.

5. **Resolve the 3 UNKNOWN criteria with real data before the 2026-05-20 check.**
   - Error rate: query `memory_access_log` error column or add CloudWatch metric on Aurora exceptions for the canary user cohort.
   - p95 latency: pull Vercel Analytics or Aurora slow query log for the 10% canary cohort vs. control.
   - Regression alerts: review `production-monitor.yml` run history (step 3 above).

6. **Validate no false promote fired during the 3-iteration stabilization window** (retro W20 action item #3).
   - Window: 2026-05-15 23:55 (#49) → 2026-05-16 01:20 (#51). Two buggy runs could have queried the wrong DB (missing `memory_access_log` rows) and triggered either a spurious abort issue or a premature heartbeat. Check GitHub Issues for any "Canary monitor: ABORT" issues opened that night.

---

## If PROMOTE: Exact Commands

> **Only run these after all HOLD conditions above are resolved.**

```bash
# 1. Confirm current value (should still be '10pct')
vercel env pull --environment=production /tmp/canary-env
grep ENABLE_MEMORY_HYBRID /tmp/canary-env

# 2. Remove existing env var and set to 'true'
vercel env rm ENABLE_MEMORY_HYBRID production -y
vercel env add ENABLE_MEMORY_HYBRID production --value true --no-sensitive

# 3. Trigger production redeploy from main
vercel --prod --archive=tgz --yes

# 4. Verify deployment health (allow 2–3 min for deploy to complete)
curl https://carecompanionai.org/api/health

# 5. Confirm env var propagated
vercel env pull --environment=production /tmp/post-promote && grep ENABLE_MEMORY_HYBRID /tmp/post-promote
# Expected: ENABLE_MEMORY_HYBRID="true"

# 6. Confirm memory audit rows growing (run twice, 5 min apart)
# Via psql against Aurora:
# SELECT COUNT(*), MAX(created_at) FROM memory_access_log;
```

**Monitoring window:** 4 hours post-promote. Watch for:
- `production-monitor.yml` failures (canary monitor will open a GH issue automatically if stop conditions fire post-promote)
- Aurora exception rate on `memory_access_log` inserts
- `user_usage.model_calls` not dropping (confirms hybrid path is being reached)

---

## Risk Notes

1. **Auto-promote may have already fired.** The `canary-monitor.ts` PROMOTE_AFTER_MS threshold (48 h) elapsed ~2026-05-18 08:20 UTC. If the cron ran clean at that point, production `ENABLE_MEMORY_HYBRID` may already be `'true'`. Verify before treating this as an actionable decision.

2. **P0 runtime bug in active canary path.** `findCosineDuplicate` missing `::uuid` cast (commit `16c37df` finding, `memory-conflict.ts:60`) crashes Aurora on memory dedup. This bug is live in production for the 10% canary cohort right now. Promote to 100% will crash all dedup operations for all users. Fix this before any promotion.

3. **3-iteration stabilization churn.** The canary monitor needed 3 commits over ~1.5 hours to stabilize. Bugs included querying the wrong database (so audit-loss heuristic was blind) and wrong exit codes (workflow status unreliable). We do not know whether any stop conditions were missed or any spurious promotes/aborts fired during that window.

4. **No PHI-safe observability.** The `canary-monitor.ts` reads aggregate counts (`COUNT(*)`) — not individual user data. This is correct. However, there are no per-cohort error rate or latency metrics available from this session. Any promotion decision made without those metrics carries unknown healthcare risk given the PHI sensitivity of the memory subsystem.

5. **Static IAM keys in older canary workflow.** `SECURITY_AUDIT.md` (HIGH) flagged that the canary workflow was using static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` secrets instead of OIDC. This was fixed in commit `54064b0` (`security(ci): migrate canary workflow to AWS OIDC`) on 2026-05-19. All runs since that commit use OIDC. Runs before it used static keys — no credential rotation action required unless those keys were exposed in logs.

6. **`::uuid` cast bug scope.** The crash is in dedup (`memory-conflict.ts`), not retrieval. The 10% canary cohort gets degraded dedup (duplicates accumulate) but retrieval itself (`retrieve.ts`) is not directly affected. This means the quality of memory retrieval for canary users may have drifted during the canary window, making any latency/quality baseline comparison vs. control less reliable.
