# Reference: Memory v2 API

All exported functions from `apps/web/src/lib/memory/` and the closely-related `apps/web/src/lib/memory-conflict.ts`. DB schema for all memory tables.

---

## `embed.ts`

### `embedText(text: string): Promise<number[]>`

Embeds a single document string. Uses Google `gemini-embedding-001`, 768 dimensions, `RETRIEVAL_DOCUMENT` task type.

**Returns** a 768-element float array.  
**Throws** if the vector length ≠ 768 or contains NaN/Infinity.

### `embedQuery(text: string): Promise<number[]>`

Same as `embedText` but uses `RETRIEVAL_QUERY` task type. Use this for query-time embedding (retrieval); use `embedText`/`embedTextBatch` for document-time embedding (storage).

**Returns** a 768-element float array.

### `embedTextBatch(texts: string[]): Promise<number[][]>`

Batch document embedding. Calls `embedMany` in a single API round-trip.

**Params**
- `texts` — array of strings to embed. Empty array returns `[]` without an API call.

**Returns** a 2-D array: `embeddings[i]` is the 768-element vector for `texts[i]`.  
**Throws** if any vector is malformed.

### `toHalfvecLiteral(vec: number[]): string`

Converts a float array to the Postgres `halfvec` literal format: `"[x1,x2,...,x768]"`.

**Params**
- `vec` — must be exactly 768 elements, all finite.

**Returns** string suitable for use in SQL as `${lit}::halfvec`.  
**Throws** if length ≠ 768 or any element is NaN/Infinity.

---

## `extract.ts`

### `extractFromConversation(userMessage, assistantMessage, existingMemories): Promise<ExtractedFact[]>`

Pure extraction — no DB writes, no side effects. Calls Haiku with the structured extraction prompt and returns the parsed facts. Mockable in tests.

**Params**
- `userMessage` — the user's turn.
- `assistantMessage` — Claude's response.
- `existingMemories: Memory[]` — shown to Haiku to prevent duplicate extraction.

**Returns** array of `ExtractedFact` (may be empty).  
**Model** `claude-haiku-4-5-20251001` via `@ai-sdk/anthropic`.

### `ExtractedFact` type

```ts
{
  category: MemoryCategory;        // one of 15 categories
  fact: string;                    // atomic, specific fact with names/numbers/dates
  confidence: 'high' | 'medium' | 'low';
  polarity: 'asserted' | 'negated';
  status: 'active' | 'historical' | 'denied';
  subject: 'patient' | 'caregiver' | 'family';
  importance?: number;             // 0.0–1.0
}
```

### `extractAndSaveMemories(userId, careProfileId, userMessage, assistantMessage, existingMemories): Promise<void>`

Full extraction pipeline: guard → extract → dedup → embed → cosine dedup → insert. Runs non-blocking (called with `.catch()`) after each assistant response.

**Guards (in order)**:
1. `SKIP_PATTERNS` — skips greetings and trivial phrases.
2. `MIN_MESSAGE_LENGTH = 20` — skips if both messages are under 20 chars.
3. `isInstructionShaped()` — rejects prompt-injection-shaped facts.
4. `resolveConflicts()` — word-overlap dedup; may soft-delete conflicting rows.
5. `findCosineDuplicate()` — cosine dedup; bumps `seen_count` on near-duplicates instead of inserting.

**Params**
- `userId: string` — UUID.
- `careProfileId: string | null` — may be null if user has no care profile yet.
- `userMessage`, `assistantMessage` — the turn to extract from.
- `existingMemories: Memory[]` — already loaded for the session (passed to avoid a second DB read).

**Returns** `void`. Errors are caught and logged as `[memory] extraction failed:`.

### `summarizeConversation(userId, msgs, force?): Promise<void>`

Generates and stores a structured conversation summary.

**Params**
- `userId: string`
- `msgs: { role: string; content: string }[]` — full conversation history.
- `force?: boolean` — if `true`, summarizes regardless of message count. Default `false` (summarizes only at multiples of 20, minimum 4 messages).

**Behavior**: skips if the most recent existing summary has the same `messageCount`. Uses last 50 messages (truncated). Embeds the summary text; falls back to insert without embedding if embedding fails.

**Model** `claude-haiku-4-5-20251001`.

---

## `retrieve.ts`

### `TIER1_CAP = 5`

Maximum number of tier-1 facts prepended to every retrieval result.

### `SUMMARY_SCORE_MULTIPLIER = 0.7`

