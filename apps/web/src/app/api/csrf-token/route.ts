import { ensureCsrfToken } from '@/lib/csrf'
import { NextResponse } from 'next/server'

export async function GET() {
  const token = await ensureCsrfToken()
  return NextResponse.json({ csrfToken: token })
}
