import { NextResponse } from 'next/server'

// After NextAuth clears its session cookie, redirect to home.
export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(origin, { status: 302 })
}
