# CareCompanion Docs

| Document | What it covers |
|----------|---------------|
| [CareCompanion-Complete-Documentation.md](./CareCompanion-Complete-Documentation.md) | Full product and technical overview |
| [CareCompanion-Rundown.md](./CareCompanion-Rundown.md) | Quick team rundown |
| [authentication.md](./authentication.md) | Cognito / auth flow |
| [design-system.md](./design-system.md) | Component library and tokens |
| [engineering-conventions.md](./engineering-conventions.md) | Commit format, ownership, branch hygiene |
| [hipaa-migration.md](./hipaa-migration.md) | HIPAA-aligned DB migration guide |
| [qa-checklist.md](./qa-checklist.md) | Pre-release QA checklist |
| [testing-guide-for-partners.md](./testing-guide-for-partners.md) | Partner / integration testing |
| [e2e-monitor-debugging.md](./e2e-monitor-debugging.md) | E2E self-healing monitor debugging |
| [self-healing-monitor-overview.md](./self-healing-monitor-overview.md) | Self-healing monitor architecture |
| [ONEUP_SUBMISSION.md](./ONEUP_SUBMISSION.md) | OneUp Health submission notes |

## Memory v2

Four-document set covering the pgvector hybrid memory system (`apps/web/src/lib/memory/`).

| Document | Diataxis type | What it covers |
|----------|--------------|---------------|
| [memory-v2/tutorial.md](./memory-v2/tutorial.md) | Tutorial | Step-by-step walkthrough of a user message through all memory v2 subsystems |
| [memory-v2/how-to.md](./memory-v2/how-to.md) | How-to | Task recipes: add a category, tune extraction, debug missing memory, roll back canary |
| [memory-v2/reference.md](./memory-v2/reference.md) | Reference | All exported functions, type signatures, parameters, return values, DB schema |
| [memory-v2/explanation.md](./memory-v2/explanation.md) | Explanation | Why pgvector, why hybrid, why Anthropic caching, budget caps, ConvoMem, tier system, soft-delete |
