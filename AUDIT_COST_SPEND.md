# Infrastructure Cost Audit & Optimization
**Date:** 2026-05-24 | **Branch:** aryan/dev | **Analyst:** Aryan (AI architect)

---

## Executive Summary

CareCompanion's cost structure is dominated by **Anthropic API spend** (~75–85% of total at every scale tier), with Aurora Serverless v2 and Vercel as secondary drivers. The stack is lean for a HIPAA-compliant oncology app — no unnecessary managed services, no Lambda, no CloudFront, no S3. The primary cost levers are: (1) prompt caching is feature-flagged off, leaving 30–40% Anthropic savings on the table; (2) Aurora ACU floor is unconfigured in-repo and may be set too high; (3) Voyage AI reranking can be eliminated at zero functional cost (RRF fallback already ships); and (4) five cron jobs overlap in scope and could be consolidated to cut Sonnet calls and function invocations.

**Total monthly estimate at current scale (~500 MAU):** $420–$820  
**Total monthly estimate at 10k MAU:** $7,100–$14,200  
**Total monthly estimate at 100k MAU:** $71,000–$140,000

---

## 1. Full Cost Stack

### 1.1 AWS Services

| Service | What It Does | Current $/mo | 10k MAU $/mo | 100k MAU $/mo |
|---|---|---|---|---|
| **Aurora Serverless v2** | Primary Postgres DB via RDS Data API | $50–180 | $180–450 | $1,500–4,000 |
| **AWS SES v2** | PHI-safe transactional email | $0–1 | $5–20 | $50–150 |
| **Secrets Manager** | Aurora credentials secret | $0.40 | $0.40 | $1–5 |
| **Cognito (legacy)** | User pool — deprecated, should be $0 | ~$0 | ~$0 | ~$0 |
| **Total AWS** | | **$51–182** | **$185–471** | **$1,551–4,155** |

**Aurora Serverless v2 detail:**
- Pricing: $0.12/ACU-hour (us-east-1)
- ACU min not set in-repo; if defaulted to **0.5 ACU**: 0.5 × $0.12 × 720h = **$43.20/mo floor**
- If accidentally set to **2 ACU**: 2 × $0.12 × 720h = **$172.80/mo floor** (common mistake)
- Storage: $0.10/GB-month; estimated 5–15 GB at current scale = $0.50–1.50/mo
- I/O: $0.20/million I/O ops; RDS Data API wraps every statement in a transaction, multiplying I/O vs direct connection
- **Critical**: All queries go through `@aws-sdk/client-rds-data` (RDS Data API), which adds 50–200ms per query and inflates I/O costs. At 10k+ MAU, switching to a direct connection + PgBouncer would materially reduce both ACU utilization and I/O charges.

**Cognito note:** `COGNITO_CLIENT_ID/SECRET/DOMAIN/REGION/USER_POOL_ID` remain in `.env.example` and seed scripts. If the user pool is still running (even empty), Cognito charges $0/mo for ≤50k MAU but there is operational risk of dangling resources. Remove and close out the pool.

---

### 1.2 Vercel Platform

| Line Item | Current $/mo | 10k MAU $/mo | 100k MAU $/mo |
|---|---|---|---|
| **Pro plan** | $20 | $20–150 | $150–2,000+ |
| **Function compute overages** | $0 (within Pro limits) | $50–200 | $500–2,000 |
| **Vercel Analytics** | $0 (basic) | $5–20 | $20–100 |
| **Edge middleware** | ~$0 | ~$0 | ~$0 |
| **Total Vercel** | **$20** | **$75–370** | **$670–4,100** |

**Cron job inventory (12 jobs, all Vercel-managed):**

| Cron Path | Schedule | Sonnet calls/run | Est. tokens/run |
|---|---|---|---|
| `/api/cron/radar` | Daily 6am | Up to 20 | ~40k |
| `/api/notifications/generate` | Daily 9am | None (DB only) | 0 |
| `/api/reminders/check` | Daily 10am | None (DB only) | 0 |
| `/api/cron/nadir-alert` | Daily noon | None (DB only) | 0 |
| `/api/cron/nadir-summary` | Daily 1pm | None (DB only) | 0 |
| `/api/cron/trials-match` | Daily 2am | 2–10 (Sonnet) | ~25k |
| `/api/cron/trials-status` | Daily 3am | None (ext API) | 0 |
| `/api/cron/memory-decay` | Daily 3am | None (DB only) | 0 |
| `/api/cron/purge` | Weekly Sun | None (DB only) | 0 |
| `/api/cron/retention` | Weekly Sun | None (DB only) | 0 |
| `/api/cron/memory-eval` | Daily 5am | None (DB only) | 0 |
| `/api/cron/weekly-summary` | Weekly Sun | Up to 200 | ~600k |

