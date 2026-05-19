# Branch Cleanup Plan

**Generated:** 2026-05-19  
**Source audit:** `docs/audits/2026-05-18/BRANCH_HYGIENE.md`  
**Verification:** All "Safe to Delete" branches re-checked via `git branch -r --merged origin/main`.  
**Scope:** Plan only — no branches have been deleted.

---

## Safe to Delete

All five branches from the audit's "Merged Branches Safe to Delete" list were re-verified merged into `origin/main`. One (`shreyash/dev`) is a **protected branch** per team policy and is excluded — see [Protected](#protected) below. The remaining four are orphan worktree remnants with no unique commits.

| Branch | Last commit | Age | Verified merged? | Notes |
|---|---|---|---|---|
| `aryan/worktree1` | 2026-05-13 | 6 d | ✅ yes | Orphan worktree remnant (Claude Code session) |
| `aryan/worktree2` | 2026-05-13 | 6 d | ✅ yes | Orphan worktree remnant |
| `aryan/worktree3` | 2026-05-13 | 6 d | ✅ yes | Orphan worktree remnant |
| `aryan/worktree4` | 2026-05-13 | 6 d | ✅ yes | Orphan worktree remnant |

### Delete commands

```bash
git push --delete origin aryan/worktree1
git push --delete origin aryan/worktree2
git push --delete origin aryan/worktree3
git push --delete origin aryan/worktree4
```

---

## Needs Owner Triage

These branches are stale (33–45 days, no merge to `main`) and carry unique commits. Owners must decide: **merge, archive (tag), or delete**.

### Copilot bot branches — ping: @aryanmotgi

Six branches created by `copilot-swe-agent[bot]` for Playwright setup experiments. None merged. All 41–42 days old. Work appears superseded by `feat/testing-infrastructure`.

| Branch | Last commit date | Tip commit | Risk if deleted |
|---|---|---|---|
| `copilot/get-playwright-to-work` | 2026-04-07 | `fix: get Playwright working as autonomous 24/7 production bug-hunting agent` | Low — Playwright config experiments only |
| `copilot/fix-login-issue-in-smoke-test` | 2026-04-08 | `fix: add type="text" to chat input so E2E selector matches` | Low — single selector tweak |
| `copilot/run-playwright-smoke-test` | 2026-04-08 | `fix: wait for networkidle before URL check in AI chat monitor test` | Low — test timing fix |
| `copilot/set-main-branch-default` | 2026-04-08 | `chore: restrict CI/Playwright to main branch only` | Low — CI scope change |
| `copilot/verify-playwright-tester-functionality` | 2026-04-08 | `fix: skip authenticated e2e tests when E2E_TEST_EMAIL/PASSWORD are not set` | Low — env-guard fix |
| `copilot/verify-playwright-tester-functionality-again` | 2026-04-08 | `Add explicit Playwright monitor email recipient` | Low — email config |

**Recommendation:** @aryanmotgi confirm these can be deleted. If any Playwright fix should be preserved, cherry-pick the commit onto `aryan/dev` first, then delete.

Candidate delete commands (run only after Aryan confirms):

```bash
git push --delete origin copilot/get-playwright-to-work
git push --delete origin copilot/fix-login-issue-in-smoke-test
git push --delete origin copilot/run-playwright-smoke-test
git push --delete origin copilot/set-main-branch-default
git push --delete origin copilot/verify-playwright-tester-functionality
git push --delete origin copilot/verify-playwright-tester-functionality-again
```

---

### Aryan's stale feature branches — ping: @aryanmotgi

| Branch | Last commit date | Tip commit | Commits ahead of main | Risk if deleted |
|---|---|---|---|---|
| `1uphealth-integration-branch` | 2026-04-16 | `chore: remove Supabase, migrate oneup-sync to Drizzle/AWS` | ~240 | **High** — large DB migration work; unclear if carried forward on another branch |
| `feat/backend-ai-improvements` | 2026-04-04 | `feat: Google OAuth sign-in + 4-step onboarding wizard` | ~86 | **Medium** — significant auth/onboarding work; may be superseded by `feat/auth-onboarding-redesign` |
| `feat/onboarding-improvements` | 2026-04-06 | `fix: DashboardView lint fix` | ~96 | **Medium** — likely superseded by `feat/auth-onboarding-redesign` (24 d old, active) |
| `dev` | 2026-04-06 | `debug: temp endpoint to verify 1up env vars` | — | Low — old catch-all dev branch predating per-dev branches; tip is a debug endpoint |

**Recommendation:**
- `1uphealth-integration-branch`: Aryan to confirm whether the Drizzle/Aurora migration was carried forward. If yes, delete; if no, rebase onto `aryan/dev` and open a PR.
- `feat/backend-ai-improvements`: Compare against `feat/auth-onboarding-redesign`; cherry-pick anything not yet merged.
- `feat/onboarding-improvements`: Very likely superseded — verify, then delete.
- `dev`: Remove after confirming the debug endpoint is gone from `main`.

Candidate delete commands (run only after Aryan triages):

```bash
git push --delete origin 1uphealth-integration-branch
git push --delete origin feat/backend-ai-improvements
git push --delete origin feat/onboarding-improvements
git push --delete origin dev
```

