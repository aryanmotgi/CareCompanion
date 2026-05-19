# How-to: Memory v2 Task Recipes

Practical recipes for common memory-system tasks.

---

## How to add a new memory category

**When**: you need to track a new fact type (e.g. `genetic_marker`, `clinical_trial`).

### 1. Add the category to the extraction schema

In `apps/web/src/lib/memory/extract.ts`, add the new value to `MEMORY_CATEGORIES`:

```ts
const MEMORY_CATEGORIES = [
  'medication', 'condition', 'allergy', /* ... */,
  'genetic_marker',  // ← add here
] as const;
```

The Zod `factSchema.category` enum is derived from this array, so extraction and DB validation stay in sync automatically.

### 2. Assign a default importance

In `apps/web/src/lib/memory/validators.ts`, add an entry to the `map` inside `defaultImportance()`:

```ts
genetic_marker: 0.8,  // high — clinically significant
```

Facts for categories not in the map fall back to `0.5`.

### 3. Assign a tier

In `validators.ts → tierForCategory()`, decide whether the new category should be:

- **Tier 1** (always included in every prompt, safety floor): add to the `polarity === 'asserted' && status === 'active'` condition — use sparingly, only for safety-critical facts.
- **Tier 2** (boosted in scoring): add to the `category === 'lab_result' || ...` condition.
- **Tier 3** (default): no change needed.

### 4. Set a decay TTL

In `validators.ts → decayForCategory()`, add a case for how long facts in this category should live:

```ts
if (category === 'genetic_marker') return null  // never decays — germline facts are permanent
```

Alternatively, return a future `Date` for time-limited categories.

### 5. Add category signals for legacy retrieval (optional)

In `apps/web/src/lib/memory/retrieve.ts`, add keyword signals to `CATEGORY_SIGNALS` so the legacy keyword path can route queries to the new category:

```ts
genetic_marker: ['brca', 'brca1', 'brca2', 'lynch', 'mismatch repair', 'germline', 'hereditary'],
```

### 6. Update the extraction prompt

In `extract.ts → EXTRACTION_PROMPT_RULES`, add a bullet under `WHAT TO EXTRACT` describing what facts of this type look like and what level of confidence to assign.

### 7. Run health checks

```bash
npm run typecheck && npm run lint && npm run test:run
```

---

## How to tune extraction quality

**When**: Haiku is missing facts you expect, or is extracting noise you don't want.

### Raise the minimum message length threshold

If many trivial messages are being processed unnecessarily:

```ts
// extract.ts
const MIN_MESSAGE_LENGTH = 20;  // increase to 30 or 40
```

### Tighten skip patterns

If certain user phrases produce noisy extractions, add them to `SKIP_PATTERNS`:

```ts
const SKIP_PATTERNS = /^(hi|hello|...|sounds good|will do)\b/i;
```

### Edit the extraction prompt rules

`EXTRACTION_PROMPT_RULES` in `extract.ts` is the primary lever. The prompt is passed verbatim to Haiku. Key sections to tune:

- **WHAT TO EXTRACT** — add specific examples for fact types Haiku misses.
- **SKIP** — add categories of noise Haiku is extracting.
- **CONFIDENCE** — tighten or loosen the confidence guidance.
- **IMPORTANCE** — adjust the 0.0–1.0 scale guidance for a specific category.

### Adjust the cosine dedup threshold

In `apps/web/src/lib/memory-conflict.ts`:

```ts
const COSINE_DUP_THRESHOLD = 0.88;
```

Raise this (toward 1.0) to allow more near-duplicate facts through (more recall, more noise). Lower it to collapse more variants into a single row (higher precision, more information loss).

### Adjust the word-overlap thresholds

In `memory-conflict.ts → classifyFactRelationship()`:

```ts
if (overlapRatio >= 0.95) return 'duplicate';  // raise to 0.97 for stricter dedup
if (overlapRatio >= 0.65) return 'conflict';   // lower to 0.55 to catch more contradictions
```

### Add evaluation test cases

