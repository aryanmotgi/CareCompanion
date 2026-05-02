import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { trialMatches, careProfiles } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const category = searchParams.get('category') // 'matched' | 'close' | null (all)

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json({ matched: [], close: [], page, limit })

  const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const whereClause = category && category !== 'all'
    ? and(eq(trialMatches.careProfileId, profile.id), eq(trialMatches.matchCategory, category))
    : eq(trialMatches.careProfileId, profile.id)

  const rows = await db.select().from(trialMatches)
    .where(whereClause)
    .orderBy(desc(trialMatches.matchScore))
    .limit(limit).offset((page - 1) * limit)

  const result = rows.map(r => ({
    ...r,
    stale: r.updatedAt != null && r.updatedAt < staleThreshold,
  }))

  return NextResponse.json({
    matched: result.filter(r => r.matchCategory === 'matched'),
    close:   result.filter(r => r.matchCategory === 'close'),
    page,
    limit,
  })
}
