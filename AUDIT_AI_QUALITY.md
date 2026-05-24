# AI / LLM Quality Audit — CareCompanion

**Date:** 2026-05-24  
**Scope:** `apps/web/src/` — AI call sites, memory pipeline, eval harness  
**Author:** AI quality audit (aryan/dev)  
**Stack:** Anthropic Claude (Sonnet 4.6 / Haiku 4.5) · Voyage rerank-2.5-lite · Google Vertex AI gemini-embedding-001 · pgvector halfvec(768)

---

## 1. Memory v2 Retrieval Audit

### Architecture Summary

The memory pipeline is a three-stage hybrid retrieval system defined in `apps/web/src/lib/memory/` and `apps/web/src/lib/memory/retrieve.ts`.

**Stage 1 — Dual-path candidate fetch (top-30 each):**
- Vector path: pgvector cosine distance (`<=>`) on `halfvec(768)` embeddings, limited to 30 candidates (`retrieve.ts:163`).
- Keyword path: full-text search on the generated `factTsv` tsvector column, limited to 30 candidates (`retrieve.ts:176`).

**Stage 2 — RRF fusion + scoring:**

```
0.5 * (vec_score + kw_score) +
0.2 * recency_decay +
0.1 * (importance * ln(1 + seen_count)) +
0.2 * trust
```

`vec_score` and `kw_score` are RRF-normalized to `1 / (60 + rank)`. Recency decays exponentially over 30 days. Trust is source-weighted: FHIR=1.0, manual=0.9, conversation=0.5, default=0.3. The fused set is capped at 50 before reranking.

**Stage 3 — Voyage reranking:**
- Model: `rerank-2.5-lite` via `apps/web/src/lib/memory/rerank.ts`.
- Timeout: 600 ms; falls back to RRF order on failure (`rerank.ts:44`).
- Final retrieval cap: 8 memories by default + up to 5 Tier-1 facts prepended unconditionally (`retrieve.ts:8,132`).

**Tier system:**
- Tier 1 (safety floor): allergy, active condition, active medication — always prepended regardless of score.
- Tier 2 (clinical): lab_result, appointment, provider.
- Tier 3 (informational): everything else.

**Fallback paths:**
1. `ENABLE_MEMORY_HYBRID !== 'true'` → legacy keyword pattern matching only (`retrieve.ts:98`).
2. `<30 sessions` → ConvoMem mode: tier-1 only, skip hybrid entirely (`convomem.ts:20`).
3. Reranker timeout → preserve RRF order.
4. Embedding call failure during summary insertion → insert summary without embedding (`extract.ts:276`).

### Identified Risks

**Risk 1 — Chunk size mismatch (medium severity)**  
Facts are stored sentence-atomically with no explicit chunking (extract.ts:103). This is intentional but creates a surface area risk: multi-sentence facts injected by a caregiver in one message will be split by the extractor into sub-facts that may individually lose context. For example, "She had anaphylaxis to penicillin during the 2022 hospitalization" may be stored as two separate facts (`allergy-pcn` and an admission event). The deduplication threshold at cosine > 0.88 (`memory-conflict.ts:14`) may not catch these related fragments as duplicates, leading to redundant low-signal facts accumulating at Tier 3. **Fix:** add a `parent_fact_id` FK for derived sub-facts so retrieval can co-retrieve siblings.

**Risk 2 — Embedding model drift (high severity)**  
The embedding model is `gemini-embedding-001` at 768 dimensions (`embed.ts:7`). All stored vectors in `halfvec(768)` were produced by this model. If Google deprecates or updates `gemini-embedding-001` — even a silent point release that shifts the embedding space — the cosine distances between old stored vectors and newly generated query vectors will silently degrade. There is no version stamp on the `memories` table rows, no re-embedding cron job, and no drift detection in `eval/snapshots/`. **Fix:** add an `embedding_model_version` column; run a nightly drift check comparing query-vector similarity distributions against a control set; schedule a re-embedding migration when the version changes.

