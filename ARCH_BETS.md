# CareCompanion — Architectural Bets Review
_Reviewed 2026-05-19 against `aryan/dev` branch_

## The 10 Bets

| # | Bet | Verdict | Evidence | What Stripe/Notion/Cursor would pick |
|---|-----|---------|----------|---------------------------------------|
| 1 | **Aurora Postgres + RDS Data API** | ⚠️ Reconsider | `db/index.ts` uses `drizzle-orm/aws-data-api/pg` + `RDSDataClient`, but `.env.example` lists Supabase vars as primary DB and `supabase/migrations/` has its own migration tree — two DB systems in parallel | Direct Postgres (Neon or Supabase) — no HTTP round-trip overhead per query |
| 2 | **Cognito auth** | ⚠️ Reconsider | `auth.ts` uses NextAuth (Apple/Google/Credentials with bcrypt) — Cognito no longer in the auth path — but `@aws-sdk/client-cognito-identity-provider` still in `package.json`, legacy `cognito_sub` column remains in schema, and `/api/auth/cognito-logout` route exists | Clerk or clean Auth.js — not a half-migrated state |
| 3 | **Anthropic-primary LLM + Google embeddings** | ✅ Still right | All chat/cron routes import `anthropic` from `@ai-sdk/anthropic` (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`); `memory/embed.ts` uses `@ai-sdk/google` (`gemini-embedding-001`) for vectors — smart provider split | Same split (Anthropic for reasoning, best-in-class embedder separately) |
| 4 | **Expo + React Native** | ✅ Still right | `expo ~52`, `expo-router ~4`, `expo-live-activity`, HealthKit FHIR IDs in schema (`healthkitFhirId`); native feature parity with code sharing via `@carecompanion/api` workspace package | Same — native Swift only past $5M ARR with a dedicated iOS team |
| 5 | **Next.js 14 App Router** | ⚠️ Reconsider | Pinned to `next: 14.2.35` — 2 major versions behind; `middleware.ts` present (CLAUDE.md rule 11 already targets Next 16 `proxy.ts`); only 13/73 App Router pages are `'use client'` (strong RSC adoption that needs latest fixes) | Vercel (internally) runs latest Next.js; Next 14 accumulates unpatched CVEs |
| 6 | **Turborepo monorepo** | ✅ Still right | `turbo.json` v2 with proper `env` declarations, bun workspaces for `apps/*` + `packages/*`; clean 3-app + 4-package layout | Linear/Vercel use Turborepo — right call at this scale |
| 7 | **React Context / local state (no global store)** | ✅ Still right | Zero Zustand/Jotai/Redux imports found; 54 `useState`/`useContext` calls in `apps/web/src/app` — all data flows through RSC or server actions | Next.js-first teams avoid global stores until RSC patterns break down |
| 8 | **Drizzle ORM** | ✅ Still right | `drizzle-orm: ^0.45.2` with custom `halfvec` and `tsvector` types; 17 numbered SQL migrations under `lib/db/migrations/`; lightweight for serverless, full pgvector support | Notion/Stripe: Kysely or Drizzle for type-safe raw SQL control; Prisma bundle too heavy |
| 9 | **pgvector on Aurora for memory** | ✅ Still right | `halfvec(768)` columns on `memories` + `conversationSummaries`; hybrid search via `factTsv` tsvector; all PHI stays in one DB boundary — critical for HIPAA BAA | Pinecone only when >10M embeddings; pgvector at this scale avoids a cross-system PHI boundary |
| 10 | **Vercel + AWS** | ✅ Still right | `vercel.json` has 10 cron routes; `@vercel/analytics` in deps; Upstash Redis for rate limiting (serverless-safe); Aurora on AWS for HIPAA BAA | Vercel for Next.js + managed cloud for stateful infra — the default playbook |

---

## Top 3 Pivots to Consider (Next 6 Months)

| Priority | Pivot | Migration Cost | Expected Benefit | Recommendation |
|----------|-------|---------------|------------------|----------------|
| **1** | **Complete Cognito deprecation** — remove `@aws-sdk/client-cognito-identity-provider` dep, drop legacy `cognito_sub` column in a migration, delete `/api/auth/cognito-logout` route | **S** — already 90% done; one migration + dep removal | Eliminates dead security surface; one auth system; cleaner onboarding for new devs | **Do now** — S cost, real security confusion until resolved |
| **2** | **Commit to one DB driver: Aurora RDS Data API _or_ Supabase Postgres** — currently `db/index.ts` uses AWS Data API but `.env.example` and `supabase/migrations/` point to Supabase; two migration trees | **M** — update `db/index.ts` to `drizzle-orm/postgres-js` if Supabase, consolidate migrations, retire one migration system | Removes ~50ms per-query HTTP overhead of RDS Data API; single source of truth for schema; Supabase also gives built-in pgvector, RLS, and realtime | **Do in Q3** — confusion compounds as schema diverges |
| **3** | **Upgrade Next.js 14 → 16** — CLAUDE.md already targets this (rule 11: `proxy.ts` over `middleware.ts`) | **M** — async params/searchParams, middleware → proxy.ts, potential RSC boundary changes | Security patches, PPR (Partial Pre-rendering), stable `use cache`, faster cold starts on Vercel | **Do in Q4** — defer until Pivots 1+2 are clean; but don't let Next 14 run into 2027 |

---

## Verdict

**Bet right on the core stack — ship product. Clean up Cognito ghost and dual-DB drift first.**

The Anthropic+Gemini AI split, Drizzle+pgvector memory layer, Expo mobile, and Vercel+Aurora deploy are all defensible choices with code evidence to back them. The only real risks are half-finished migrations (Cognito, DB driver) that add security surface and developer confusion — those are one sprint of cleanup, not architectural pivots.
