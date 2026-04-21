import { NextResponse } from 'next/server';

// Auth.js handles OAuth callbacks at /api/auth/callback/cognito
// This route exists for backwards compatibility
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
