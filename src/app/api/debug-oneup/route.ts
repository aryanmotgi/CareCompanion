/**
 * Diagnostic endpoint for 1upHealth integration debugging.
 * Returns env var status, credential presence, and tests the 1upHealth API endpoints.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Must be logged in' }, { status: 401 });
  }

  const clientId = process.env.ONEUP_CLIENT_ID;
  const clientSecret = process.env.ONEUP_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY;
  const oauthSecret = process.env.OAUTH_STATE_SECRET;

  const env = {
    ONEUP_CLIENT_ID: clientId ? `set (${clientId.length} chars, starts with ${clientId.slice(0, 4)}...)` : 'MISSING',
    ONEUP_CLIENT_SECRET: clientSecret ? `set (${clientSecret.length} chars)` : 'MISSING',
    NEXT_PUBLIC_APP_URL: baseUrl || 'MISSING',
    TOKEN_ENCRYPTION_KEY: tokenKey ? `set (${tokenKey.length} chars)` : 'MISSING — this is likely the problem!',
    OAUTH_STATE_SECRET: oauthSecret ? `set (${oauthSecret.length} chars)` : 'MISSING',
  };

  // Test the user management endpoint
  let userCreateResult: { status?: number; body?: unknown; error?: string } = {};
  try {
    const res = await fetch('https://api.1up.health/user-management/v1/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        app_user_id: `debug-${user.id}`,
      }),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {}
    userCreateResult = { status: res.status, body };
  } catch (err) {
    userCreateResult = { error: err instanceof Error ? err.message : String(err) };
  }

  // Test the auth-code endpoint with the current user's id
  let authCodeResult: { status?: number; body?: unknown; error?: string } = {};
  try {
    const res = await fetch('https://api.1up.health/user-management/v1/user/auth-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        app_user_id: user.id,
      }),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {}
    authCodeResult = { status: res.status, body };
  } catch (err) {
    authCodeResult = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({
    user_id: user.id,
    env,
    tests: {
      'POST /user-management/v1/user': userCreateResult,
      'POST /user-management/v1/user/auth-code': authCodeResult,
    },
  }, { status: 200 });
}