**Fluid Compute status:** Already active (`maxDuration = 300` on chat + all AI crons). No migration needed.

**ISR/static:** Only `/conditions/[regimen]` uses `generateStaticParams`. No ISR cost risk.

---

### 1.3 Anthropic Claude

| Model | Routes Using It | Input $/M | Output $/M |
|---|---|---|---|
| `claude-sonnet-4-6` | chat, radar, trials-match, weekly-summary, health-summary, prep, visit-prep, insurance/appeal, triage, drug-interactions, document-extract, orchestrator | $3.00 | $15.00 |
| `claude-haiku-4-5-20251001` | Simple chat messages (fast path), demo mode | $0.80 | $4.00 |

**Per-user token estimate (active user, 10 chat sessions/day):**

| Component | Input tokens/day | Output tokens/day |
|---|---|---|
| System prompt (L1+L2, stable) | ~2,000 | — |
| User context (L3, per-turn) | ~800 | — |
| Memory/retrieved context (L4) | ~1,200 | — |
| Conversation history (last 8) | ~1,500 | — |
| User message | ~150 | — |
| Assistant response | — | ~600 |
| **Per message total** | **~5,650** | **~600** |
| **10 messages/day** | **56,500** | **6,000** |
| **Monthly (30 days)** | **1.70M** | **180k** |

**Monthly AI cost per active user (without prompt caching):** $3.00 × 1.70 + $15.00 × 0.18 = **$5.10 + $2.70 = $7.80/user/month**

**With prompt caching enabled** (L1+L2 ~2,000 tokens cached; 5-min ephemeral TTL):
- Cache read: $0.30/M (10× cheaper than standard)
- In a 5-min window with 1–2 turns: ~50% cache hit rate on stable blocks
- Estimated savings: ~$1.50/user/month → **$6.30/user/month**
- **ENABLE_PROMPT_CACHE is currently feature-flagged off.** Turning it on is pure savings.

**Cron Anthropic spend:**

| Cron | Frequency | Profiles/run | Tokens/run | $/run | $/mo (current) | $/mo (10k MAU) |
|---|---|---|---|---|---|---|
| radar | Daily | 20 | ~40k | $0.18 | $5.40 | $270 |
| weekly-summary | Weekly | 200 | ~600k | $2.70 | $10.80 | $1,080 |
| trials-match | Daily | 2 | ~25k | $0.11 | $3.30 | $165 |

**Total Anthropic cost estimate:**

| Scale | Active users | Chat $/mo | Cron $/mo | Total Anthropic $/mo |
|---|---|---|---|---|
| Current (~500 MAU, ~50 DAU) | 50 | $390 | $20 | **$410** |
| 10k MAU (~1,000 DAU) | 1,000 | $7,800 | $1,515 | **$9,315** |
| 100k MAU (~10,000 DAU) | 10,000 | $78,000 | $15,150 | **$93,150** |

---

### 1.4 Google Vertex AI (Embeddings)

Model: `gemini-embedding-001`, 768 dimensions, halfvec storage.  
Pricing: ~$0.00002/1k characters (Vertex AI embedding API, us-central1).

| Event | Chars/call | Calls/user/day | $/user/month |
|---|---|---|---|
| Memory save (document embed) | ~250 | ~5 | $0.0003 |
| Chat query embed | ~120 | ~10 | $0.0002 |
| Cron batch embeds | ~500 | ~0.5 | $0.0002 |

**Total Vertex AI estimate:**

| Scale | $/mo |
|---|---|
| Current | ~$1 |
| 10k MAU | ~$15 |
| 100k MAU | ~$150 |

The 768-dim `halfvec` is the right call. Full `vector(768)` would use 2× storage (float32 vs float16). No dimension waste here.

---

### 1.5 Voyage AI (Reranking)

Model: `rerank-2.5-lite`. Pricing: $0.05/M tokens.  
Per call: ~query (100 tokens) + 8 candidates × 200 tokens avg = ~1,700 tokens.  
Called on ~60% of non-simple chat messages.

| Scale | Rerank calls/mo | Tokens/mo | $/mo |
|---|---|---|---|
| Current (50 DAU) | ~9,000 | ~15M | **$0.75** |
| 10k MAU | ~180,000 | ~306M | **$15.30** |
| 100k MAU | ~1.8M | ~3.06B | **$153** |