Multiplied against cosine similarity scores for conversation summaries so they don't dominate over tier-1 memory facts.

### `computeHybridScore(p): number`

JavaScript mirror of the SQL hybrid scoring formula. Used in tests.

**Params** (all numbers):
- `p.vecScore` — RRF score from vector arm: `1/(60 + vec_rank)`.
- `p.kwScore` — RRF score from keyword arm: `1/(60 + kw_rank)`.
- `p.recency` — exponential decay: `exp(-days_since_referenced / 30)`.
- `p.importance` — `0.0–1.0` from the `importance` column.
- `p.seenCount` — `seen_count` column value.
- `p.trust` — `0.0–1.0` from the `trust` column.

**Formula**: `0.5*(vecScore + kwScore) + 0.2*recency + 0.1*(importance * ln(1 + seenCount)) + 0.2*trust`

### `loadMemories(userId, limit?, categories?): Promise<Memory[]>`

Bulk load of a user's memories, ordered by `last_referenced DESC`. No embedding or scoring.

**Params**
- `userId: string`
- `limit?: number` — default 150.
- `categories?: string[]` — if provided, filters to those categories only.

**Returns** `Memory[]`. Returns `[]` on DB error (logged as `[memory] load failed:`).

### `loadRelevantMemories(userId, userMessage, limit?, options?): Promise<Memory[]>`

Main retrieval function. Routes to hybrid or legacy path based on `options.hybrid` (or `ENABLE_MEMORY_HYBRID` env var).

**Params**
- `userId: string`
- `userMessage: string` — the current user message. Empty string returns tier-1 only.
- `limit?: number` — number of non-tier-1 extras to return after reranking. Default 8.
- `options.hybrid?: boolean` — overrides env var. Pass the result of `hybridEnabledForUser()`.

**Hybrid path behavior**:
1. Loads tier-1 safety floor (up to `TIER1_CAP`).
2. Embeds `userMessage` with `embedQuery`.
3. Runs CTE: pgvector top-30 + BM25 top-30, fused via RRF, scored, top-50 returned.
4. Reranks via Voyage `rerank-2.5-lite` (600ms timeout, fallback to RRF order).
5. Fetches full `Memory` rows for reranked IDs, excluding tier-1 duplicates.
6. Writes an audit row to `memory_access_log`.
7. Returns `[...tier1, ...extras].slice(0, TIER1_CAP + limit)`.

**Errors**: returns `[]` on failure (callers use `.catch(() => [])` in the route).

### `loadConversationSummaries(userId, limit?): Promise<ConversationSummary[]>`

Loads the most recent summaries by `created_at DESC`. No embedding.

**Params**
- `userId: string`
- `limit?: number` — default 5.

**Returns** `ConversationSummary[]`. Returns `[]` on error.

### `loadRelevantSummaries(userId, userMessage, limit?): Promise<RelevantSummary[]>`

Cosine-nearest summaries for the current message.

**Params**
- `userId: string`
- `userMessage: string` — empty string returns `[]` immediately.
- `limit?: number` — default 2.

**Returns** `RelevantSummary[]` where `score = cosine_similarity * SUMMARY_SCORE_MULTIPLIER`.

### `RelevantSummary` type

```ts
{
  id: string;
  summary: string;
  topics: string[] | null;
  createdAt: Date | null;
  score: number;             // cosine similarity × 0.7
}
```

---

## `convomem.ts`

### `SESSION_THRESHOLD = 30`

Users with fewer than this many past sessions are in ConvoMem mode.

### `countSessionsForUser(userId: string): Promise<number>`

Counts rows in `conversation_summaries` for the user. Each row represents one session boundary.

**Returns** `0` on DB failure (safe default: ConvoMem mode is safer than running hybrid on an empty corpus).

### `convoMemEnabledForUser(userId: string): Promise<boolean>`

Returns `true` when ConvoMem mode should be used (hybrid retrieval bypassed).

**Logic**:
1. If `userId` is in `FORCE_HYBRID_USER_IDS` (comma-separated env var) → `false` (hybrid on, override).
2. Else: `true` when `countSessionsForUser(userId) < SESSION_THRESHOLD`.

---

## `gate.ts`

### `hybridEnabledForUser(userId: string): boolean`

Synchronous. Reads `ENABLE_MEMORY_HYBRID` env var:

