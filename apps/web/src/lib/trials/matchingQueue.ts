import { db } from '@/lib/db'
import { matchingQueue, trialMatches, notifications, careProfiles } from '@/lib/db/schema'
import { eq, and, isNull, lt, gt, sql } from 'drizzle-orm'
import { assembleProfile } from './assembleProfile'
import { runTrialsAgent, type TrialMatchResult } from './clinicalTrialsAgent'
import type { EligibilityGap } from './assembleProfile'

export async function enqueueMatchingRun(
  careProfileId: string,
  reason: 'profile_update' | 'new_medication' | 'new_lab' | 'nightly' | 'retry'
): Promise<void> {
  // UPDATE first: reset any pending/claimed row so trigger runs are never silently dropped
  // when the nightly cron has a row claimed. If updated, we're done.
  const updated = await db.update(matchingQueue)
    .set({ status: 'pending', reason, claimedAt: null })
    .where(and(
      eq(matchingQueue.careProfileId, careProfileId),
      sql`${matchingQueue.status} IN ('pending', 'claimed')`
    ))
    .returning({ id: matchingQueue.id })

  if (updated.length === 0) {
    // No active row exists — insert fresh. onConflictDoNothing guards against a concurrent insert.
    await db.insert(matchingQueue)
      .values({ careProfileId, reason, status: 'pending' })
      .onConflictDoNothing()
  }
}

// Fire-and-forget helper for trigger sites. Waits 2s after enqueue before
// processing so back-to-back triggers don't send simultaneous Claude calls.
export async function triggerMatchingRun(
  careProfileId: string,
  reason: 'profile_update' | 'new_medication' | 'new_lab' | 'nightly' | 'retry'
): Promise<void> {
  await enqueueMatchingRun(careProfileId, reason)
  await new Promise(resolve => setTimeout(resolve, 2000))
  await processMatchingQueueForProfile(careProfileId)
}

export async function releaseStaleClaimedRows(): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  await db.update(matchingQueue)
    .set({ status: 'pending', claimedAt: null })
    .where(and(eq(matchingQueue.status, 'claimed'), lt(matchingQueue.claimedAt!, tenMinutesAgo)))
}