**Risk 3 — Summary fallback gaps (medium severity)**  
When the Vertex AI embedding call fails during summary insertion, the code falls back to inserting the summary row without an embedding (`extract.ts:276–281`). This means summary rows with `embedding IS NULL` exist in the database. These rows are invisible to the vector retrieval path and surface only if the keyword path produces a tsvector hit. Summaries are the primary mechanism for context compression across long conversations; an unembedded summary is a silent retrieval miss. **Fix:** add a `nullable` sentinel check on `embedding` during the hybrid query join; enqueue a background retry job for unembedded summaries.

**Risk 4 — Threshold tuning (low-medium severity)**  
The deduplication cosine threshold (0.88) and conflict threshold (0.65 word overlap) are hardcoded constants in `memory-conflict.ts:14,178–179`. The retrieval cap (8) and reranker timeout (600 ms) are hardcoded in `retrieve.ts:132` and `rerank.ts:3`. These values have never been tuned against the golden set. Current eval data (`eval/snapshots/current.json`) shows avgRecall = 0.629 at the default cap of 8. Raising the cap to 15 jumps avgRecall to 0.886 — a 41% improvement — at a cost of a longer context window. The gap between these two caps is completely uncharted. **Fix:** run a precision/recall sweep over caps [8, 10, 12, 15] against the golden set and pick the Pareto-optimal cap. Expose cap and timeout as env vars, not constants.

**Risk 5 — Negative fact retrieval (medium severity)**  
The eval golden set includes `pt-no-diabetes` (Q10: "Did she ever have diabetes?"). At the default cap of 8, recall for this query is **0.0** — the negative fact is not retrieved. The model will either answer from parametric knowledge (potential hallucination) or refuse to answer. Negative/absence facts rely entirely on the negation polarity column and keyword matching. The BM25 path matches "diabetes" correctly but the RRF fusion weights it too low when competing against high-trust clinical facts. **Fix:** add a `polarity:negative` boost in the RRF fusion formula; include negative-fact recall in the eval golden set as a first-class metric.

---

## 2. Prompt Cache Hit Rate Audit

### Current Implementation

Prompt caching is gated on `ENABLE_PROMPT_CACHE === 'true'` and implemented in a single route (`apps/web/src/app/api/chat/route.ts:244–247`). When enabled, `cacheControl: { type: 'ephemeral' }` is attached to two of the four system prompt blocks:

| Block | Content | Cache Status |
|-------|---------|-------------|
| L1 `base` | Generic CareCompanion instructions (~800 tokens) | Cached (when flag enabled) |
| L2 `userStable` | Patient demographics, meds, doctors, appts (~600 tokens) | Cached (when flag enabled) |
| L3 `userDynamic` | Treatment cycle day, recent labs, today's appts (~300 tokens) | Not cached |
| L4 `retrieved` + orchestrator | Per-query memories + specialist synthesis (~900 tokens) | Not cached |

Cache telemetry is logged (`route.ts:329`), but the eval snapshot shows `cacheHitRate: null` — no cache hit tracking is wired into the eval harness.

### Cache Score: **4 / 10**

**Why not higher:**
- The flag `ENABLE_PROMPT_CACHE` defaults to off — if it is not set in production, zero caching occurs across all routes.
- L2 `userStable` is only truly stable if it contains no timestamps. The field description says "no dates, no daysSince, no Date.now" — but this must be enforced at construction time in `system-prompt.ts`; any regression that injects a date into L2 will break the cache invalidation boundary.
- Only one of ~18 Anthropic call sites uses caching. The following routes use Haiku or Sonnet with sizeable repeated system prompts and zero cache breakpoints:

| Route | Model | Cacheable Content |
|-------|-------|------------------|
| `cron/radar/route.ts` | Sonnet 4.6 | Per-user system prompt with static med list, runs daily |
| `cron/weekly-summary/route.ts` | Haiku 4.5 | Static summary instructions |
| `health-summary/route.ts` | Haiku 4.5 | Static formatting instructions |
| `prep/route.ts` | Haiku 4.5 | Static appointment prep instructions |
| `insurance/appeal/route.ts` | Haiku 4.5 | Static appeal letter template prompt |
| `triage/route.ts` | Haiku 4.5 | Static triage classification instructions |
| `memory/extract.ts` | Haiku 4.5 | Static extraction schema prompt (~400 tokens, called after every assistant reply) |
| `memory-conflict.ts` | Haiku 4.5 | Static conflict resolution prompt |
| `drug-interactions.ts` | Haiku 4.5 | Static drug-interaction analysis prompt, 2 calls per request |