| Value | Returns |
|-------|---------|
| `'true'` | `true` |
| `'false'` | `false` |
| `'10pct'` | `sha256(userId)[0:4] % 100 < 10` |
| anything else | `false` |

The 10% bucket is stable: same input always produces the same output.

---

## `rerank.ts`

### `RerankCandidate` type

```ts
{ id: string; text: string }
```

### `rerank(query, candidates, topK?): Promise<{ items: RerankCandidate[]; usedReranker: boolean }>`

Reranks candidates using Voyage AI `rerank-2.5-lite`.

**Params**
- `query: string` — the user message.
- `candidates: RerankCandidate[]` — up to 50 candidates from the hybrid CTE.
- `topK?: number` — default 8.

**Behavior**:
- Returns `{ items: candidates.slice(0, topK), usedReranker: false }` if `VOYAGE_API_KEY` is unset or `candidates` is empty.
- 600ms `AbortController` timeout. On timeout or non-2xx, falls back to unmodified order with `usedReranker: false`.
- On success, returns Voyage-ordered items with `usedReranker: true`.

**Errors**: caught and logged as `[rerank] fallback to RRF order`.

---

## `touch.ts`

### `touchReferencedMemories(userId, userMessage, mems): Promise<void>`

Updates `last_referenced = NOW()` on memories that overlap the current message.

**Match criteria** (either):
- 2 or more keyword matches (keywords ≥ 5 chars, common stop-words excluded).
- 1 entity match: medication name (`<word> <N>mg`) or doctor name (`dr. <name>`).

**Params**
- `userId: string` — kept for API parity; not used in the WHERE clause (IDs are pre-scoped to user via `mems`).
- `userMessage: string`
- `mems: Memory[]` — the memories already loaded for this session.

Called non-blocking (`void touchReferencedMemories(...).catch(...)`) after the user message is received.

---

## `validators.ts`

### `isInstructionShaped(fact: string): boolean`

Returns `true` if `fact` looks like an AI behavioral directive (prompt injection). Checks against 7 regex patterns including `always/never do`, `from now on`, `act as`, `system prompt`, `reveal your instructions`, etc.

### `defaultImportance(category: string): number`

Default `importance` value (0.0–1.0) when Haiku does not provide one.

| Category | Default |
|----------|---------|
| allergy | 1.0 |
| condition, medication | 0.9 |
| lab_result, treatment_response | 0.7 |
| appointment, provider, legal | 0.6 |
| insurance, family | 0.5 |
| emotional_state, financial | 0.4 |
| preference, lifestyle, other | 0.3 |
| (unknown) | 0.5 |

### `trustForSource(source: string): number`

Trust score used in the hybrid scoring formula.

| Source | Trust |
|--------|-------|
| `'fhir_sync'` | 1.0 |
| `'manual'` | 0.9 |
| `'conversation'` | 0.5 |
| (other) | 0.3 |

### `decayForCategory(category, status): Date | null`

Returns the `decay_at` timestamp to write at insert time, or `null` for never-decay categories.

**Never decays** (returns `null`): `allergy`, `medication`, `active condition`, `provider`, `insurance`, `family`, `legal`, `financial`.

**Time-limited**:

| Category | TTL |
|----------|-----|
| lab_result | 365 days |
| emotional_state, preference, lifestyle, treatment_response | 180 days |
| appointment, other | 90 days |
| (unknown) | 90 days |

### `tierForCategory(category, status, polarity): 1 | 2 | 3`

Assigns the `tier` column value.

- **Tier 1** — `polarity = 'asserted'` AND `status = 'active'` AND category in `['allergy', 'condition', 'medication']`. Always included in retrieval output.
- **Tier 2** — `lab_result`, `appointment`, `provider`. Boosted in scoring.
- **Tier 3** — everything else.

Negated or historical safety facts are tier 3 — they must not bypass to the safety floor and invert the medical signal.

---

## `memory-conflict.ts` (adjacent module)

### `findCosineDuplicate(userId, category, embeddingLit): Promise<{ duplicateId: string | null }>`

Checks for a near-duplicate row in `memories` for the same `(user_id, category)` by cosine similarity.

**Params**
- `userId: string`
- `category: string`
- `embeddingLit: string` — halfvec literal from `toHalfvecLiteral`.

**Returns** `{ duplicateId: string }` when `1 - (embedding <=> query) > 0.88`, else `{ duplicateId: null }`.

**Threshold** `COSINE_DUP_THRESHOLD = 0.88`. Strict `>` so an exact tie does not collapse facts.

