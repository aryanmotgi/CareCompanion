# Explanation: Why Memory v2 is Built This Way

This document explains the design decisions behind memory v2 — the tradeoffs considered, the alternatives rejected, and the constraints that shaped the final architecture.

---

## Why pgvector instead of a dedicated vector database

The alternatives we considered: Pinecone, Weaviate, Qdrant, and a standalone Postgres instance with pg_embedding.

**We chose pgvector in Aurora Postgres** because:

1. **We already have Aurora**. Adding a separate vector database means a second service to authenticate, monitor, scale, and pay for. It also means distributed transactions: a fact extracted from a conversation must be written atomically with its user-scoped metadata. With pgvector, extraction is a single `INSERT` into the same database that owns the user record.

2. **Our dataset is small per user**. A typical active user accumulates a few hundred memories over months. At that scale, pgvector's IVFFlat or HNSW index is fast enough — sub-10ms for a top-30 cosine search — and there is no operational benefit from a specialized ANN index in a separate service.

3. **BM25 keyword search is free**. Postgres `tsvector` / `ts_rank_cd` gives us full-text ranking without a second store. The hybrid CTE fuses vector and keyword results in a single SQL query, avoiding a round-trip to an external service.

4. **HIPAA compliance surface is smaller**. All PHI lives in one Aurora cluster with existing VPC controls, IAM authentication, and encryption at rest. A second service doubles the audit surface.

The tradeoff: Aurora halfvec (half-precision float16) tops out at 2,000 dimensions. We use 768 from Google `gemini-embedding-001`, well within that limit. If we ever needed 3,000+ dimensions, we would need to either switch to float32 (doubling storage) or move to a dedicated vector DB.

---

## Why hybrid (semantic + keyword) rather than semantic-only

Semantic-only retrieval with cosine similarity has a systematic failure mode in the medical domain: **specificity collapse**.

*Example*: a user asks "What did the oncologist say about the CEA level?" A pure vector search returns memories semantically related to oncology and CEA — but if the user's oncologist goes by "Dr. Patel" and the memory says "Dr. Patel said CEA dropped from 45 to 28 after cycle 2", the cosine similarity to "oncologist CEA level" may be weaker than to a vague memory about "lab results improving."

BM25 keyword search has the opposite failure mode: it matches exact tokens but misses synonyms, abbreviations, and domain paraphrases.

**Reciprocal Rank Fusion** combines both without requiring a separate training step or learned weights. The `1/(60 + rank)` formula is robust to rank gaps: a fact ranked 1st in one arm and 20th in the other fuses better than a fact ranked 5th in neither. The constant 60 prevents the highest-ranked fact from dominating when the other arm has no signal.

The final scoring formula adds recency, seen-count-weighted importance, and trust:

```
0.5 × (vec_rrf + kw_rrf)    — retrieval signal
+ 0.2 × recency_decay       — prefer recently referenced facts
+ 0.1 × (importance × ln(1 + seen_count))  — surface repeatedly mentioned facts
+ 0.2 × trust               — prefer FHIR-synced facts over inferred ones
```

The `0.1 × importance × ln(1 + seen_count)` term is intentional: a fact mentioned once at importance 0.9 scores lower than the same fact mentioned three times. `ln(1 + seenCount)` dampens the multiplier so a single very-seen fact doesn't dominate.

Voyage `rerank-2.5-lite` sits after fusion as a cross-encoder pass: it reads the query and each candidate fact together, producing a more contextually accurate score than the bi-encoder used for embedding. The 600ms timeout prevents reranking from becoming the bottleneck on a slow Voyage response; the fallback is the RRF-ordered list, which is already a reasonable ranking.

---

## Why Anthropic prompt caching

Each request to Claude carries a system prompt that includes the care profile, role context, and personalized greeting — roughly 1,500–2,500 tokens of stable context. Without caching, these tokens are re-encoded on every turn, consuming input-token budget and adding latency.

Anthropic's ephemeral cache works as a KV store keyed on content. If a block's content is identical to a previous call, the KV is reused and `cachedInputTokens` is reported in the response. The cost for cache reads is significantly lower than for regular input tokens.

The 4-block prompt design is built around this:

- **L1 (base)** — persona, safety rules, output format. Changes only when we update the system prompt code. Marked cacheable.
- **L2 (userStable)** — care profile, cancer type, caregiver context. Changes only when the user updates their profile. Marked cacheable.
- **L3 (userDynamic)** — lab results, appointments, symptoms, notifications. Changes on every turn. Not cached.
- **L4 (retrieved)** — per-query memories and summaries. Changes on every turn. Not cached.

This means two of the four blocks hit the cache on nearly every turn for active users, reducing effective input token consumption significantly for multi-turn sessions.