**Concrete improvements:**

1. **Enable by default.** Change the gate from `process.env.ENABLE_PROMPT_CACHE === 'true'` to `process.env.ENABLE_PROMPT_CACHE !== 'false'`. Cache breakpoints are a no-op when missed; the cost is only on first-call cache seeding.

2. **Cache `memory/extract.ts` system prompt.** The extraction prompt defines the JSON schema and category taxonomy (~400 tokens) and is identical across all users. This call fires after every assistant reply. With 30 messages/user/month at 100k MAU, this is 3M Haiku calls/month. Marking the schema block ephemeral would recover ~$720/month in cache savings at current Haiku pricing.

3. **Cache the `triage/route.ts` system prompt.** The triage classification schema is a 500-token static block. Marking it cached would benefit the burst rate-limited traffic pattern (10 req/min per IP).

4. **Add `L2_STABLE_HASH` assertion** in the system-prompt builder test to catch any date injection into the L2 block before it ships.

5. **Wire `cachedInputTokens` into the eval harness.** The `cacheHitRate: null` field in `eval/snapshots/current.json` is a dead signal. Emit cache hit ratio as a eval metric to detect regressions when cache invalidation boundaries change.

---

## 3. Hallucination Risk Surfaces

### Grounded Paths (low risk)

The main chat route (`/api/chat`) is well-grounded. Before any LLM call, the handler fetches: care profile, up to 50 medications, 50 doctors, 50 appointments, 20 lab results, notifications, claims, prior authorizations, FSA/HSA data, symptoms, active treatment cycle, up to 8 retrieved memories, and conversation summaries (lines 124–172). These are injected into the 4-block system prompt and additionally made available as on-demand tools (`buildTools`). The orchestrator pre-synthesizes specialist context from agents before the final stream call. PHI is never in logs — error handlers log only system state (`route.ts:358,364,373`). The memory-injection directive filter (`system-prompt.ts:30–50`) strips any user-planted behavioral directives before they reach the LLM.

### Ungrounded / At-Risk Paths

**Path 1 — Guest chat (`/api/chat/guest`, HIGH RISK)**  
The guest route uses a hardcoded static system prompt with zero patient data context (`guest/route.ts:16`). The model is explicitly told it has no access to patient records. However, guests can describe their specific situation ("my mom is on carboplatin and paclitaxel and her ANC is 400"). The model will respond based purely on parametric knowledge with no grounding or retrieval. It may hallucinate specific dosing windows, ANC thresholds, or drug interactions. The safety guardrails ("NEVER diagnose", "Call 911 first") are present but there is no tool access and no grounding. **Risk:** confident incorrect advice grounded in training data rather than the patient's actual records. **Mitigation:** add structured output with a `confidence: low` disclaimer for all drug/dosing claims in guest mode; consider adding a static common drug interaction lookup via a deterministic tool.

**Path 2 — Simple-message fast path (MEDIUM RISK)**  
When `isSimpleMessage()` is true (greetings, ack), the route skips the orchestrator and uses Haiku with only L1+L2+L4 blocks (`route.ts:252–279`). Tier-1 memories are still injected (via the L4 retrieved block). However, the orchestrator specialist synthesis — which often adds drug-interaction warnings and clinical context — is absent. A "thanks, sounds good" following a question about mixing medications would receive a Haiku response without the drug-interaction agent's context. The boundary between "simple" and "non-simple" should be reviewed to ensure it never fires after a clinically-loaded prior assistant turn.

**Path 3 — Radar cron (`/api/cron/radar`, MEDIUM RISK)**  
The daily symptom analysis (`radar/route.ts:350`) calls Sonnet 4.6 with a text prompt and parses the response via a regex JSON match (`route.ts:359`). If the model produces invalid JSON, the parse fails silently and `insights = []`, meaning a real warning (e.g., pain spike) is dropped without surfacing. The model is given medication and lab context but no memory retrieval. Trend interpretation is done entirely by the LLM on the numeric averages provided, with no tool calls for cross-referencing drug side effects. **Risk:** false-negative radar alert (warning suppressed due to parse failure) or hallucinated causal link between symptom and drug. **Mitigation:** use `generateObject` with a Zod schema instead of regex JSON parsing; add a drug-side-effect tool call before the final synthesis.

