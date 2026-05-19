# DB Query Performance Review
**Date:** 2026-05-18  
**Scope:** Static code analysis — Aurora PostgreSQL (RDS Data API via Drizzle ORM)  
**Analyst:** Remote agent, read-only

---

## Summary

| Metric | Count |
|---|---|
| Tables audited | 52 |
| Migrations reviewed | 16 (001–016) |
| API routes inspected | 140+ |
| Lib modules reviewed | memory/, chat/, budget.ts, memory-conflict.ts, fhir.ts |
| **Risky query patterns identified** | **15** |
| **Top-priority issues** | **10** |
| N+1 patterns found | 3 |
| Missing indexes (critical) | 11 |

**Overall risk level: MEDIUM-HIGH.** The memory/AI layer is well-indexed (HNSW + GIN from migration 015). The risk is concentrated in: (a) the `memories` table being queried without the `valid_to IS NULL` filter that its partial indexes require, (b) a large number of operational tables (`messages`, `labResults`, `auditLogs`, `wellnessCheckins`, `communityPosts`, `symptomEntries`, `notifications`, `careTeamMembers`) that have **zero indexes beyond their PKs**, and (c) an N+1 pattern in the nightly trial-matching cron that issues up to 500 individual DB round-trips.

---

## Top 10 Risky Queries

### 1. `loadMemories` — bypasses partial index by omitting `valid_to IS NULL` filter
**File:** `apps/web/src/lib/memory/retrieve.ts:81–86`

```ts
const data = await db
  .select(MEMORY_COLS)
  .from(memories)
  .where(whereClause)                         // only eq(userId) or eq(userId) + inArray(category)
  .orderBy(desc(memories.lastReferenced))     // no valid_to IS NULL filter
  .limit(limit);                              // default limit = 150
```

**Why slow:**  
Migration 015 created `memories_user_valid_idx ON memories(user_id) WHERE valid_to IS NULL` specifically to support per-user lookups. Without the `valid_to IS NULL` filter, Postgres cannot use this partial index and must scan **all** memories rows for the user — including closed/historical ones. Additionally, `ORDER BY last_referenced DESC` with `LIMIT 150` forces a sort pass over the full matching row set because `last_referenced` has no supporting index (neither a plain index nor a partial one). Called on every chat request for users in legacy/fallback mode.

**Recommended fix:**  
Add `isNull(memories.validTo)` to the WHERE clause. This unblocks both the existing `memories_user_valid_idx` partial index and a new composite `(user_id, last_referenced DESC) WHERE valid_to IS NULL` index (see Recommended Indexes below).

```ts
const whereClause = categories?.length
  ? and(eq(memories.userId, userId), isNull(memories.validTo), inArray(memories.category, categories))
  : and(eq(memories.userId, userId), isNull(memories.validTo));
```

---

### 2. `loadConversationSummaries` — `db.select()` transfers 1.5 KB embedding per row
**File:** `apps/web/src/lib/memory/retrieve.ts:274–284`

```ts
const data = await db
  .select()                         // SELECT * — fetches embedding halfvec(768)
  .from(conversationSummaries)
  .where(eq(conversationSummaries.userId, userId))
  .orderBy(desc(conversationSummaries.createdAt))
  .limit(limit);                    // default limit = 5
```

**Why slow:**  
`halfvec(768)` = 768 × 2 bytes = 1,536 bytes per row. At limit=5, that is ~7.5 KB of unused vector data transferred per call over the RDS Data API (which serializes to JSON, doubling the size). Contrast with `loadRelevantMemories`, which explicitly defines `MEMORY_COLS` to exclude `embedding`. As the summaries table grows and limit is raised, cost grows linearly. Called on every non-convoMem chat request.

**Recommended fix:**  
Project only the columns needed:

```ts
const data = await db
  .select({
    id: conversationSummaries.id,
    summary: conversationSummaries.summary,
    topics: conversationSummaries.topics,
    messageCount: conversationSummaries.messageCount,
    createdAt: conversationSummaries.createdAt,
  })
  .from(conversationSummaries)
  .where(eq(conversationSummaries.userId, userId))
  .orderBy(desc(conversationSummaries.createdAt))
  .limit(limit);
```