### `bumpSeenCount(memoryId: string): Promise<void>`

Increments `seen_count` and sets `last_referenced = NOW()` on an existing row. Called when `findCosineDuplicate` returns a match.

### `resolveConflicts(userId, newFact, category, existingMemories): Promise<{ superseded: string[]; isDuplicate: boolean; rewrittenFact: string | null }>`

Word-overlap dedup and conflict resolution.

**Logic** per same-category, non-soft-deleted existing memory:
- Shared entities (medication names, doctor names, allergy terms) must exist for comparison to proceed.
- `overlapRatio ≥ 0.95` → `isDuplicate: true` (caller skips insert).
- `overlapRatio ≥ 0.65` → conflict: old row soft-deleted (`valid_to = NOW(), status = 'historical'`); Haiku rewrites old + new into a merged sentence.

**Returns**:
- `isDuplicate: true` → caller drops the new fact entirely.
- `rewrittenFact: string` → caller inserts this merged text instead of the raw new fact.
- `rewrittenFact: null` on Haiku failure → caller inserts the raw new fact.

---

## Database Schema

### `memories`

Primary table for extracted facts.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | randomly generated |
| `user_id` | uuid FK → users | cascade delete |
| `care_profile_id` | uuid FK → care_profiles | nullable |
| `category` | text | one of 15 values |
| `fact` | text | the extracted fact string |
| `source` | text | `'conversation'`, `'manual'`, `'fhir_sync'` |
| `confidence` | text | `'high'`, `'medium'`, `'low'` |
| `polarity` | text | `'asserted'` (default), `'negated'` |
| `status` | text | `'active'` (default), `'historical'`, `'denied'` |
| `subject` | text | `'patient'` (default), `'caregiver'`, `'family'` |
| `importance` | numeric(2,1) | 0.0–1.0, default 0.5 |
| `seen_count` | integer | default 1; incremented by `bumpSeenCount` |
| `tier` | integer | 1/2/3, default 3 |
| `trust` | numeric(2,1) | 0.0–1.0 by source, default 0.5 |
| `embedding` | halfvec(768) | Google gemini-embedding-001; nullable |
| `fact_tsv` | tsvector | Postgres full-text search index; auto-populated by trigger |
| `valid_from` | timestamptz | defaultNow() |
| `valid_to` | timestamptz | null = active; set by conflict resolution or decay cron |
| `decay_at` | timestamptz | when to soft-delete; null = never |
| `last_referenced` | timestamptz | updated by `touchReferencedMemories` |
| `cycle_number` | integer | treatment cycle number, if applicable |
| `lab_value_numeric` | numeric | parsed numeric for lab results |
| `lab_value_unit` | text | unit string for lab results |
| `measured_at` | timestamptz | when the lab was taken |
| `severity` | integer | optional severity score |
| `slug` | text | optional human-readable identifier |
| `created_at` | timestamptz | defaultNow() |

**Retrieval filters**: `valid_to IS NULL AND (decay_at IS NULL OR decay_at > NOW())`.

### `conversation_summaries`

Periodic session summaries.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | cascade delete |
| `summary` | text | structured Haiku output |
| `topics` | text[] | key topics; default `'{}'` |
| `message_count` | integer | message count at summary time; default 0 |
| `embedding` | halfvec(768) | nullable; used by `loadRelevantSummaries` |
| `created_at` | timestamptz | defaultNow() |

### `memory_access_log`

HIPAA audit trail: every retrieval is logged.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | cascade delete |
| `memory_ids` | uuid[] | IDs of memories returned |
| `reason` | text | `'chat_context'`, `'chat_context_no_rerank'`, `'chat_context_empty'` |
| `created_at` | timestamptz | defaultNow() |

`logAccess` (internal to `retrieve.ts`) throws on failure rather than swallowing — a failed audit write surfaces as a 500 rather than silently producing an unlogged PHI access.

### `user_usage`

Daily token budget tracking.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | cascade delete |
| `usage_date` | date | default `CURRENT_DATE` |
| `input_tokens` | integer | actual, from Anthropic response |
| `output_tokens` | integer | actual |
| `cache_read_tokens` | integer | `cachedInputTokens` from AI SDK |
| `cache_create_tokens` | integer | reserved for future use |
| `reserved_input_tokens` | integer | pre-request estimate; reconciled by `recordUsage` |
| `model_calls` | integer | count of LLM calls |