**Path 4 — Triage route (`/api/triage`, LOW-MEDIUM RISK)**  
The triage handler fetches care profile and medications (`route.ts:10,60`) and injects them into the structured output prompt. This is appropriately grounded for medication context. However, it has no memory retrieval — known allergies stored as tier-1 memories are not injected. If a user describes a symptom and asks about ibuprofen, the triage response will not see the NSAID allergy unless it appears in the medications table rather than the memory store. **Mitigation:** prepend tier-1 allergy memories to the triage system context.

**Path 5 — Document extraction (`/lib/extract-document.ts`, LOW RISK)**  
Uses Sonnet 4.6 for structured field extraction from uploaded documents. The model is grounded by the document content itself. The main risk is hallucinating field values for blurry or partially-legible PDFs. No structured output schema validation visible from the import — if the response is unstructured, caller must validate. Acceptable risk for the use case; recommend adding a confidence score to extracted fields.

---

## 4. Provider Comparison

### Current Multi-Provider Map

| Task | Provider | Model | Notes |
|------|----------|-------|-------|
| Chat (complex) | Anthropic | claude-sonnet-4-6 | Orchestrated, 4-block system, tools |
| Chat (simple fast path) | Anthropic | claude-haiku-4-5 | Greetings/ack, no orchestrator |
| Mobile chat | Anthropic | Haiku 4.5 + Sonnet 4.6 | Haiku default, upgrade path |
| Triage classification | Anthropic | claude-haiku-4-5 | Structured output via Zod |
| Memory fact extraction | Anthropic | claude-haiku-4-5 | Runs post-reply, dual calls |
| Memory conflict rewrite | Anthropic | claude-haiku-4-5 | Conflict resolution |
| Drug interactions | Anthropic | claude-haiku-4-5 | 2 calls per request |
| Health summary | Anthropic | claude-haiku-4-5 | Formatting + summarization |
| Appointment prep | Anthropic | Haiku 4.5 + Sonnet 4.6 | Checklist generation |
| Radar cron | Anthropic | claude-sonnet-4-6 | Daily symptom analysis |
| Weekly summary cron | Anthropic | claude-haiku-4-5 | Summary generation |
| Clinical trials matching | Anthropic | claude-sonnet-4-6 | Multi-tool agent |
| Embeddings | Google Vertex AI | gemini-embedding-001 | HIPAA BAA, 768-dim |
| Reranking | Voyage AI | rerank-2.5-lite | 600ms timeout |
| Intent routing | Anthropic | claude-haiku-4-5 | `agents/router.ts` |
| Orchestration | Anthropic | claude-haiku-4-5 | `agents/orchestrator.ts` |

### Groq Recommendation for Low-Latency Non-PHI Routes

Groq's hardware-accelerated inference achieves 400–800 tokens/second on Llama 3.1 70B and Llama 3.3 70B, versus ~60–100 tokens/second for Haiku 4.5 on Anthropic's standard API. The latency difference is most impactful for synchronous blocking calls where the user waits for a response.

**Recommended Groq migrations:**

| Current Route | Current Model | Recommended Groq Model | Rationale |
|---------------|---------------|------------------------|-----------|
| `agents/router.ts` | Haiku 4.5 | `llama-3.1-8b-instant` | Intent classification — 3–5 category output, <100 token response. No PHI in input (routing only uses message text, not patient data). Latency gain: ~150ms → ~20ms. |
| `agents/orchestrator.ts` | Haiku 4.5 | `llama-3.3-70b-specdec` | Orchestration synthesis — non-PHI aggregation step that summarizes agent outputs before the final Sonnet call. PHI exposure depends on agent outputs; if agents return structured data rather than raw notes, this is safe. |
| `memory/extract.ts` (conflict classifier) | Haiku 4.5 | `llama-3.1-8b-instant` | The first of the two extract calls classifies whether a new fact conflicts with existing ones. This is a 2-way classification on the fact text itself, not raw patient conversation. Speed improvement reduces latency of the post-reply memory pipeline. |
| `cron/weekly-summary/route.ts` | Haiku 4.5 | `llama-3.3-70b-versatile` | Async cron — latency is less critical, but Groq Llama 70B is roughly cost-equivalent to Haiku while being meaningfully more capable at multi-step summarization. |