---

### 3. `auditLogs` — full-table scan; no index on `user_id`
**File:** `apps/web/src/app/api/compliance/audit-log/route.ts:28–40`

```ts
const [logs, [{ total }]] = await Promise.all([
  db.select().from(auditLogs)
    .where(eq(auditLogs.userId, user!.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit).offset(offset),
  db.select({ total: count() }).from(auditLogs)
    .where(eq(auditLogs.userId, user!.id)),
])
```

**Why slow:**  
`audit_logs` is an append-only table — every authenticated API call writes a row (`logAudit`). The schema defines no index on `user_id` or `(user_id, created_at)`. At modest scale (10 k API calls/user), both the paginated SELECT and the COUNT(*) are full-table sequential scans. The COUNT(*) cannot be approximated and will grow without bound.

**Recommended fix:**  
```sql
CREATE INDEX CONCURRENTLY audit_logs_user_created_idx
  ON audit_logs(user_id, created_at DESC);
```

---

### 4. N+1 in `cron/trials-match` — 500 sequential `enqueueMatchingRun` calls
**File:** `apps/web/src/app/api/cron/trials-match/route.ts:39–45`

```ts
const profiles = await db
  .select({ id: careProfiles.id })
  .from(careProfiles)
  .where(eq(careProfiles.onboardingCompleted, true))
  .limit(500)

for (const p of profiles) {
  await enqueueMatchingRun(p.id, 'nightly')   // 1 DB upsert per iteration
}
```

**Why slow:**  
`enqueueMatchingRun` performs at minimum one INSERT/ON CONFLICT upsert into `matching_queue` per call. The sequential `await` in the loop means 500 round-trips over the RDS Data API (HTTP-based), each adding ~10–50 ms of network overhead. Total: 5–25 seconds of pure round-trip time before any processing begins. The same pattern repeats for failed-row re-queuing (lines 32–35).

**Recommended fix:**  
Batch-insert all new queue entries in a single upsert:

```ts
if (profiles.length > 0) {
  await db.insert(matchingQueue)
    .values(profiles.map(p => ({ careProfileId: p.id, reason: 'nightly', status: 'pending' })))
    .onConflictDoNothing();
}
```

---

### 5. `wellnessCheckins` range filter — no index on `checked_in_at`
**File:** `apps/web/src/app/api/export/pdf/route.ts:69–71`

```ts
db.select().from(wellnessCheckins)
  .where(and(
    eq(wellnessCheckins.careProfileId, profile.id),
    gte(wellnessCheckins.checkedInAt, sinceDate)   // range filter, no index
  ))
  .orderBy(desc(wellnessCheckins.checkedInAt))
  .limit(100)
```

**Why slow:**  
`wellness_checkins` has no index defined in schema.ts beyond its PK. Filtering by `care_profile_id` AND `checked_in_at >= sinceDate` forces Postgres to read all rows for the care profile and then filter by date — the join with `care_profile_id` itself has no index either. Same pattern affects `symptom_insights` (`created_at` range, line 72–74) and `reminder_logs` (`scheduled_time` range, lines 75–77). These three tables are scanned sequentially in every PDF export.

**Recommended fix:**  
```sql
CREATE INDEX CONCURRENTLY wellness_checkins_profile_time_idx
  ON wellness_checkins(care_profile_id, checked_in_at DESC);

CREATE INDEX CONCURRENTLY symptom_insights_profile_time_idx
  ON symptom_insights(care_profile_id, created_at DESC);

CREATE INDEX CONCURRENTLY reminder_logs_user_time_idx
  ON reminder_logs(user_id, scheduled_time DESC);
```

---

### 6. `messages` table — no index on `user_id`; COUNT(*) on every chat
**File:** `apps/web/src/app/api/chat/route.ts:192–195`