**RRF fallback already implemented** — Voyage can be dropped at zero functional cost (see Kill List).

---

### 1.6 Upstash Redis

Usage: sliding-window rate limiting (IP + user) and read-through cache for API responses.  
Pricing: ~$0.20/100k commands (pay-as-you-go tier).

| Scale | Commands/mo | $/mo |
|---|---|---|
| Current | ~500k | **$1–5** |
| 10k MAU | ~10M | **$20–50** |
| 100k MAU | ~100M | **$200–500** |

Commands per request: ~2 (IP check + user check). Additional cache reads for health summaries.

---

### 1.7 Email Services

| Service | Usage | $/mo (current) | $/mo (10k MAU) | $/mo (100k MAU) |
|---|---|---|---|---|
| **Resend** | Non-PHI: password reset, welcome | $0 (free tier) | $20–80 | $200–400 |
| **AWS SES v2** | PHI: care-team invites, onboarding recap | $0–1 | $5–20 | $50–150 |

At 10k MAU, Resend's free tier (3k emails/month) will be exhausted. Consider routing all email through SES v2 — it has BAA coverage and is cheaper at volume ($0.10/1k vs Resend Pro at ~$0.0025/email).

---

### 1.8 Other Services

| Service | Purpose | $/mo (current) | Notes |
|---|---|---|---|
| **Expo EAS** | Mobile builds | $0–99 | Free tier for small teams; Production needs $99/mo EAS plan |
| **Sentry** | Error tracking | $0 (free tier) | 5k errors/mo; at 10k MAU needs Team plan at $26/mo |
| **Web Push** | Push notifications | $0 | Self-hosted via `web-push`, no third-party cost |
| **OneUp** | FHIR/HealthKit OAuth bridge | Unknown | No pricing found in repo; likely startup-tier pricing |
| **PostHog** | Internal analytics (REPLACED) | $0 | Replaced by `analytics_events` table; env vars remain but no active SDK calls |

**Total estimated monthly spend by scale:**

| Scale | AWS | Vercel | Anthropic | Vertex AI | Voyage AI | Upstash | Other | **Total** |
|---|---|---|---|---|---|---|---|---|
| Current (~500 MAU) | $51–182 | $20 | $410 | $1 | $1 | $3 | $10–100 | **$496–817** |
| 10k MAU | $185–471 | $75–370 | $9,315 | $15 | $15 | $35 | $150–300 | **$9,790–10,521** |
| 100k MAU | $1,551–4,155 | $670–4,100 | $93,150 | $150 | $153 | $350 | $500–2,000 | **$96,524–103,908** |

---

## 2. Aurora Optimization Findings

### 2.1 Missing Indexes — High Impact

The following tables lack an index on `care_profile_id` despite being queried with that predicate on **every chat request** and every radar cron run:

| Table | Missing Index | Impact |
|---|---|---|
| `medications` | `care_profile_id` | Chat route LIMIT 50; radar cron per-profile |
| `appointments` | `care_profile_id` | Chat route LIMIT 50; HealthKit sync |
| `doctors` | `care_profile_id` | Chat route LIMIT 50 |
| `conditions` | `care_profile_id` | HealthKit FHIR ingestion |
| `allergies` | `care_profile_id` | HealthKit FHIR ingestion |
| `procedures` | `care_profile_id` | HealthKit FHIR ingestion |
| `immunizations` | `care_profile_id` | HealthKit FHIR ingestion |
| `push_subscriptions` | `user_id` | Radar cron sends push per-user; only `endpoint` is unique-indexed |
| `care_team_invites` | `invited_email` | Accept-invite flow lookups |

Migration 017 covered the high-traffic audit tables and memories. These seven clinical tables were missed. At 10k MAU with 50 meds/profile, each unindexed query does a full sequential scan of the entire table.

