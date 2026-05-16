# Memory Upgrade v2.1 Plan (stub)

**Status:** Stub. Author full TDD detail per chunk only after v2 is at 100%
rollout for ≥30 days with no regression reports and the eval harness is
producing stable signal.

**Parent plan:** `2026-05-15-memory-upgrade-v2.md` (Days 0–7 shipped).

## Chunks (each ships as its own PR with Steps, tests, verification, rollback)

### 1. Dedup on write
Cosine > 0.88 within `user_id + category`. Mandatory user-id scoping (no
cross-patient merges). On match: `seen_count += 1`, `last_referenced = NOW()`,
skip insert. Write path: `memory/extract.ts` `extractAndSaveMemories`.

### 2. Decay TTL job
Category-keyed TTL via `decay_at` populated at insert. Cron via Vercel
Cron hitting `/api/cron/memory-decay` (Bearer = `CRON_SECRET`). Soft-delete
rows where `decay_at < NOW()` by setting `valid_to = NOW()`.

### 3. Summaries as memory tier
Embed `conversation_summaries.summary` on write; retrieve top-2 alongside
hybrid memories with score multiplier 0.7. Add `UNION ALL` branch in
retrieval CTE in `retrieve.ts`.

### 4. Temporal-reflection contradiction handler
When `memory-conflict.ts` detects same-category opposite-polarity OR
same-medication different-dose: do NOT mutate original `fact`. Insert new
row with rewritten narrative (Haiku-generated) and set old row's
`valid_to = NOW()`. Preserves audit history.

### 5. Importance + seen_count wiring tests
Explicit unit tests verifying retrieval order on identical similarity
scores prefers higher importance / seen_count. Seal current behavior.

### 6. Hard cap 15 in eval
Extend eval harness to call `loadRelevantMemories` with `limit=15` so the
TIER1_CAP+limit=13/15 contract is exercised. Add snapshot.

### 7. Groq Llama for extraction + routing
Only after schema-coercion eval shows ≥99% structured-output success
vs Haiku. Keep Haiku as automatic fallback on parse failure. Touches
`router.ts` + `extract.ts`.

### 8. ConvoMem for users with <30 sessions
DESIGN: keep tier-1 facts + care profile in prompt; bypass only hybrid
retrieval; replace L4 retrieved block with last N raw messages. Cap N
adaptively so input cost stays within daily budget.

### 9. Cleanup PR (post 30-day stable)
- Delete `loadRelevantMemoriesLegacy`
- Remove `ENABLE_MEMORY_HYBRID` env var
- Remove `ENABLE_PROMPT_CACHE` env var
- Remove `hybrid` option from `loadRelevantMemories` signature

### 10. Eval extensions
- Split `tier1Rate_hybrid` vs `tier1Rate_simple` (smart-routing path)
- Track cache hit rate per query in eval snapshots
- Daily eval cron to detect drift; alert on `avgRecall` drop ≥ 5pt

## Pre-flight gates for v2.1 executor

- [ ] v2 at 100% in prod for ≥30 days
- [ ] No P0/P1 regression reports tagged to memory v2
- [ ] Eval harness running daily, avg metrics stable within ±3pt week-over-week
- [ ] Aurora pgvector + halfvec ext still healthy
- [ ] Budget cap rejections < 0.1% of chat requests