```ts
const [{ msgCount }] = await db
  .select({ msgCount: sql<number>`count(*)` })
  .from(messages)
  .where(eq(messages.userId, dbUser!.id));
```

**Why slow:**  
`messages` is a high-write table (2 inserts per chat turn: user message + assistant response). The schema defines no index on `user_id`. Every chat request issues a `COUNT(*)` over ALL messages for the user to decide whether to trigger summarization — a sequential scan that grows with every conversation. At 500 messages/user this adds ~5–20 ms; at 5,000 it becomes tens of milliseconds on a cold Aurora instance.

**Recommended fix:**  
```sql
CREATE INDEX CONCURRENTLY messages_user_created_idx
  ON messages(user_id, created_at DESC);
```

Additionally, consider persisting the message count in `user_preferences` or using a separate counter table to avoid the COUNT(*) on the hot path.

---

### 7. `communityPosts` — `ORDER BY isPinned DESC, createdAt DESC` with no index
**File:** `apps/web/src/app/api/community/route.ts:45–62`

```ts
const posts = await db
  .select({ ... })
  .from(communityPosts)
  .where(where)                    // isModerated = false [+ cancerType filter]
  .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
  .limit(limit).offset(offset);
```

**Why slow:**  
`community_posts` has no indexes at all in schema.ts beyond the PK. The query filters `is_moderated = false` (majority of rows will match) and then sorts by `(is_pinned DESC, created_at DESC)`. Without a compound index, Postgres must sort the full unmoderated set on each page load. Pinned posts are rare (boolean), so a partial index covering only unmoderated posts sorted by date would serve most requests.

**Recommended fix:**  
```sql
CREATE INDEX CONCURRENTLY community_posts_feed_idx
  ON community_posts(cancer_type, created_at DESC)
  WHERE is_moderated = false;

CREATE INDEX CONCURRENTLY community_posts_pinned_feed_idx
  ON community_posts(is_pinned DESC, created_at DESC)
  WHERE is_moderated = false;
```

---

### 8. `memory-decay cron` — full scan of `memories` on `decay_at`
**File:** `apps/web/src/app/api/cron/memory-decay/route.ts:18–25`

```sql
UPDATE memories
SET valid_to = NOW()
WHERE decay_at IS NOT NULL
  AND decay_at < NOW()
  AND valid_to IS NULL
```

**Why slow:**  
`memories` is the largest table in the system. No index exists on `decay_at`. The partial index `memories_user_valid_idx (user_id) WHERE valid_to IS NULL` can help filter the `valid_to IS NULL` predicate, but without an index on `decay_at`, Postgres must evaluate `decay_at < NOW()` row-by-row across the entire active memories set. As memories accumulate (potentially 100 k+ rows), this UPDATE becomes a multi-second scan every time the cron fires.

**Recommended fix:**  
```sql
CREATE INDEX CONCURRENTLY memories_decay_at_idx
  ON memories(decay_at)
  WHERE decay_at IS NOT NULL AND valid_to IS NULL;
```

---

### 9. `findCosineDuplicate` — HNSW scan without user-scoping; per-fact loop
**File:** `apps/web/src/lib/memory-conflict.ts:31–40` and `apps/web/src/lib/memory/extract.ts:184–186`

```sql
SELECT id, 1 - (embedding <=> $1::halfvec) AS similarity
FROM memories
WHERE user_id = $2 AND category = $3 AND valid_to IS NULL AND embedding IS NOT NULL
ORDER BY embedding <=> $1::halfvec
LIMIT 1
```

Called per extracted fact in a sequential for-loop:

```ts
for (let i = 0; i < factsAfterWordOverlap.length; i++) {
  const { duplicateId } = await findCosineDuplicate(userId, f.category, embeddingLit);
  // ...possibly insert
}
```

**Why slow (two issues):**  
(a) The global HNSW index `memories_embedding_idx` covers all users. When pgvector uses HNSW it cannot efficiently pre-filter by `user_id + category` — it scans the index globally and post-filters, meaning it traverses neighbours from many other users before finding the user's memories. (b) Each `findCosineDuplicate` call is a separate DB round-trip. Extracting 5 facts creates 5 sequential round-trips (each ~15–40 ms over RDS Data API).

