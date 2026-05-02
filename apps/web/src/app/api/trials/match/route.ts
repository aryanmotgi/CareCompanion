import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { assembleProfile } from '@/lib/trials/assembleProfile'
import { runTrialsAgent } from '@/lib/trials/clinicalTrialsAgent'
import { saveMatchResults } from '@/lib/trials/matchingQueue'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rateLimit } from '@/lib/rate-limit'

// Claude agent + ClinicalTrials.gov calls easily exceed 10s default
export const maxDuration = 300

// 3 live searches per user per hour — prevents LLM cost-amplification attacks
const trialsSearchLimiter = rateLimit({ interval: 60 * 60 * 1000, maxRequests: 3 })

export async function POST() {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success: rateLimitOk } = await trialsSearchLimiter.check(user.id)
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many searches. Try again in an hour.' }, { status: 429 })
    }

    const [profile] = await db.select({ id: careProfiles.id })
      .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
    if (!profile) return NextResponse.json({ error: 'No care profile found' }, { status: 404 })

    const patientProfile = await assembleProfile(profile.id)
    const { matched, close } = await runTrialsAgent(patientProfile)

    // Persist results so the cache stays fresh after a live refresh
    void saveMatchResults(profile.id, matched, close).catch(err =>
      console.error('[trials/match] cache save failed:', err)
    )

    return NextResponse.json({ matched, close, refreshedAt: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[trials/match]', msg)
    return NextResponse.json({ error: msg, matched: [], close: [] }, { status: 500 })
  }
}
