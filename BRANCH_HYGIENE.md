# Branch Hygiene Audit

**Audit date:** 2026-05-19  
**Repository:** aryanmotgi/carecompanion  
**Audited by:** Claude Code (aryan/dev session)

---

## Summary

| Metric | Count |
|---|---|
| Total remote branches | 32 |
| Active (0–7 days) | 11 |
| Recent (8–30 days) | 8 |
| Stale (31–90 days) | 12 |
| Abandoned (90+ days) | 0 |
| **Merged into main — safe to delete** | **5** |

### All branches by category

#### Active (0–7 days)

| Branch | Last commit | Age | Author | Merged into main? |
|---|---|---|---|---|
| `aryan/dev` | 2026-05-19 | 0 d | Claude | No |
| `aryan/feature/mobile-symptom-journal` | 2026-05-18 | 1 d | Claude | No |
| `aryan/feature/mobile-symptom-radar` | 2026-05-18 | 1 d | Claude | No |
| `merge/all-devs` | 2026-05-16 | 3 d | Aryan Motgi | No |
| `shreyash/feature/healthkit-integration` | 2026-05-16 | 3 d | Shreyash Somani | No |
| `shreyash/feature/dashboard-fixes` | 2026-05-14 | 5 d | Shreyash Somani | No |
| `aryan/worktree1` | 2026-05-13 | 6 d | Aryan Motgi | **Yes** |
| `aryan/worktree2` | 2026-05-13 | 6 d | Aryan Motgi | **Yes** |
| `aryan/worktree3` | 2026-05-13 | 6 d | Aryan Motgi | **Yes** |
| `aryan/worktree4` | 2026-05-13 | 6 d | Aryan Motgi | **Yes** |
| `rahil/dev` | 2026-05-13 | 6 d | kanugarahil-tech | No |

#### Recent (8–30 days)

| Branch | Last commit | Age | Author | Merged into main? |
|---|---|---|---|---|
| `aryan/share-link-fixes` | 2026-05-09 | 10 d | Aryan Motgi | No |
| `hotfix/missing-files-ci-fix` | 2026-05-03 | 16 d | Aryan Motgi | No |
| `preview/trials-impeccable` | 2026-05-03 | 16 d | Aryan Motgi | No |
| `shreyash/dev` | 2026-05-04 | 15 d | Aryan Motgi | **Yes** |
| `feat/community-carehub-e2e` | 2026-04-26 | 23 d | Aryan Motgi | No |
| `feat/mobile-parity` | 2026-04-26 | 23 d | Aryan Motgi | No |
| `feat/auth-onboarding-redesign` | 2026-04-25 | 24 d | Aryan Motgi | No |
| `feat/testing-infrastructure` | 2026-04-23 | 26 d | Aryan Motgi | No |

#### Stale (31–90 days)

| Branch | Last commit | Age | Author | Merged into main? |
|---|---|---|---|---|
| `1uphealth-integration-branch` | 2026-04-16 | 33 d | Aryan Motgi | No |
| `backup/pre-db-migration` | 2026-04-15 | 34 d | DrealVeerNanda | No |
| `feat/mobile-first-redesign` | 2026-04-10 | 39 d | DrealVeerNanda | No |
| `copilot/fix-login-issue-in-smoke-test` | 2026-04-08 | 41 d | copilot-swe-agent[bot] | No |
| `copilot/run-playwright-smoke-test` | 2026-04-08 | 41 d | copilot-swe-agent[bot] | No |
| `copilot/set-main-branch-default` | 2026-04-08 | 41 d | copilot-swe-agent[bot] | No |
| `copilot/verify-playwright-tester-functionality` | 2026-04-08 | 41 d | copilot-swe-agent[bot] | No |
| `copilot/verify-playwright-tester-functionality-again` | 2026-04-08 | 41 d | copilot-swe-agent[bot] | No |
| `copilot/get-playwright-to-work` | 2026-04-07 | 42 d | copilot-swe-agent[bot] | No |
| `feat/backend-ai-improvements` | 2026-04-04 | 45 d | Aryan Motgi | No |
| `dev` | 2026-04-06 | 43 d | Aryan Motgi | No |
| `feat/onboarding-improvements` | 2026-04-06 | 43 d | Aryan Motgi | No |

#### Abandoned (90+ days)

None.

---

## Merged Branches Safe to Delete

These branches are fully merged into `main` and carry no unique unmerged commits.

| Branch | Last commit | Age | Notes |
|---|---|---|---|
| `aryan/worktree1` | 2026-05-13 | 6 d | Orphan worktree remnant |
| `aryan/worktree2` | 2026-05-13 | 6 d | Orphan worktree remnant |
| `aryan/worktree3` | 2026-05-13 | 6 d | Orphan worktree remnant |
| `aryan/worktree4` | 2026-05-13 | 6 d | Orphan worktree remnant |
| `shreyash/dev` | 2026-05-04 | 15 d | Merged; Aryan was last committer |

---

## Abandoned Branches Needing Owner Triage

These branches are stale (31–90 days old) and have **not** been merged into `main`. Each has unique commits. Owners should decide: merge, archive, or delete.

### Copilot bot branches (6) — owner: Aryan
All six were created by `copilot-swe-agent[bot]` for Playwright setup tasks. None merged. All 41–42 days old. These appear to be dead experiments.

| Branch | Age | Unique commits ahead of aryan/dev |
|---|---|---|
| `copilot/get-playwright-to-work` | 42 d | — |
| `copilot/fix-login-issue-in-smoke-test` | 41 d | — |
| `copilot/run-playwright-smoke-test` | 41 d | — |
| `copilot/set-main-branch-default` | 41 d | — |
| `copilot/verify-playwright-tester-functionality` | 41 d | — |
| `copilot/verify-playwright-tester-functionality-again` | 41 d | — |

