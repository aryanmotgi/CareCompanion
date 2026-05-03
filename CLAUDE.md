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