Add representative message pairs to `apps/web/src/lib/memory/__tests__/` with `vi.mock` stubs for the DB. Use `extractFromConversation` (the pure extraction function) directly in tests — it takes no DB dependency.

---

## How to debug a missing memory

**When**: a fact was mentioned in a past session but is not appearing in the model's context.

### Step 1 — Confirm extraction ran

Check the server logs for `[memory] extraction failed:` errors after the session in question. If the fact was in a very short message (< 20 chars), it was skipped by the trivial-message guard.

### Step 2 — Query the DB directly

```sql
SELECT id, fact, category, tier, polarity, status, valid_to, decay_at, seen_count, trust
FROM memories
WHERE user_id = '<uuid>'
  AND fact ILIKE '%metformin%'
ORDER BY created_at DESC;
```

Possible findings:

| `valid_to` set | `decay_at` in past | Diagnosis |
|---|---|---|
| Yes | Any | Soft-deleted by conflict resolution or decay cron |
| No | Yes | Decay cron hasn't run yet but will expire it soon |
| No | No | Row exists and is retrievable |

### Step 3 — Check tier and retrieval mode

If the row exists but is tier 3:
- For ConvoMem users (< 30 sessions), only tier-1 facts are returned. The fact won't appear until hybrid retrieval activates.
- For hybrid users, check that `ENABLE_MEMORY_HYBRID` is set correctly.

### Step 4 — Check the embedding column

```sql
SELECT id, fact, embedding IS NOT NULL AS has_embedding
FROM memories
WHERE user_id = '<uuid>' AND fact ILIKE '%metformin%';
```

If `has_embedding` is false, the fact was written before the embedding pipeline was active. It will only be found by the keyword arm of the hybrid CTE, not the vector arm.

### Step 5 — Force hybrid for the user

To test hybrid retrieval without waiting for 30 sessions:

```bash
FORCE_HYBRID_USER_IDS=<uuid>
```

This bypasses the ConvoMem gate for that user ID without touching the session count.

### Step 6 — Check the access log

```sql
SELECT reason, memory_ids, created_at
FROM memory_access_log
WHERE user_id = '<uuid>'
ORDER BY created_at DESC
LIMIT 10;
```

If the memory ID appears in recent `memory_ids` arrays, it was retrieved but may have been truncated by the `TIER1_CAP + limit` cap (13 total). If it never appears, it is not making it past retrieval scoring.

---

## How to roll back the hybrid canary

**When**: you need to disable hybrid retrieval for all users or roll back the canary percentage.

### Turn off for everyone

```bash
ENABLE_MEMORY_HYBRID=false
```

All users fall back to the legacy keyword path (`loadRelevantMemoriesLegacy`). The DB, embeddings, and access logs are unaffected.

### Narrow the canary

```bash
ENABLE_MEMORY_HYBRID=10pct   # reduce from higher percentage — note: only '10pct' is a supported token
```

To use a different percentage, change the gate logic in `apps/web/src/lib/memory/gate.ts`:

```ts
if (v === '5pct') {
  const buf = crypto.createHash('sha256').update(userId).digest();
  return (buf.readUInt32BE(0) % 100) < 5;
}
```

The sha256 bucketing is deterministic: the same user ID always lands in the same bucket, so rollout is stable across restarts.

### Remove a specific user from hybrid

Add their UUID to `FORCE_HYBRID_USER_IDS` with `false` behavior — but note: `FORCE_HYBRID_USER_IDS` forces hybrid **on**, not off. To force a single user off, handle it in `gate.ts` with an explicit exclusion list, or add them to a `DISABLE_HYBRID_USER_IDS` env var and check it first in `hybridEnabledForUser`.

### Roll back the decay cron

The decay cron (`/api/cron/memory-decay`) only sets `valid_to`. It does not hard-delete. To undo a decay run on specific rows:

```sql
UPDATE memories
SET valid_to = NULL
WHERE user_id = '<uuid>'
  AND valid_to > '<cron_run_timestamp>'
  AND decay_at > NOW();   -- only un-expire rows that haven't actually expired yet
```