**Recommendation:** Aryan to confirm these can be deleted — the Playwright work appears to have been superseded by `feat/testing-infrastructure`.

### Feature branches — owner: Aryan

| Branch | Age | Commits ahead of aryan/dev | Notes |
|---|---|---|---|
| `1uphealth-integration-branch` | 33 d | 240 | Large divergence; integration work status unknown |
| `feat/backend-ai-improvements` | 45 d | 86 | Significant work; never merged |
| `feat/onboarding-improvements` | 43 d | 96 | Likely superseded by `feat/auth-onboarding-redesign` |
| `dev` | 43 d | — | Old catch-all dev branch; predates per-dev branches |

**Recommendation:** Aryan to assess whether `1uphealth-integration-branch` and `feat/backend-ai-improvements` have been superseded or are being carried forward on another branch.

### Feature branches — owner: DrealVeerNanda (third dev)

| Branch | Age | Notes |
|---|---|---|
| `backup/pre-db-migration` | 34 d | Safety snapshot before DB migration; can be tagged and deleted |
| `feat/mobile-first-redesign` | 39 d | Mobile redesign work; unclear if superseded by Shreyash mobile work |

**Recommendation:** Ping DrealVeerNanda — if `backup/pre-db-migration` served its purpose, tag it (`git tag backup/pre-db-migration <sha>`) then delete the branch. Clarify `feat/mobile-first-redesign` ownership.

---

## Orphan Worktree Branches

`aryan/worktree1` through `aryan/worktree4` are remnants of parallel Claude Code worktree sessions. All four are **merged into main** (confirmed via `git branch -r --merged origin/main`). They carry no unmerged work and should be cleaned up as part of routine worktree hygiene.

Age at audit: 6 days. Included in "Merged Branches Safe to Delete" above.

---

## Active Feature Branches in Progress

Branches with unmerged commits that are actively being developed.

### Aryan's branches

| Branch | Age | Commits ahead of aryan/dev | Commits behind aryan/dev | Status |
|---|---|---|---|---|
| `aryan/dev` | 0 d | — | — | Integration branch |
| `aryan/feature/mobile-symptom-journal` | 1 d | 1 | 24 | New; needs rebase onto aryan/dev |
| `aryan/feature/mobile-symptom-radar` | 1 d | 1 | 24 | New; needs rebase onto aryan/dev |
| `aryan/share-link-fixes` | 10 d | 2 | 118 | Bug fix; far behind aryan/dev — rebase recommended |
| `merge/all-devs` | 3 d | 13 | 25 | Active integration merge |
| `hotfix/missing-files-ci-fix` | 16 d | 822 | 145 | Very large divergence; likely a prior main-equivalent snapshot |
| `preview/trials-impeccable` | 16 d | 820 | 145 | Very large divergence; likely a preview/deploy snapshot |
| `feat/community-carehub-e2e` | 23 d | 661 | 145 | Large feature in progress |
| `feat/mobile-parity` | 23 d | 660 | 145 | Large feature in progress |
| `feat/auth-onboarding-redesign` | 24 d | 654 | 145 | Large feature in progress |
| `feat/testing-infrastructure` | 26 d | 499 | 145 | Testing work in progress |

> **Note on large "ahead" counts:** `hotfix/missing-files-ci-fix`, `preview/trials-impeccable`, `feat/community-carehub-e2e`, `feat/mobile-parity`, `feat/auth-onboarding-redesign`, and `feat/testing-infrastructure` are all 660–822 commits ahead of `aryan/dev`. This suggests these branches diverged from a much earlier `main` and accumulated the entire commit history of main since then. They are likely candidates for squash-rebase rather than standard merge.

### Rahil's branches

| Branch | Age | Commits ahead of aryan/dev | Commits behind aryan/dev | Status |
|---|---|---|---|---|
| `rahil/dev` | 6 d | 4 | 34 | Active; 34 commits behind aryan/dev — daily rebase recommended |

### Shreyash's branches

| Branch | Age | Commits ahead of aryan/dev | Commits behind aryan/dev | Status |
|---|---|---|---|---|
| `shreyash/feature/healthkit-integration` | 3 d | 12 | 27 | Active mobile feature |
| `shreyash/feature/dashboard-fixes` | 5 d | 2 | 33 | Active; 33 commits behind aryan/dev — rebase recommended |

---

## Recommended Cleanup Commands

**Run these manually — do NOT execute automatically.**

```bash
# Delete merged worktree orphan branches
git push origin --delete aryan/worktree1
git push origin --delete aryan/worktree2
git push origin --delete aryan/worktree3
git push origin --delete aryan/worktree4

# Delete merged shreyash/dev
git push origin --delete shreyash/dev

# After Aryan confirms copilot branches are dead:
git push origin --delete copilot/get-playwright-to-work
git push origin --delete copilot/fix-login-issue-in-smoke-test
git push origin --delete copilot/run-playwright-smoke-test
git push origin --delete copilot/set-main-branch-default
git push origin --delete copilot/verify-playwright-tester-functionality
git push origin --delete copilot/verify-playwright-tester-functionality-again

# After DrealVeerNanda confirms backup branch is safe to drop
# (tag it first):
git tag backup/pre-db-migration-snapshot origin/backup/pre-db-migration
git push origin backup/pre-db-migration-snapshot
git push origin --delete backup/pre-db-migration

# After Aryan triages old dev branch:
git push origin --delete dev

# Rebase stale feature branches onto aryan/dev (run on the branch owner's machine)
git fetch origin
git checkout aryan/share-link-fixes
git rebase origin/aryan/dev
git push origin aryan/share-link-fixes --force-with-lease
```