**Recommended fix:**  
Short-term: batch the duplicate check by fetching the top-k neighbours for the user once, then checking all facts in memory. Long-term: use a per-user IVFFlat index or consider a two-phase approach (word-overlap dedup first, vector dedup only on near-miss candidates).

---

### 10. `labResults` and `symptomEntries` — no composite index on `(user_id, date DESC)`
**File:** `apps/web/src/app/api/chat/route.ts:148, 172`

```ts
db.select().from(labResults)
  .where(eq(labResults.userId, dbUser!.id))
  .orderBy(desc(labResults.dateTaken))
  .limit(20)

db.select().from(symptomEntries)
  .where(eq(symptomEntries.userId, dbUser!.id))
  .orderBy(desc(symptomEntries.date))
  .limit(14)
```

**Why slow:**  
Neither `lab_results` nor `symptom_entries` has an index beyond the PK. Both are queried with `user_id` equality and `ORDER BY date DESC LIMIT n` — a pattern that requires scanning all rows for the user and sorting before truncating. These two queries fire on **every chat request** (inside the `Promise.all` at line 144). At 200 lab results and 500 symptom entries per user, each scan costs meaningful I/O.

**Recommended fix:**  
```sql
CREATE INDEX CONCURRENTLY lab_results_user_date_idx
  ON lab_results(user_id, date_taken DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY symptom_entries_user_date_idx
  ON symptom_entries(user_id, date DESC);
```

---

## Recommended New Indexes (NOT applied)

All statements use `CONCURRENTLY` to avoid table locks in production. Apply via `psql` (not RDS Data API, which cannot run CONCURRENTLY inside its implicit transactions).

```sql
-- 1. memories: support loadMemories ORDER BY after adding valid_to IS NULL filter
CREATE INDEX CONCURRENTLY memories_user_lastref_idx
  ON memories(user_id, last_referenced DESC)
  WHERE valid_to IS NULL;

-- 2. audit_logs: user compliance queries + COUNT
CREATE INDEX CONCURRENTLY audit_logs_user_created_idx
  ON audit_logs(user_id, created_at DESC);

-- 3. messages: COUNT(*) and history lookups
CREATE INDEX CONCURRENTLY messages_user_created_idx
  ON messages(user_id, created_at DESC);

-- 4. lab_results: chat + health-summary ordered fetch
CREATE INDEX CONCURRENTLY lab_results_user_date_idx
  ON lab_results(user_id, date_taken DESC)
  WHERE deleted_at IS NULL;

-- 5. symptom_entries: chat ordered fetch
CREATE INDEX CONCURRENTLY symptom_entries_user_date_idx
  ON symptom_entries(user_id, date DESC);

-- 6. wellness_checkins: PDF export range + ordering
CREATE INDEX CONCURRENTLY wellness_checkins_profile_time_idx
  ON wellness_checkins(care_profile_id, checked_in_at DESC);

-- 7. symptom_insights: PDF export range + ordering
CREATE INDEX CONCURRENTLY symptom_insights_profile_time_idx
  ON symptom_insights(care_profile_id, created_at DESC);

-- 8. reminder_logs: PDF export range filter
CREATE INDEX CONCURRENTLY reminder_logs_user_time_idx
  ON reminder_logs(user_id, scheduled_time DESC);

-- 9. memories: cron decay scan
CREATE INDEX CONCURRENTLY memories_decay_at_idx
  ON memories(decay_at)
  WHERE decay_at IS NOT NULL AND valid_to IS NULL;

-- 10. community_posts: feed ordering with moderation filter
CREATE INDEX CONCURRENTLY community_posts_feed_idx
  ON community_posts(cancer_type, created_at DESC)
  WHERE is_moderated = false;

CREATE INDEX CONCURRENTLY community_posts_pinned_feed_idx
  ON community_posts(is_pinned DESC, created_at DESC)
  WHERE is_moderated = false;

-- 11. care_team_members: per-profile member lookups
CREATE INDEX CONCURRENTLY care_team_members_profile_idx
  ON care_team_members(care_profile_id);

-- 12. notifications: user unread feed (used in chat Promise.all)
CREATE INDEX CONCURRENTLY notifications_user_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE is_read = false AND deleted_at IS NULL;
```