The tradeoff: caching is only active when `ENABLE_PROMPT_CACHE=true`. It requires the blocks to be passed as separate `system` entries in the AI SDK message array (not concatenated into a single string), which is why `buildSystemPromptBlocks` returns structured objects rather than a single string.

---

## Why budget caps

CareCompanion users can run multi-turn sessions where each turn involves:
- Retrieval (embedding call to Google, reranking call to Voyage)
- Orchestrator (Haiku for routing)
- Main response (Sonnet)
- Post-response extraction (Haiku)
- Occasional summarization (Haiku)

Without a cap, a single user in a very long session could consume tokens at a rate that makes the service economically unviable. The caps are:

- **200,000 input tokens/day** — approximately 150,000 words of context, which is far more than any realistic caregiving session.
- **50,000 output tokens/day** — approximately 37,500 words of model output.

Caps are implemented via an **atomic reservation** before each request (`reserveBudget`): the estimated token count is added to `reserved_input_tokens` in a single DB UPDATE with a lock-like read-then-write. If the projected total exceeds the cap, the request is rejected with HTTP 429 before any model call.

After the model responds, `recordUsage` reconciles the reservation with actual usage from the Anthropic response object. The reservation prevents two concurrent requests from both passing the cap check and then collectively exceeding it.

The tradeoff: estimates (`estimateTokens`) are approximate. A request may be rejected even if its actual usage would not have exceeded the cap. We accept this for simplicity — the window is per-calendar-day and resets at midnight.

---

## Why ConvoMem mode

Hybrid retrieval is optimized for a corpus of at least a few hundred memories across multiple sessions. For a brand-new user with 0–5 sessions, the corpus has at most a few dozen memories, the embeddings have high variance, and the BM25 index has little signal.

In early testing, hybrid retrieval on sparse corpora produced worse results than simply relying on the last 8 raw messages in the conversation. The raw messages are already in the request body and cost nothing extra to pass to the model.

**ConvoMem mode** solves the cold-start problem: below 30 sessions (counted as rows in `conversation_summaries`), retrieval returns only the tier-1 safety floor and trusts the raw message history for context. Above 30 sessions, hybrid retrieval activates.

The `FORCE_HYBRID_USER_IDS` env var lets us test hybrid retrieval on specific accounts (typically developer accounts with few sessions) without waiting for them to accumulate 30 real sessions.

The threshold of 30 was chosen empirically: at 30 sessions, the average user has 200–400 memories, which is enough for the hybrid CTE to produce meaningful signal over the keyword-only path.

---

## Why the tier system

Not all memories are equal in urgency. A tier hierarchy solves two problems:

1. **Safety floor**: Some facts must always appear in the prompt regardless of query relevance. A user with a severe penicillin allergy should not receive a recommendation involving penicillin just because the cosine score for that memory happened to rank it 12th when the limit is 8.

2. **Retrieval budget**: The prompt has a finite token budget. Tier-1 facts are always prepended (up to 5), so the variable-length retrieval output occupies the remaining budget. Tier-2 facts (labs, appointments, providers) get a scoring boost via the importance defaults assigned by `defaultImportance`.

The strict rule — negated or historical safety facts are tier 3, never tier 1 — prevents an inverted signal from reaching the safety floor. "Denies penicillin allergy" (polarity=negated) and "stopped Tamoxifen last month" (status=historical) are tier 3 because putting them in the always-included slot would imply they are current active facts.

---

## Why soft-delete instead of hard-delete for conflicts and decay

When a user corrects a fact ("Mom stopped Tamoxifen last month"), the old row is not deleted — `valid_to = NOW()` is set. This preserves the original wording for:

- **Audit**: HIPAA requires a complete audit trail of PHI access and modification. A hard-delete would erase evidence of what the system knew at a given point in time.
- **Debugging**: Soft-deleted rows can be inspected to understand why a conflict was detected.
- **Rollback**: If conflict resolution misclassifies a change, the old row can be restored by clearing `valid_to`.

Hard-delete is handled separately by a `/api/cron/purge` route (not part of memory v2 itself) which enforces HIPAA-aligned 90-day hard retention windows on soft-deleted rows.

---

## Why trust scores

The `trust` column encodes provenance confidence:

| Source | Trust | Rationale |
|--------|-------|-----------|
| `fhir_sync` | 1.0 | Structured data from the hospital's EHR; ground truth |
| `manual` | 0.9 | User entered it explicitly in the UI; deliberate |
| `conversation` | 0.5 | Extracted by LLM from natural language; may contain inference errors |

Trust contributes 20% of the hybrid score, meaning FHIR-sourced facts naturally surface above equivalent conversation-extracted facts. This matters when there is a discrepancy: if the EHR says a medication is 500mg and a conversation extraction says 1,000mg, the FHIR fact scores ~0.5 higher on trust alone. A human reviewer would need to reconcile the difference rather than the system silently preferring the more recent one.
