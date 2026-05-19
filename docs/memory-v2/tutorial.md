# Tutorial: A Chat Message Through Memory v2

This tutorial walks you through the complete journey of a single user message — from the moment it arrives at `/api/chat` to the moment a context-injected prompt reaches Claude. By the end you will understand every memory system component and how they connect.

**Prerequisites**: familiarity with Next.js API routes, Drizzle ORM, and basic vector search concepts.

---

## Step 1 — Request arrives at `/api/chat`

The user sends a message: *"Mom increased her metformin from 500mg to 1000mg today."*

The route handler at `apps/web/src/app/api/chat/route.ts` runs three guards before touching memory:

1. **Rate limiting** — IP limiter (30 req/min) then per-user limiter (10 req/min).
2. **CSRF check** — rejects requests without a valid `x-csrf-token` header.
3. **Budget reservation** — calls `reserveBudget(userId, estimate)` which atomically increments `user_usage.reserved_input_tokens` for today. If the user has already consumed 200,000 input tokens or 50,000 output tokens today, the request is rejected with HTTP 429 before any model call.

---

## Step 2 — ConvoMem gate: should we run hybrid retrieval?

```
convoMemEnabledForUser(userId)   ← apps/web/src/lib/memory/convomem.ts
```

This function counts rows in `conversation_summaries` for the user (each row is one past session). If the count is below 30, the user is in **ConvoMem mode**: their memory corpus is too small for hybrid retrieval to add signal over noise, so the system returns only the tier-1 safety floor (see Step 4) and relies on the last 8 raw messages already in the request body.

If the count is ≥ 30, or the user's ID is listed in `FORCE_HYBRID_USER_IDS`, hybrid retrieval runs.

---

## Step 3 — Hybrid gate: is the feature enabled for this user?

```
hybridEnabledForUser(userId)   ← apps/web/src/lib/memory/gate.ts
```

The `ENABLE_MEMORY_HYBRID` env var controls rollout:

| Value  | Effect |
|--------|--------|
| `true` | Hybrid on for everyone |
| `false` | Hybrid off, legacy keyword path |
| `10pct` | Deterministic 10% bucket by sha256(userId) |
| anything else | Off (safe default) |

The per-user gate result is passed explicitly to `loadRelevantMemories` so tests and eval scripts can override it without touching the env var.

---

## Step 4 — Memory retrieval

```
loadRelevantMemories(userId, userMessage, 8, { hybrid })
   ← apps/web/src/lib/memory/retrieve.ts
```

### 4a. Tier-1 safety floor (always runs)

The function first calls `tier1Facts(userId)`, which queries the `memories` table for up to 5 rows where:
- `polarity = 'asserted'`
- `status = 'active'`
- `tier = 1` (allergies, active conditions, active medications)
- `valid_to IS NULL` and `decay_at > NOW()` (not soft-deleted or decayed)

These are prepended to every response regardless of query relevance. You never want Claude to forget an active penicillin allergy because it scored poorly on cosine similarity.

### 4b. Hybrid retrieval (when enabled)

The query text is embedded using `embedQuery(userMessage)` via Google `gemini-embedding-001` (768 dimensions, `RETRIEVAL_QUERY` task type).

A single SQL CTE then runs two searches in parallel:

**Vector arm** (`vec`): cosine nearest-neighbor on the `embedding` halfvec column, excluding tier-1 rows and expired entries. Returns top 30 by distance.

**Keyword arm** (`kw`): Postgres full-text search on the `fact_tsv` tsvector column via `plainto_tsquery`, ranked by `ts_rank_cd`. Returns top 30.

Both result sets are fused with **Reciprocal Rank Fusion (RRF)**:

```
final_score =
  0.5 × (1/(60 + vec_rank) + 1/(60 + kw_rank))
  + 0.2 × recency_decay
  + 0.1 × (importance × ln(1 + seen_count))
  + 0.2 × trust
```

`recency_decay` is an exponential decay over 30 days from `last_referenced` or `created_at`. The top 50 fused candidates are returned.

### 4c. Reranking

```
rerank(query, candidates, topK=8)   ← apps/web/src/lib/memory/rerank.ts
```

The 50 candidates are sent to Voyage AI's `rerank-2.5-lite` model (600ms timeout). If Voyage is unavailable or times out, the function falls back silently to the RRF-ordered list. The top 8 are returned.

The final result is tier-1 facts prepended to the reranked extras, capped at `TIER1_CAP + limit = 13`.

---

## Step 5 — Summary retrieval

```
loadConversationSummaries(userId, 5)   ← retrieve.ts (non-hybrid fallback)
loadRelevantSummaries(userId, userMessage, 2)   ← retrieve.ts (hybrid)
```