---

### DrealVeerNanda's branches — ping: @DrealVeerNanda

| Branch | Last commit date | Tip commit | Risk if deleted |
|---|---|---|---|
| `backup/pre-db-migration` | 2026-04-15 | `feat: futuristic bottom tabs, drawer menu, and chat UI overhaul` | Low — safety snapshot; if DB migration is live and stable, the snapshot has served its purpose. Tag before deleting. |
| `feat/mobile-first-redesign` | 2026-04-10 | `fix: encrypt OAuth tokens at rest and harden 1upHealth security` | **Medium** — unclear if superseded by Shreyash's mobile work; security fix in tip commit should be audited against `main` |

**Recommendation:**
- `backup/pre-db-migration`: Tag the branch tip, then delete:
  ```bash
  git tag backup/pre-db-migration-snapshot origin/backup/pre-db-migration
  git push origin backup/pre-db-migration-snapshot
  git push --delete origin backup/pre-db-migration
  ```
- `feat/mobile-first-redesign`: Ping DrealVeerNanda and Shreyash jointly — the security fix in the tip commit (`encrypt OAuth tokens at rest`) must be verified present in `main` before this branch is deleted.

---

## Protected

The following branches are excluded from all cleanup actions regardless of merge status.

| Branch | Reason |
|---|---|
| `main` | Default branch |
| `aryan/dev` | Aryan's active integration branch |
| `rahil/dev` | Rahil's active dev branch |
| `shreyash/dev` | Shreyash's dev branch (protected by team policy; also verified merged into `main` — delete is safe if Shreyash confirms it's no longer needed) |

### Today's aryan/feature/* branches (excluded — recent work)

The following `aryan/feature/*` branches have last-commit dates of **2026-05-19** and are excluded from all cleanup considerations:

| Branch | Last commit |
|---|---|
| `aryan/feature/a11y-p1-fixes` | 2026-05-19 |
| `aryan/feature/aws-oidc-canary` | 2026-05-19 |
| `aryan/feature/ios-app-store-blockers` | 2026-05-19 |
| `aryan/feature/p0-security-bundle` | 2026-05-19 |
| `aryan/feature/ts-strictness` | 2026-05-19 |

---

## How to Execute

### One-shot script — Safe-to-Delete worktrees only (no confirmation needed)

These four are verified merged and have no unique commits. Paste and run:

```bash
#!/usr/bin/env bash
set -euo pipefail

SAFE_BRANCHES=(
  aryan/worktree1
  aryan/worktree2
  aryan/worktree3
  aryan/worktree4
)

for branch in "${SAFE_BRANCHES[@]}"; do
  echo "Deleting origin/$branch ..."
  git push --delete origin "$branch"
done

echo "Done. Verify with: git branch -r | grep worktree"
```

### One-shot script — After owner triage (requires explicit confirmation)

Only run after each owner listed above has replied with a thumbs-up on the PR. Replace the arrays as needed:

```bash
#!/usr/bin/env bash
set -euo pipefail

# After Aryan confirms: copilot bot branches
COPILOT_BRANCHES=(
  copilot/get-playwright-to-work
  copilot/fix-login-issue-in-smoke-test
  copilot/run-playwright-smoke-test
  copilot/set-main-branch-default
  copilot/verify-playwright-tester-functionality
  copilot/verify-playwright-tester-functionality-again
)

# After Aryan confirms: old feature branches
ARYAN_STALE=(
  feat/onboarding-improvements
  dev
  # Add feat/backend-ai-improvements and 1uphealth-integration-branch
  # only after verifying their work is carried forward on another branch
)

# After DrealVeerNanda confirms: snapshot branch (tag it first!)
# git tag backup/pre-db-migration-snapshot origin/backup/pre-db-migration
# git push origin backup/pre-db-migration-snapshot
# DREALVEER_BRANCHES=(backup/pre-db-migration feat/mobile-first-redesign)

for branch in "${COPILOT_BRANCHES[@]}" "${ARYAN_STALE[@]}"; do
  echo "Deleting origin/$branch ..."
  git push --delete origin "$branch"
done

echo "Done."
```

### Checklist

- [ ] `aryan/worktree1` deleted (merged, no review needed)
- [ ] `aryan/worktree2` deleted (merged, no review needed)
- [ ] `aryan/worktree3` deleted (merged, no review needed)
- [ ] `aryan/worktree4` deleted (merged, no review needed)
- [ ] @aryanmotgi reviewed 6 copilot branches → deleted or cherry-picks landed
- [ ] @aryanmotgi reviewed `1uphealth-integration-branch` → confirmed forward or PRed
- [ ] @aryanmotgi reviewed `feat/backend-ai-improvements` → compare vs `feat/auth-onboarding-redesign`
- [ ] @aryanmotgi reviewed `feat/onboarding-improvements` → deleted
- [ ] @aryanmotgi reviewed `dev` → deleted (debug endpoint confirmed absent from main)
- [ ] @DrealVeerNanda reviewed `backup/pre-db-migration` → tagged + deleted
- [ ] @DrealVeerNanda + @Shreyash reviewed `feat/mobile-first-redesign` → security fix audited, branch deleted
