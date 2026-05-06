<!-- ccsquad:start mode=silent -->
On session start: call list_instances and read_messages.
Never offer to broadcast. Only broadcast if user explicitly asks.
Always answer squad questions (read_messages, answer).
<!-- ccsquad:end -->

## Routing
Match request to skill and invoke it FIRST. Never answer directly.

- Product ideas / brainstorming → office-hours
- Bugs / errors / 500s → investigate
- Ship / deploy / PR → ship
- QA / find bugs → qa
- Code review → review
- Docs after ship → document-release
- Weekly retro → retro
- Design system / brand → design-consultation
- Visual audit / polish → design-review
- Architecture review → plan-eng-review
- Save progress → context-save
- Resume context → context-restore
- Code health → health

## Health
- typecheck: npm run typecheck
- lint: npm run lint
- test: npm run test:run
- deadcode: npm run deadcode

## Team Rules

### Commits
1. Use Conventional Commits format `type: description`. Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `security`, `build`, `ci`. Examples:
   - `feat: add medication reminder`
   - `fix: chat streaming bug`
   - `chore: update dependencies`
   - `security: rotate AWS keys`

### Ownership
2. File ownership — never modify another owner's core files without asking:
   - **Aryan** — `apps/web/src/lib/`, AI architecture, `.claude/` infra, AWS/Cognito/Aurora wiring
   - **Shreyash** — `apps/mobile/`
   - **Rahil** — onboarding flows, `apps/web/src/lib/fhir.ts`
   - Shared (`packages/types`, `packages/utils`, `apps/web/src/components/ui`) → ping owner of consumer before breaking changes.

### Pre-push
3. Run before every push:
   ```bash
   npm run typecheck && npm run lint && npm run test:run && npm run deadcode
   ```
   All four must pass. Fix, don't skip.

### Branch hygiene
4. **No direct push to `main`.** All changes go through a PR.
   - **Aryan** (web lead / AI architect) — may self-merge own PRs into `main` without review.
   - **Shreyash, Rahil** — PR + 1 review required before merging into `main`. Aryan is default reviewer; route to the relevant owner if the change touches their files.
   - Use `aryan/dev`, `shreyash/dev`, `rahil/dev` (or sub-branches `aryan/feature/*`). Squash-merge into main.
5. **Rebase dev branch onto `origin/main` daily**: `git fetch && git rebase origin/main`. Keeps dev branches close to main, shrinks conflicts.
6. **Squash-merge PRs into main.** One commit per feature. Clean `git log main`.

### Health-domain rules
7. **No PHI in logs.** Never `console.log` patient names, DOBs, diagnoses, medications, MRNs, addresses, phone numbers. Use the structured logger and the redaction helper. Applies to client and server.
8. **Aurora schema changes** require:
   - Migration SQL committed under `apps/web/src/lib/db/migrations/`
   - `schema.ts` updated to match
   - `/api/health` schema check passing on preview deploy before merging the PR

### Security
9. **AWS credentials**: SSO / IAM role only. Never hardcode, never commit. Run `git-secrets --scan` (or gitleaks) before push if touching anything credential-adjacent. Rotate immediately if leaked.

### Stack conventions
10. **Next.js App Router, Server Components by default.** Add `'use client'` only when interactivity (state, effects, browser APIs) is required.
11. **Next 16**: use `proxy.ts` instead of `middleware.ts`. Do not introduce `@vercel/postgres` or `@vercel/kv` (sunset).
12. **Shared packages** (`packages/types`, `packages/utils`, `packages/api`) — coordinate cross-package changes across all three devs. Run `npm run typecheck` at repo root after editing shared packages.
