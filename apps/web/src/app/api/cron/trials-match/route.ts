import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { careProfiles, matchingQueue, trialMatches, notifications } from '@/lib/db/schema'
import { eq, and, lt } from 'drizzle-orm'
import { enqueueMatchingRun, releaseStaleClaimedRows, processMatchingQueueForProfile } from '@/lib/trials/matchingQueue'
import { assembleProfile } from '@/lib/trials/assembleProfile'
import { generateText, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const BATCH_SIZE  = 5
const TIME_BUDGET = 270_000

export async function GET(req: Request) {
  const authError = verifyCronRequest(req)
  if (authError) return authError

  const start = Date.now()
  let processed = 0

  // 1. Release stale claimed rows
  await releaseStaleClaimedRows()

  // 2. Re-queue failed rows with retryCount < 3
  const failed = await db.select({ careProfileId: matchingQueue.careProfileId })
    .from(matchingQueue)
    .where(and(eq(matchingQueue.status, 'failed'), lt(matchingQueue.retryCount, 3)))
  for (const row of failed) {
    await enqueueMatchingRun(row.careProfileId, 'retry')
  }

  // 3. Enqueue all active profiles for nightly run (capped to prevent OOM at scale)
  const profiles = await db.select({ id: careProfiles.id }).from(careProfiles).limit(500)
  for (const p of profiles) {
    await enqueueMatchingRun(p.id, 'nightly')
  }

  // 4. Process queue in batches
  const pending = await db.select({ careProfileId: matchingQueue.careProfileId })
    .from(matchingQueue).where(eq(matchingQueue.status, 'pending'))

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    if (Date.now() - start > TIME_BUDGET) break
    const batch = pending.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(row => processMatchingQueueForProfile(row.careProfileId)))
    processed += batch.length
  }

  // 5. Re-check close trials for gap closure (per profile, not per trial)
  // Limit to 200 rows per run to avoid loading the entire table into memory.
  const closeTrials = await db.select().from(trialMatches)
    .where(eq(trialMatches.matchCategory, 'close'))
    .orderBy(trialMatches.careProfileId)
    .limit(200)
  const byProfile = new Map<string, typeof closeTrials>()
  for (const t of closeTrials) {
    byProfile.set(t.careProfileId, [...(byProfile.get(t.careProfileId) ?? []), t])
  }

  for (const [profileId, trials] of byProfile) {
    if (Date.now() - start > TIME_BUDGET) break
    try {
      const profile = await assembleProfile(profileId)
      const gapCheckPrompt = trials.map(t =>
        `Trial ${t.nctId} "${t.title ?? ''}": gaps = ${JSON.stringify(t.eligibilityGaps)}`
      ).join('\n')

      const GapResolutionSchema = z.object({
        resolved: z.array(z.string()).describe('NCT IDs where all gaps are now resolved based on current profile'),
      })

      const { output } = await generateText({
        model: anthropic('claude-haiku-4-5-20251001'),
        output: Output.object({ schema: GapResolutionSchema }),
        prompt: `Given this patient profile:\n${JSON.stringify(profile, null, 2)}\n\nCheck which trials now have all gaps resolved:\n${gapCheckPrompt}\n\nReturn only NCT IDs where the patient NOW meets all previously blocking criteria.`,
      })

      for (const nctId of output.resolved) {
        const trial = trials.find(t => t.nctId === nctId)
        if (!trial) continue

        await db.update(trialMatches)
          .set({ matchCategory: 'matched', notifiedAt: null, updatedAt: new Date() })
          .where(and(eq(trialMatches.careProfileId, profileId), eq(trialMatches.nctId, nctId)))

        const [cp] = await db.select({ userId: careProfiles.userId })
          .from(careProfiles).where(eq(careProfiles.id, profileId)).limit(1)
        if (cp) {
          await db.insert(notifications).values({
            userId:  cp.userId,
            type:    'trial_gap_closed',
            title:   'You now qualify for a trial you were close to',
            message: `Good news — you now qualify for a trial you were close to: ${trial.title ?? 'a clinical trial'}. Open CareCompanion to view.`,
          })
        }
      }
    } catch { /* skip profile, continue */ }
  }

  return NextResponse.json({ ok: true, processed, elapsed: Date.now() - start })
}