For hybrid users with ≥ 30 sessions, up to 2 past conversation summaries are retrieved by cosine similarity to the current message. Their scores are multiplied by `0.7` (`SUMMARY_SCORE_MULTIPLIER`) so they never crowd out high-precision tier-1 facts.

ConvoMem users skip this step entirely.

---

## Step 6 — Context injection into the system prompt

```
buildSystemPromptBlocks(profile, meds, docs, appts, { memories, conversationSummaries, ... })
   ← apps/web/src/lib/system-prompt.ts
```

The prompt is assembled in 4 blocks:

| Block | Content | Cacheable? |
|-------|---------|------------|
| L1 `base` | Static instructions, persona, safety rules | Yes (ephemeral) |
| L2 `userStable` | Care profile, role context, onboarding priorities | Yes (ephemeral) |
| L3 `userDynamic` | Lab results, doctors, appointments, symptoms | No |
| L4 `retrieved` | Retrieved memories + conversation summaries | No |

When `ENABLE_PROMPT_CACHE=true`, L1 and L2 are tagged with Anthropic's `cacheControl: { type: 'ephemeral' }`. Claude reuses the cached KV store for these blocks on subsequent turns, avoiding re-encoding ~2,000 tokens of stable context per request.

Memories appear in L4 under `=== LONG-TERM MEMORY ===`. Summaries appear under `=== RECENT CONVERSATIONS ===`.

---

## Step 7 — Claude generates a response

The assembled system blocks + last 8 conversation messages go to `claude-sonnet-4-6`. The handler streams the response to the client.

---

## Step 8 — Post-response: touch, extract, summarize

After Claude finishes (`onFinish` callback), three things happen in parallel (non-blocking):

### Touch referenced memories
```
touchReferencedMemories(userId, userMessage, memoriesData)
   ← apps/web/src/lib/memory/touch.ts
```

Memories that overlap the user's message by 2+ keywords or 1 entity match (e.g. `metformin 1000mg`) have their `last_referenced` timestamp updated. This keeps frequently mentioned facts rising in the recency score.

### Extract new facts
```
extractAndSaveMemories(userId, careProfileId, userMessage, assistantMessage, existingMemories)
   ← apps/web/src/lib/memory/extract.ts
```

The message pair is sent to Haiku with a structured extraction prompt. For our example, Haiku would extract:

```json
{
  "category": "medication",
  "fact": "Mom increased metformin from 500mg to 1000mg daily",
  "confidence": "high",
  "polarity": "asserted",
  "status": "active",
  "subject": "patient",
  "importance": 0.9
}
```

Before writing to the DB, the extracted fact goes through four guards:

1. **Skip trivial messages** — greeting patterns and messages < 20 chars are skipped.
2. **Prompt injection defense** — `isInstructionShaped()` rejects facts that look like behavioral directives (`"always say"`, `"act as"`, etc.).
3. **Word-overlap dedup** — `resolveConflicts()` in `memory-conflict.ts` checks same-category existing memories. If the old metformin fact matches >65% word overlap, the old row is soft-deleted (`valid_to = NOW()`) and Haiku rewrites both into a merged narrative. If overlap is >95%, the new fact is a duplicate and is dropped.
4. **Cosine dedup** — `findCosineDuplicate()` embeds the (possibly rewritten) fact and checks cosine similarity against existing rows. If similarity > 0.88 within the same category, `seen_count` is bumped on the existing row instead of inserting a new one.

If the fact passes all guards, it is inserted into `memories` with the halfvec embedding, tier, trust, decay_at, and all structured fields.

### Summarize (every 20 messages)
```
summarizeConversation(userId, conversationMessages)
   ← apps/web/src/lib/memory/extract.ts
```

When the server-side message count is a multiple of 20, Haiku generates a structured summary (KEY MEDICAL FACTS, DECISIONS & ACTIONS, CAREGIVER EMOTIONAL STATE, OPEN QUESTIONS, TREATMENT CONTEXT). The summary is embedded and stored in `conversation_summaries`, where it becomes available for future session context retrieval.

---

## What you just saw

A single user message touched every major memory v2 subsystem:

- **ConvoMem gate** — controls cold-start behavior for new users
- **Hybrid gate** — controls per-user feature rollout
- **Tier-1 safety floor** — always-on clinical safety net
- **pgvector + BM25 fusion + Voyage rerank** — the hybrid retrieval stack
- **4-block prompt with caching** — reduces token cost on stable context
- **Touch** — keeps recency scores accurate
- **Extraction pipeline** — Haiku + dedup + cosine guard + DB write
- **Decay** — per-category TTL set at write time, enforced by cron
