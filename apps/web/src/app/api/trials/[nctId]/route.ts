import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { getTrialDetails } from '@/lib/trials/tools'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ nctId: string }> }
) {
  const { user, error } = await getAuthenticatedUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nctId } = await params
  if (!/^NCT\d{4,}$/.test(nctId)) {
    return NextResponse.json({ error: 'Invalid NCT ID' }, { status: 400 })
  }
  const detail = await getTrialDetails(nctId)
  if ('error' in detail) return NextResponse.json({ error: detail.error }, { status: 502 })

  return NextResponse.json(detail)
}