// Shared upsert logic — used by both the live /api/trials/match route and the background queue.
// Also handles D4 gap closure alerts: when a trial moves from 'close' → 'matched', fires a
// specific notification naming the gap that was resolved.
export async function saveMatchResults(
  careProfileId: string,
  matched: TrialMatchResult[],
  close: TrialMatchResult[],
): Promise<void> {
  // Snapshot existing matches to detect close→matched transitions for gap closure alerts.
  const existing = await db.select({
    nctId:           trialMatches.nctId,
    matchCategory:   trialMatches.matchCategory,
    eligibilityGaps: trialMatches.eligibilityGaps,
    title:           trialMatches.title,
  }).from(trialMatches).where(eq(trialMatches.careProfileId, careProfileId))
  const existingMap = new Map(existing.map(r => [r.nctId, r]))

  const upsertTrial = async (trial: TrialMatchResult, category: 'matched' | 'close') => {
    const gaps = category === 'close' ? trial.eligibilityGaps : null
    await db.insert(trialMatches)
      .values({
        careProfileId,
        nctId:                trial.nctId,
        title:                trial.title,
        matchCategory:        category,
        matchScore:           trial.matchScore,
        matchReasons:         trial.matchReasons,
        disqualifyingFactors: trial.disqualifyingFactors,
        uncertainFactors:     trial.uncertainFactors,
        eligibilityGaps:      gaps,
        phase:                trial.phase,
        enrollmentStatus:     trial.enrollmentStatus,
        locations:            trial.locations,
        trialUrl:             trial.trialUrl,
        updatedAt:            new Date(),
      })
      .onConflictDoUpdate({
        target: [trialMatches.careProfileId, trialMatches.nctId],
        set: {
          title:                trial.title,
          matchCategory:        category,
          matchScore:           trial.matchScore,
          matchReasons:         trial.matchReasons,
          disqualifyingFactors: trial.disqualifyingFactors,
          uncertainFactors:     trial.uncertainFactors,
          eligibilityGaps:      gaps,
          phase:                trial.phase,
          enrollmentStatus:     trial.enrollmentStatus,
          locations:            trial.locations,
          trialUrl:             trial.trialUrl,
          updatedAt:            new Date(),
          lastCheckedAt:        new Date(),
        },
      })
  }

  await Promise.all([
    ...matched.map(t => upsertTrial(t, 'matched')),
    ...close.map(t => upsertTrial(t, 'close')),
  ])

  // Gap closure alerts — specific message naming the resolved gap.
  const closedGapTrials = matched.filter(t => existingMap.get(t.nctId)?.matchCategory === 'close')
  if (closedGapTrials.length > 0) {
    const [cp] = await db.select({ userId: careProfiles.userId })
      .from(careProfiles).where(eq(careProfiles.id, careProfileId)).limit(1)
    if (cp) {
      await Promise.all(closedGapTrials.map(async trial => {
        // Deduplicate: skip if a gap_closed notification for this trial was sent in the last 24h
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const [recent] = await db.select({ id: notifications.id })
          .from(notifications)
          .where(and(
            eq(notifications.userId, cp.userId),
            eq(notifications.type, 'trial_gap_closed'),
            sql`${notifications.message} LIKE ${'%' + trial.nctId + '%'}`,
            gt(notifications.createdAt, since24h),
          ))
          .limit(1)
        if (recent) return // already notified recently

        const prev    = existingMap.get(trial.nctId)
        const gaps    = (prev?.eligibilityGaps as EligibilityGap[] | null) ?? []
        const gapDesc = gaps[0]?.description ?? 'an eligibility criterion'
        await db.insert(notifications).values({
          userId:  cp.userId,
          type:    'trial_gap_closed',
          title:   'You may now qualify for a trial',
          message: `${trial.title} (${trial.nctId}) — ${gapDesc} has been met. Open CareCompanion to review.`,
        }).catch(err => console.error('[trials] gap-closed notification failed:', err))
      }))
    }
  }

  // Per-trial notifications for brand-new unnotified matches.
  const newUnnotified = await db.select({
    id:            trialMatches.id,
    nctId:         trialMatches.nctId,
    title:         trialMatches.title,
    matchCategory: trialMatches.matchCategory,
    matchScore:    trialMatches.matchScore,
    matchReasons:  trialMatches.matchReasons,
    phase:         trialMatches.phase,
  }).from(trialMatches)
    .where(and(eq(trialMatches.careProfileId, careProfileId), isNull(trialMatches.notifiedAt)))

  if (newUnnotified.length > 0) {
    const [cp] = await db.select({ userId: careProfiles.userId })
      .from(careProfiles).where(eq(careProfiles.id, careProfileId)).limit(1)

    if (cp) {
      const highScoreMatches = newUnnotified
        .filter(m => m.matchCategory === 'matched' && (m.matchScore ?? 0) >= 70)
        .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
        .slice(0, 3) // cap at 3 specific notifications per run

      const hasLowScoreMatch = newUnnotified.some(m => m.matchCategory === 'matched' && (m.matchScore ?? 0) < 70)
      const hasClose         = newUnnotified.some(m => m.matchCategory === 'close')

      // Specific notification per high-score match (score ≥ 70)
      for (const trial of highScoreMatches) {
        const { title, message } = buildMatchNotification(trial)
        await db.insert(notifications).values({
          userId:  cp.userId,
          type:    'trial_match',
          title,
          message,
        }).catch(() => {})
      }

      // One generic notification if there are low-score matched trials and no high-score ones
      if (highScoreMatches.length === 0 && hasLowScoreMatch) {
        await db.insert(notifications).values({
          userId:  cp.userId,
          type:    'trial_match',
          title:   'New trial matches available',
          message: 'New trial matches are available. Open CareCompanion to review.',
        }).catch(() => {})
      }

      // One generic notification for close trials
      if (hasClose && highScoreMatches.length === 0 && !hasLowScoreMatch) {
        await db.insert(notifications).values({
          userId:  cp.userId,
          type:    'trial_close',
          title:   "You're close to qualifying for new trials",
          message: "You're close to qualifying for new trials. Open CareCompanion to see what's changed.",
        }).catch(() => {})
      }

      await db.update(trialMatches)
        .set({ notifiedAt: new Date() })
        .where(and(eq(trialMatches.careProfileId, careProfileId), isNull(trialMatches.notifiedAt)))
    }
  }
}

function buildMatchNotification(trial: {
  nctId:        string | null
  title:        string | null
  matchScore:   number | null
  matchReasons: unknown
  phase:        string | null
}): { title: string; message: string } {
  const phase      = trial.phase ? trial.phase.replace(/PHASE\s*/i, 'Phase ') : 'New'
  const notifTitle = `${phase} trial match found`
  const nctRef     = `Ask your oncologist about ${trial.nctId ?? 'this trial'}.`
  const reasons    = Array.isArray(trial.matchReasons) ? (trial.matchReasons as string[]) : []
  // matchReasons[0] is whyItMatches (set by clinicalTrialsAgent mapper)
  const topReason  = reasons[0] ?? trial.title ?? 'A clinical trial may be a strong fit'
  const budget     = 120 - nctRef.length - 1
  const truncated  = topReason.length > budget ? topReason.slice(0, budget - 1) + '…' : topReason
  return { title: notifTitle, message: `${nctRef} ${truncated}` }
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

    await saveMatchResults(careProfileId, matched, close)

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