**Add to next migration:**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS medications_care_profile_idx ON medications(care_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS appointments_care_profile_idx ON appointments(care_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS doctors_care_profile_idx ON doctors(care_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS conditions_care_profile_idx ON conditions(care_profile_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS allergies_care_profile_idx ON allergies(care_profile_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS procedures_care_profile_idx ON procedures(care_profile_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS immunizations_care_profile_idx ON immunizations(care_profile_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS care_team_invites_email_idx ON care_team_invites(invited_email);
```

### 2.2 Oversized / Redundant Columns

| Issue | Location | Fix |
|---|---|---|
| `users.cognito_sub` (legacy) | `schema.ts:46` | Migrate `users.providerSub` values → drop column in next cycle |
| `analyticsEvents.id: integer` | `schema.ts:885` | Will overflow at ~2.1B rows; change to `bigint` before 100k MAU |
| `documents` + `scannedDocuments` both exist | `schema.ts:248–588` | `documents` lacks `extractedData`; `scannedDocuments` lacks `documentType`; merge into one table |
| `userPreferences` + `userSettings` are two separate 1:1 user tables | `schema.ts:427–454` | 80% of columns are orthogonal but both tables join on `user_id`; adds a JOIN on every settings read |
| `careGroupInvites` deprecated alongside `careGroupCodes` | `schema.ts:746–755` | Comment says deprecated; drop table and routes after 30-day grace period |

### 2.3 RDS Data API Overhead — Critical at Scale

The entire DB layer routes through `@aws-sdk/client-rds-data` (RDS Data API). This adds:
- 50–200ms per query (HTTP round-trip vs TCP socket)
- Wraps each statement in an implicit transaction (prevents `CREATE INDEX CONCURRENTLY`)
- Cannot use `LISTEN/NOTIFY` or `COPY`
- Multiplies Aurora I/O charges (each HTTP call = multiple internal I/O ops)

At current scale this is acceptable. At 10k MAU with the chat route making 13+ parallel DB queries per request, you are paying for 10k users × 20 requests/day × 13 queries × $0.20/M I/O. **Estimate: $200–400/mo in unnecessary I/O at 10k MAU.**

**Mitigation:** Switch to `postgres` (node-postgres) driver with RDS Proxy or Neon connection pooling. This requires:
1. Enabling RDS Proxy on the Aurora cluster (~$0.015/hour = ~$11/mo, but saves more than that in I/O)
2. Updating `apps/web/src/lib/db/index.ts` to use `drizzle(pool, ...)` instead of `drizzle(rdsClient, ...)`

### 2.4 ACU Floor Recommendation

ACU minimum is not set in-repo; it must be configured in AWS Console. Ensure:
- **Minimum ACU: 0.5** (the lowest available; Aurora will cold-start in ~5s but cost is $43/mo idle vs $173/mo at min 2 ACU)
- **Maximum ACU: 8** for 10k MAU; scale to 32 ACU at 100k MAU
- Enable **RDS Performance Insights** (free for 7-day retention) to monitor actual ACU utilization before committing to a floor

### 2.5 pgvector Configuration

- **768-dim halfvec**: Correct choice. Google's `gemini-embedding-001` natively outputs 768 dimensions; halfvec uses float16 halving storage vs float32 vector. No waste here.
- **HNSW parameters** `(m=16, ef_construction=200)` on both `memories` and `conversation_summaries`: This is more aggressive than needed for <100k rows. At current scale, reduce to `(m=8, ef_construction=64)` to save ~4× memory on the index. Only increase when p50 recall drops below acceptable threshold.
- **`conversation_summaries` HNSW index**: This table is only used for users with >30 sessions. At current user count, this index likely has <1,000 rows total. Keep it but deprioritize.

---

## 3. Vercel Cost Surface

| Pattern | Files/Count | Cost Impact | Status |
|---|---|---|---|
| Fluid Compute (300s timeout) | 6 routes + all AI crons | Required for streaming; Pro plan covers this | Active |
| Edge middleware (`proxy.ts`) | 1 file | Auth checks at edge, ~$0 | Active |
| Static generation (`generateStaticParams`) | 1 page: `/conditions/[regimen]` | Free ISR, good | Active |
| 12 cron jobs | `vercel.json` | Included in Pro; no overage | Active |
| Vercel Analytics | `@vercel/analytics` | Free basic tier | Active |
| Image optimization (`next/image`) | Not explicitly found in scanned routes | No opaque cost | Low risk |

**Fluid Compute migration:** Already done. `maxDuration = 300` is set on all AI routes. No action needed.

**Cron consolidation opportunity:** `nadir-alert` (noon) and `nadir-summary` (1pm) are two daily jobs that both process nadir-window patients. The radar cron (6am) already detects nadir windows and inserts `symptomInsights`. The nadir crons appear to handle push delivery only — consolidating them into the radar cron run would drop 2 daily function invocations and reduce Aurora queries by removing duplicate profile scans.

Similarly, `memory-decay` (3am) and `memory-eval` (5am) are both DB-only operations against the `memories` table. These can be merged into one cron, halving two daily invocations.

---

## 4. Third-Party API Cost Per User

| Service | Cost/active user/month | Notes |
|---|---|---|
| **Anthropic (Sonnet, no caching)** | $7.80 | 10 sessions/day; dominant cost driver |
| **Anthropic (Sonnet, with caching)** | $6.30 | Enable `ENABLE_PROMPT_CACHE=true` |
| **Anthropic (crons, amortized)** | $0.10 | Radar + weekly summary amortized per user |
| **Vertex AI embeddings** | $0.002 | 768-dim halfvec at typical query volume |
| **Voyage AI reranking** | $0.008 | Kill candidate — RRF fallback already exists |
| **Upstash Redis** | $0.005 | Rate limiting + cache; negligible |
| **Resend** | $0.002 | Welcome emails; within free tier for now |
| **Total (with caching)** | **~$6.42/active user/month** | |
| **Total (without caching)** | **~$7.91/active user/month** | |

At 10k MAU with 10% DAU (~1,000 active): **$6,420–7,910/month in API costs alone.**

---

## 5. Top 10 Kill Candidates

Ranked by savings × certainty of safe removal.

| Rank | Candidate | Monthly Savings | Effort | Confidence |
|---|---|---|---|---|
| **1** | **Enable ENABLE_PROMPT_CACHE=true** | $75–1,200 (scales with users) | 1 line (env var) | High |
| **2** | **Remove Voyage AI reranking** | $1–153/mo | 20 min (rm dep + env var; RRF fallback ships) | High |
| **3** | **Consolidate nadir crons** (alert+summary → radar) | $0 now; matters at scale | Medium | High |
| **4** | **Drop `cognito_sub` column + Cognito user pool** | $0 + ops clarity | 1 migration + env cleanup | High |
| **5** | **Switch weekly-summary from Sonnet → Haiku** | $8–860/mo (Haiku is 3.75× cheaper) | 1 line per model call | Medium-High |
| **6** | **Merge memory-decay + memory-eval crons** | Reduced function invocations + DB load | Low | High |
| **7** | **Replace `healthSummaries` DB table with Upstash cache** | Reduces Aurora I/O at scale; rows churn every 24h | Medium | Medium |
| **8** | **Drop `documents` table (merge into scannedDocuments)** | Reduces schema complexity + index maintenance | Medium | Medium |
| **9** | **Replace Resend with SES v2 at scale** | $20–400/mo at 10k+ MAU | Low at scale | High |
| **10** | **Kill `careGroupInvites` table** (deprecated) | Reduces Aurora storage + migration surface | Low | High |

### Kill #1 — Prompt Caching (ENV VAR ONLY)

`ENABLE_PROMPT_CACHE` in `apps/web/src/app/api/chat/route.ts:244` gates ephemeral caching on L1+L2 system prompt blocks (~2,000 tokens). These blocks contain base instructions + user profile and are stable within a session. Cache reads cost $0.30/M vs $3.00/M standard. At 50% cache hit rate on a 10-message session:

- Without caching: 1.70M input × $3.00/M = $5.10/user/month
- With caching: (850k cache read × $0.30/M) + (850k standard × $3.00/M) = $0.26 + $2.55 = $2.81/user/month  
- **Savings: $2.29/user/month** — set `ENABLE_PROMPT_CACHE=true` in Vercel dashboard immediately

### Kill #2 — Voyage AI Reranking

The RRF (Reciprocal Rank Fusion) fallback is already implemented and tested in `apps/web/src/lib/memory/rerank.ts`. When `VOYAGE_API_KEY` is absent or the API times out (600ms), it falls back to RRF order automatically. Voyage `rerank-2.5-lite` adds marginal recall improvement on a small memory corpus (<500 memories/user at current scale). Remove the dependency and unset the API key; revisit when average user has >2,000 memories and retrieval precision becomes measurable.

### Kill #5 — Weekly Summary Sonnet → Haiku

The weekly-summary cron generates human-readable family update narratives. The prompt is structured and the output is warm-prose — Haiku handles this class of task well. Switching `anthropic('claude-sonnet-4-6')` → `anthropic('claude-haiku-4-5-20251001')` in `/api/cron/weekly-summary/route.ts` cuts per-run cost from $2.70 → $0.72. At 10k MAU: saves ~$1,000/month.

---

## 6. Savings Forecast

| Action | Current savings | 10k MAU savings | 100k MAU savings | Effort |
|---|---|---|---|---|
| Enable prompt caching | $75/mo | $2,300/mo | $23,000/mo | Env var |
| Remove Voyage AI | $1/mo | $15/mo | $153/mo | 20 min |
| Consolidate crons (2→1 for nadir, decay+eval) | $0 (scale savings) | $30/mo DB+compute | $300/mo | 2h |
| Switch weekly-summary to Haiku | $8/mo | $1,000/mo | $10,000/mo | 5 min |
| Add 9 missing care_profile_id indexes | 0 $ but faster queries | $400/mo (I/O) | $4,000/mo (I/O) | 30 min |
| Switch DB driver from RDS Data API → direct+pgBouncer | $0 now | $200-400/mo | $2,000-4,000/mo | 2 days |
| Reduce HNSW params (m=16 → m=8 at current scale) | $0 (memory only) | Avoid $50/mo ACU bump | Avoid $500/mo | 5 min |
| Drop Cognito user pool | ~$0 | ~$0 | ~$0 | 1h |
| Route all email through SES v2 | $0 | $20/mo | $200/mo | 4h |
| **Total (quick wins only: caching + Voyage + Haiku)** | **$84/mo** | **$3,315/mo** | **$33,153/mo** | **<1 day** |

---

## 7. Negotiation Leverage — Startup Credits

| Program | Value | Status | Apply At |
|---|---|---|---|
| **AWS Activate Founders** | $5,000 AWS credits, 1yr | Likely unclaimed — no CDK/IaC in repo suggests self-managed infra | aws.amazon.com/activate |
| **AWS Activate Portfolio** | $15,000–100,000 credits | Available with VC backing | aws.amazon.com/activate |
| **Google Cloud for Startups** | Up to $200,000 GCP credits (2yr) | CareCompanion uses Vertex AI — strong eligibility | cloud.google.com/startup |
| **Vercel for Startups** | $500–1,000 Pro credits + upgraded limits | Standard for seed-stage; Vercel actively recruits health-tech | vercel.com/startups |
| **Anthropic Startup Program** | Undisclosed credits/discounts | Not public, but actively offered to health AI companies — email startups@anthropic.com | Direct sales contact |
| **Sentry Startup Program** | 6 months free (Team plan, $26/mo value) | Apply via Sentry's startup portal | sentry.io/for/startups |
| **Upstash** | Free Pro credits via YC/Techstars/Launch House | If affiliated with any accelerator | upstash.com/pricing |

**Priority order:** (1) Google Cloud for Startups first — $200k GCP covers Vertex AI for 2 years at 100k MAU scale. (2) AWS Activate Portfolio — Aurora credits offset the largest infrastructure bill. (3) Anthropic startup program — even a 30% discount on Sonnet pricing is worth $20k+/yr at 10k MAU.

---

## 8. Action Items

**This sprint (< 1 day total):**
- [ ] Set `ENABLE_PROMPT_CACHE=true` in Vercel environment (saves $84–3,315/mo depending on scale)
- [ ] Unset `VOYAGE_API_KEY` in Vercel and remove from `.env.example`
- [ ] Change `/api/cron/weekly-summary/route.ts` model to `claude-haiku-4-5-20251001`
- [ ] Verify Aurora ACU minimum is set to 0.5 in AWS Console

**Next sprint:**
- [ ] Write migration 024 with 9 missing `care_profile_id` / `user_id` indexes
- [ ] Apply via `psql` direct (not RDS Query Editor) using `CONCURRENTLY`
- [ ] Consolidate `nadir-alert` + `nadir-summary` into radar cron
- [ ] Merge `memory-decay` + `memory-eval` crons
- [ ] Apply to Google Cloud for Startups and AWS Activate

**This quarter:**
- [ ] Evaluate RDS Data API → direct Postgres + RDS Proxy migration at 2k+ MAU
- [ ] Migrate all email through SES v2; drop Resend dependency
- [ ] Drop `cognito_sub` column after confirming zero active users have it populated
- [ ] Merge `documents` → `scannedDocuments`; drop old table
- [ ] Change `analyticsEvents.id` from `integer` to `bigint` before hitting 100k MAU
- [ ] Reduce HNSW params from `(m=16, ef_construction=200)` to `(m=8, ef_construction=64)` on both vector indexes

---

*Generated 2026-05-24. All costs are estimates based on public pricing pages and static code analysis. Actual spend will vary with usage patterns, negotiated rates, and AWS/Vercel/Anthropic pricing changes. Re-run this audit at each 10× scale milestone.*
