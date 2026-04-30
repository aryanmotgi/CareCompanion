import { db } from '@/lib/db'
import { matchingQueue, trialMatches, notifications, careProfiles } from '@/lib/db/schema'
import { eq, and, isNull, lt, sql } from 'drizzle-orm'
import { assembleProfile } from './assembleProfile'
import { runTrialsAgent } from './clinicalTrialsAgent'

export async function enqueueMatchingRun(
  careProfileId: string,
  reason: 'profile_update' | 'new_medication' | 'new_lab' | 'nightly' | 'retry'
): Promise<void> {
  await db.insert(matchingQueue)
    .values({ careProfileId, reason, status: 'pending' })
    .onConflictDoNothing()
}

export async function releaseStaleClaimedRows(): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  await db.update(matchingQueue)
    .set({ status: 'pending', claimedAt: null })
    .where(and(eq(matchingQueue.status, 'claimed'), lt(matchingQueue.claimedAt!, tenMinutesAgo)))
}

async function claimQueueRow(careProfileId: string): Promise<string | null> {
  const rows = await db.update(matchingQueue)
    .set({ status: 'claimed', claimedAt: new Date() })
    .where(and(eq(matchingQueue.careProfileId, careProfileId), eq(matchingQueue.status, 'pending')))
    .returning({ id: matchingQueue.id })
  return rows[0]?.id ?? null
}

export async function processMatchingQueueForProfile(careProfileId: string): Promise<void> {
  const rowId = await claimQueueRow(careProfileId)
  if (!rowId) return

  try {
    const profile = await assembleProfile(careProfileId)
    const { matched, close } = await runTrialsAgent(profile)

    for (const trial of matched) {
      await db.insert(trialMatches)
        .values({
          careProfileId,
          nctId:                trial.nctId,
          title:                trial.title,
          matchCategory:        'matched',
          matchScore:           trial.matchScore,
          matchReasons:         trial.matchReasons,
          disqualifyingFactors: trial.disqualifyingFactors,
          uncertainFactors:     trial.uncertainFactors,
          eligibilityGaps:      null,
          enrollmentStatus:     trial.enrollmentStatus,
          locations:            trial.locations,
          trialUrl:             trial.trialUrl,
          updatedAt:            new Date(),
        })
        .onConflictDoUpdate({
          target: [trialMatches.careProfileId, trialMatches.nctId],
          set: {
            title:                trial.title,
            matchCategory:        'matched',
            matchScore:           trial.matchScore,
            matchReasons:         trial.matchReasons,
            disqualifyingFactors: trial.disqualifyingFactors,
            uncertainFactors:     trial.uncertainFactors,
            eligibilityGaps:      null,
            enrollmentStatus:     trial.enrollmentStatus,
            locations:            trial.locations,
            trialUrl:             trial.trialUrl,
            updatedAt:            new Date(),
            lastCheckedAt:        new Date(),
          },
        })
    }

    for (const trial of close) {
      await db.insert(trialMatches)
        .values({
          careProfileId,
          nctId:                trial.nctId,
          title:                trial.title,
          matchCategory:        'close',
          matchScore:           trial.matchScore,
          matchReasons:         trial.matchReasons,
          disqualifyingFactors: trial.disqualifyingFactors,
          uncertainFactors:     trial.uncertainFactors,
          eligibilityGaps:      trial.eligibilityGaps,
          enrollmentStatus:     trial.enrollmentStatus,
          locations:            trial.locations,
          trialUrl:             trial.trialUrl,
          updatedAt:            new Date(),
        })
        .onConflictDoUpdate({
          target: [trialMatches.careProfileId, trialMatches.nctId],
          set: {
            title:                trial.title,
            matchCategory:        'close',
            matchScore:           trial.matchScore,
            matchReasons:         trial.matchReasons,
            disqualifyingFactors: trial.disqualifyingFactors,
            uncertainFactors:     trial.uncertainFactors,
            eligibilityGaps:      trial.eligibilityGaps,
            enrollmentStatus:     trial.enrollmentStatus,
            locations:            trial.locations,
            trialUrl:             trial.trialUrl,
            updatedAt:            new Date(),
            lastCheckedAt:        new Date(),
          },
        })
    }

    // Notify on new unnotified matches
    const newMatches = await db.select()
      .from(trialMatches)
      .where(and(eq(trialMatches.careProfileId, careProfileId), isNull(trialMatches.notifiedAt)))

    if (newMatches.length > 0) {
      const [cp] = await db.select({ userId: careProfiles.userId })
        .from(careProfiles).where(eq(careProfiles.id, careProfileId)).limit(1)

      if (cp) {
        const hasMatched = newMatches.some(m => m.matchCategory === 'matched')
        const hasClose   = newMatches.some(m => m.matchCategory === 'close')

        if (hasMatched) {
          await db.insert(notifications).values({
            userId:  cp.userId,
            type:    'trial_match',
            title:   'New trial matches available',
            message: 'New trial matches are available. Open CareCompanion to view.',
          })
        } else if (hasClose) {
          await db.insert(notifications).values({
            userId:  cp.userId,
            type:    'trial_close',
            title:   "You're close to qualifying for new trials",
            message: "You're close to qualifying for new trials. Open CareCompanion to see what's changed.",
          })
        }

        await db.update(trialMatches)
          .set({ notifiedAt: new Date() })
          .where(and(eq(trialMatches.careProfileId, careProfileId), isNull(trialMatches.notifiedAt)))
      }
    }

    await db.update(matchingQueue)
      .set({ status: 'completed', processedAt: new Date() })
      .where(eq(matchingQueue.id, rowId))

  } catch (err) {
    await db.update(matchingQueue)
      .set({
        status:       'failed',
        errorMessage: (err as Error).message,
        retryCount:   sql`${matchingQueue.retryCount} + 1`,
      })
      .where(eq(matchingQueue.id, rowId))
  }
}
