import { NextResponse } from 'next/server';

// Auth.js handles OAuth callbacks at /api/auth/callback/* (Apple, Google).
// This route exists for backwards compatibility with old links pointing at
// /auth/callback — bounce them to /login.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