**PHI caution:** Only migrate routes where the prompt content does not include raw patient names, DOBs, diagnoses, or medication names unless Groq's BAA coverage is confirmed. Intent classification (router) and binary conflict detection are safe. Full fact extraction with conversation snippets is PHI-adjacent and must remain on BAA-covered providers (Anthropic or Vertex).

---

## 5. Eval Coverage

### What Exists

**`apps/web/eval/snapshots/`** contains a retrieval eval harness committed on 2026-05-16:
- `current.json` — 12 golden queries with expected slugs, tier-1 requirements, per-query recall, and P95 latency.
- `hybrid.json` — parallel snapshot with `flagsHybrid: true`.

Key metrics from `current.json`:
- `avgRecall` at default k=8: **0.629**
- `avgRecall` at k=15: **0.886**
- `tier1Rate`: **1.0** (tier-1 safety floor is reliable)
- P95 latency: **1363 ms**
- `cacheHitRate`: **null** (not tracked)

**`apps/web/src/__tests__/`** has 5 AI-adjacent test files:
- `trials/clinicalTrialsAgent.test.ts` — mocks `generateText`, tests trial matching structured output.
- `trials/assembleProfile.test.ts`, `gapAnalysis.test.ts`, `tools.test.ts`, `matchingQueue.test.ts` — trials pipeline unit tests.
- `lib/__tests__/system-prompt.test.ts` — tests `buildSystemPrompt()` and `buildSystemPromptBlocks()` with mock profiles.

**`apps/web/src/lib/__tests__/embed.test.ts`** — one integration test that calls Vertex AI (skipped without `GEMINI_API_KEY`).

### Missing Eval Coverage (Flagged)

**Gap 1 — No CI regression gate on eval metrics.** The eval snapshots exist on disk but there is no CI step that runs the retrieval eval and fails if `avgRecall` drops below a threshold. A schema change, threshold tweak, or embedding model update can silently degrade recall. **Fix:** add a `vitest` eval suite that loads `eval/snapshots/current.json` golden queries, runs `loadRelevantMemories()` against a seeded test database, and asserts `avgRecall >= 0.60` and `tier1Rate === 1.0`.

**Gap 2 — No chat response quality eval.** There is no golden set for chat response quality: no expected outputs, no semantic similarity scoring, no factual accuracy checks against injected context. A regression in the system prompt that causes the model to ignore injected memories would not be detected. **Fix:** create 10 golden (input, expected_contains) pairs covering: allergy recall, medication dosing, appointment reminders, caregiver emotional support tone, and safety escalation ("call 911"). Run with `generateText` and assert semantic overlap via embedding cosine similarity.

**Gap 3 — No hallucination detection test.** There is no test that verifies the model does not fabricate patient data absent from the retrieved context. A simple but effective test: inject a system prompt with only two facts; ask a question about a third fact that does not exist; assert the model responds with "I don't have that information" rather than a confident answer. **Fix:** add 3–5 such "negative grounding" test cases to the eval suite.

**Gap 4 — No prompt regression detection.** `system-prompt.ts` has 600+ lines and is tested structurally (block construction) but not behaviorally. A developer can accidentally change the tone or safety rules without failing any test. **Fix:** snapshot-test the full rendered system prompt for a canonical profile; fail the test if the diff exceeds a token threshold.

**Gap 5 — No triage eval.** The triage route produces urgency classifications for life-safety decisions. There is no test suite validating that "fever 39.5°C on day 10 of FOLFOX with ANC < 500" always returns `urgency: emergency`. **Fix:** add a triage golden set of 15 symptom inputs (5 per urgency tier) with required urgency assertions.

---

## 6. Cost per Request Estimates

Pricing basis (as of 2026-Q2):  
- Claude Sonnet 4.6: $3.00/M input, $15.00/M output, $0.30/M cache-read  
- Claude Haiku 4.5: $0.80/M input, $4.00/M output, $0.08/M cache-read  
- Voyage rerank-2.5-lite: $0.05/M tokens  
- Gemini Embedding 001: $0.001/M tokens (Vertex)  