---

## N+1 Patterns

### N+1-A: `cron/trials-match` — 500 sequential upserts into `matching_queue`
**File:** `apps/web/src/app/api/cron/trials-match/route.ts:39–45`

```ts
for (const p of profiles) {         // up to 500 profiles
  await enqueueMatchingRun(p.id, 'nightly')  // 1 upsert each
}
```

Severity: **High** — runs every night; adds 5–25 s of pure DB round-trip overhead before any matching begins.

### N+1-B: `cron/trials-match` — `assembleProfile` inside per-profile loop
**File:** `apps/web/src/app/api/cron/trials-match/route.ts:69–107`

```ts
for (const [profileId, trials] of byProfile) {   // up to ~200 profiles
  const profile = await assembleProfile(profileId) // multiple DB queries each
  // ...
}
```

`assembleProfile` issues multiple queries per call (care profile + mutations + treatment cycles). At 200 profiles per run, this is 400–600 individual DB queries in sequence.

Severity: **Medium** — cron is not latency-sensitive, but it risks hitting the 300 s `maxDuration` timeout and causing retry storms.

### N+1-C: `memory/extract.ts` — per-fact `findCosineDuplicate` in sequential loop
**File:** `apps/web/src/lib/memory/extract.ts:180–208`

```ts
for (let i = 0; i < factsAfterWordOverlap.length; i++) {
  const { duplicateId } = await findCosineDuplicate(...)  // vector search round-trip
  if (duplicateId) {
    await bumpSeenCount(duplicateId)                      // update round-trip
    continue;
  }
  await db.execute(sql`INSERT INTO memories ...`)         // insert round-trip
}
```

For 5 extracted facts: up to 10 sequential DB round-trips. Each costs ~15–40 ms via RDS Data API.

Severity: **Low-Medium** — runs as a fire-and-forget background task after each chat response, so it does not block the streaming response. However, it increases Aurora compute load and can delay the next chat's cold-start.

---

## Estimated Impact

| Issue | Table | Rows Scanned (P50 user) | Rows Returned | Scan Type |
|---|---|---|---|---|
| `loadMemories` missing valid_to filter | memories | 500–2,000 (all-time) | 150 | Full user scan → sort |
| `loadConversationSummaries` SELECT * | conversation_summaries | 20–100 | 5 | Sequential + embedding transfer |
| `auditLogs` no user_id index | audit_logs | 10,000–100,000 | 50–100 | Sequential scan |
| N+1 enqueue loop | matching_queue | N/A | N/A | 500 round-trips |
| `wellnessCheckins` range, no index | wellness_checkins | 200–1,000 | 100 | Sequential scan |
| `messages` COUNT(*) | messages | 500–5,000 | 1 | Sequential scan per chat |
| `communityPosts` no feed index | community_posts | 1,000–10,000 | 20–50 | Sequential scan + sort |
| `memories` decay cron, no decay_at idx | memories | 50,000–500,000 | varies | Full active-memories scan |
| `findCosineDuplicate` global HNSW | memories | All users | 1 | HNSW global + post-filter |
| `labResults` no composite index | lab_results | 100–500 | 20 | Sequential scan + sort |
| `symptomEntries` no composite index | symptom_entries | 200–1,000 | 14 | Sequential scan + sort |

**Highest throughput risk:** `auditLogs` (append-only, no index), `memories` decay cron (largest table, nightly full scan), and the `messages` COUNT(*) (fired on every chat request across all active users simultaneously).

**Highest latency risk:** the N+1 enqueue loop (blocking cron start), `findCosineDuplicate` loop (sequential vector round-trips on write path), and `loadMemories` sort without index (adds 10–50 ms to every chat request once user memory grows past ~1,000 rows).
