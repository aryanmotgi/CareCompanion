# HIPAA migration runbook — memory embeddings

**Trigger:** First paying user signs up. Until then, Gemini embeddings are
acceptable for pre-launch eval / dogfooding.

**Goal:** Swap embedding provider from Google Gemini → AWS Bedrock Cohere
Embed v4 (HIPAA-eligible under AWS BAA) with zero downtime and a 7-day
rollback window.

## Pre-flight

- [ ] AWS BAA executed (Business Associate Addendum)
- [ ] Anthropic BAA executed
- [ ] Bedrock model access requested + granted: **Cohere Embed v4** in
      target region (us-east-1 or us-west-2)
- [ ] Confirm Cohere Embed v4 dimension policy (default 1536; Matryoshka
      supports 256 / 512 / 1024). **Pick 768** to preserve current `halfvec(768)`
      schema. Set `output_dimension: 768` on every embed call.
      Alternative: alter column dimension + re-backfill all rows (expensive —
      ~$30+ at scale; skip unless quality demands it).

## Code swap

- [ ] `apps/web/src/lib/memory/embed.ts`: replace `createGoogleGenerativeAI`
      with the Bedrock provider client. Example shape:

      ```ts
      import { bedrock } from '@ai-sdk/amazon-bedrock';
      import { embed } from 'ai';

      const MODEL = 'cohere.embed-english-v4:0';

      export async function embedText(text: string): Promise<number[]> {
        const { embedding } = await embed({
          model: bedrock.textEmbeddingModel(MODEL),
          value: text,
          providerOptions: { bedrock: { outputDimension: 768, inputType: 'search_document' } },
        });
        assertFiniteVector(embedding);
        return embedding;
      }
      // embedQuery: inputType: 'search_query'
      ```

- [ ] Wrap the swap behind feature flag `EMBEDDING_PROVIDER=bedrock`. When
      unset (or `=gemini`), keep current Gemini path. Switch is atomic.

## Backfill

- [ ] Run `apps/web/scripts/backfill-embeddings.ts` under Bedrock credentials
      to re-embed every `memories` row. Idempotent — re-runs continue from
      where embeddings differ.
- [ ] Verify row count: `SELECT count(*) FROM memories WHERE embedding IS NULL` = 0.
- [ ] Spot-check 10 rows: cosine similarity to a known query should remain
      semantically sensible.

## Cutover

- [ ] Off-hours: set `EMBEDDING_PROVIDER=bedrock` in Vercel production.
- [ ] Redeploy `vercel --prod --archive=tgz`.
- [ ] Run `npm run eval:memory` against prod data snapshot — `avgRecall`
      should be ≥ pre-cutover baseline minus 5pt. Larger drop → roll back.

## Rollback (7-day window)

- [ ] Keep Gemini-embedded copies of every row in `memories_embeddings_gemini`
      (or git-tracked snapshot) until 7-day soak passes with no regressions.
- [ ] Unset `EMBEDDING_PROVIDER=bedrock`. Redeploy. Re-run backfill against
      stored Gemini vectors (idempotent).

## Audit + encryption invariants (verify present before launch, not part of swap)

- [ ] `memory_access_log` retention policy meets HIPAA: **6 years** minimum.
      Currently no automated pruning — confirm acceptable.
- [ ] Aurora cluster has KMS-encrypted storage at rest (default for new
      clusters; verify via `aws rds describe-db-clusters`).
- [ ] No PHI in Vercel environment variables. Grep production env for any
      patient identifier before sign-off.
- [ ] Audit log writes are fail-loud (already enforced in
      `apps/web/src/lib/memory/retrieve.ts` — `logAccess` throws on failure).

## Sign-off

- [ ] All checklist items above complete
- [ ] 7-day soak with `EMBEDDING_PROVIDER=bedrock` in prod, no rollback
- [ ] Drop Gemini API key from Vercel env (cleanup)
- [ ] Delete `memories_embeddings_gemini` rollback table