Assumed MAU activity: 30 chat messages/month/user.

| # | Route / Call Site | Model | Avg Input (tokens) | Avg Output (tokens) | $/call (no cache) | $/call (w/ cache) | $/100k MAU / mo |
|---|---|---|---|---|---|---|---|
| 1 | `chat/route.ts` full orchestrated path | Sonnet 4.6 | 3,600 | 500 | $0.0183 | $0.0121 | $36,300 (no cache) / $24,200 (cached) |
| 2 | `chat/route.ts` simple fast path (~20% of chat) | Haiku 4.5 | 2,200 | 200 | $0.00256 | $0.00208 | $1,536 / $1,248 |
| 3 | `memory/extract.ts` fact extraction (runs post-reply) | Haiku 4.5 | 800 | 150 | $0.00124 | $0.00124 | $3,720 (no cacheable block currently) |
| 4 | `memory/extract.ts` summary trigger (every 20 msgs) | Haiku 4.5 | 2,000 | 400 | $0.00320 | $0.00320 | $480 |
| 5 | `cron/radar/route.ts` (daily, per active user) | Sonnet 4.6 | 1,800 | 400 | $0.01140 | $0.01140 | $34,200 (daily × 30 days) |
| 6 | `drug-interactions.ts` (2 calls, triggered by medication questions) | Haiku 4.5 | 600 × 2 | 200 × 2 | $0.00256 | $0.00256 | $1,536 |
| 7 | `triage/route.ts` | Haiku 4.5 | 900 | 300 | $0.00192 | $0.00192 | $384 |
| 8 | `cron/weekly-summary/route.ts` (4/month) | Haiku 4.5 | 1,200 | 400 | $0.00256 | $0.00256 | $1,024 |
| 9 | `memory/rerank.ts` Voyage (runs per hybrid retrieval) | Voyage | 2,000 | — | $0.00010 | $0.00010 | $300 |
| 10 | `memory/embed.ts` Gemini embedding (per fact + query) | Vertex | 150 | — | $0.00000015 | — | ~$4 (negligible) |

**Dominant cost drivers:**
1. **Sonnet full chat path** is the largest spend at ~$36K/100k MAU/month without prompt caching, dropping to ~$24K with caching — a **34% reduction** from enabling `ENABLE_PROMPT_CACHE` alone.
2. **Radar cron** is the second-largest at ~$34K/100k MAU/month. It runs daily with no caching and uses Sonnet 4.6 for per-user analysis. Consider batching users in a single Sonnet call with multi-turn context, or downgrading to Haiku 4.5 for users with no abnormal trends.
3. **Fact extraction** is the most frequent call (every assistant reply) and currently has zero prompt caching. Adding a cache breakpoint on the static extraction schema block would save ~$720/month at 100k MAU.

**Top cost reduction actions:**
1. Enable prompt caching in production (flip default) → ~34% savings on chat.
2. Cache `memory/extract.ts` system prompt → ~$720/month at 100k MAU.
3. Downgrade radar cron to Haiku 4.5 for users with stable/green trends → ~50% cron cost reduction.
4. Migrate `agents/router.ts` to Groq Llama 8B → ~$0/call latency savings + cost neutral.

---

## Summary Scorecard

| Area | Score | Top Action |
|------|-------|------------|
| Memory retrieval quality | 7/10 | Fix negative-fact retrieval; add embedding version stamp |
| Prompt cache coverage | 4/10 | Flip default to on; cache extract.ts schema block |
| Hallucination grounding | 6/10 | Ground triage with tier-1 memories; fix radar JSON parse |
| Provider diversity | 5/10 | Introduce Groq for router + orchestrator |
| Eval / regression coverage | 4/10 | Add CI retrieval regression gate; add chat golden set |
| Cost efficiency | 5/10 | Enable caching; batch radar cron; Groq for non-PHI routes |

**Overall: 5.2 / 10** — the retrieval architecture is sophisticated and the tier-1 safety floor is solid. The primary gaps are (1) absent prompt caching in production, (2) no CI regression gate on retrieval metrics, and (3) two ungrounded paths (guest chat, radar cron) that can generate confident incorrect clinical statements.
