import { getAuthenticatedUser } from '@/lib/api-helpers';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { connectedApps, careProfiles, appointments } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { decryptToken, encryptToken } from '@/lib/token-encryption';

export async function POST(req: Request) {
  // Internal server-to-server calls (OAuth callback → initial sync) carry x-internal-secret
  // and have no browser session/CSRF cookie — check secret first to skip CSRF for those.
  const internalSecret = req.headers.get('x-internal-secret');
  const cronSecret = process.env.CRON_SECRET;
  const isInternalCall = !!(cronSecret && internalSecret === cronSecret);

  if (!isInternalCall) {
    const { valid, error: csrfError } = await validateCsrf(req);
    if (!valid) return csrfError!;
  }

  const body = await req.json();
  let { user_id } = body as { user_id?: string };

  if (!isInternalCall) {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError || !dbUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Browser callers don't need to send user_id — derive it from session.
    // If they do send it, it must match the session to prevent IDOR.
    if (user_id && dbUser.id !== user_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    user_id = dbUser.id;
  }

  if (!user_id) {
    return Response.json({ error: 'user_id required' }, { status: 400 });
  }

  const [connection] = await db
    .select()
    .from(connectedApps)
    .where(and(eq(connectedApps.userId, user_id), eq(connectedApps.source, 'google_calendar')))
    .limit(1);

  if (!connection?.accessToken) {
    return Response.json({ error: 'Not connected' }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(connection.accessToken);
  } catch {
    return Response.json({ error: 'Token decryption failed, reconnect required' }, { status: 401 });
  }

  if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
    if (!connection.refreshToken) {
      return Response.json({ error: 'Token expired, reconnect required' }, { status: 401 });
    }
    let decryptedRefresh: string;
    try {
      decryptedRefresh = decryptToken(connection.refreshToken);
    } catch {
      return Response.json({ error: 'Refresh token decryption failed, reconnect required' }, { status: 401 });
    }
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: decryptedRefresh,
        grant_type: 'refresh_token',
      }),
    });
    if (!refreshRes.ok) {
      return Response.json({ error: 'Token refresh failed' }, { status: 401 });
    }
    const tokens = await refreshRes.json();
    accessToken = tokens.access_token;

    await db.update(connectedApps).set({
      accessToken: encryptToken(tokens.access_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    }).where(eq(connectedApps.id, connection.id));
  }

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(eq(careProfiles.userId, user_id))
    .limit(1);

  if (!profile) {
    return Response.json({ error: 'No care profile' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const healthKeywords = ['doctor', 'appointment', 'medical', 'hospital', 'clinic', 'pharmacy', 'dr.', 'dentist', 'therapist', 'checkup', 'lab'];

  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&singleEvents=true&orderBy=startTime&maxResults=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!calRes.ok) {
    return Response.json({ error: 'Calendar API failed' }, { status: 502 });
  }

  const calData = await calRes.json();
  const events = (calData.items || []) as Array<{
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string };
    location?: string;
  }>;

  const healthEvents = events.filter((e) => {
    const text = `${e.summary || ''} ${e.description || ''}`.toLowerCase();
    return healthKeywords.some((kw) => text.includes(kw));
  });

  let imported = 0;
  for (const event of healthEvents) {
    const dateTimeStr = event.start?.dateTime || event.start?.date || null;
    const dateTime = dateTimeStr ? new Date(dateTimeStr) : null;

    const existing = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(
        eq(appointments.careProfileId, profile.id),
        eq(appointments.doctorName, event.summary || ''),
        dateTime ? eq(appointments.dateTime, dateTime) : isNull(appointments.dateTime),
      ))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(appointments).values({
      careProfileId: profile.id,
      doctorName: event.summary || 'Calendar Event',
      dateTime,
      purpose: event.description || null,
      location: event.location || null,
    });
    imported++;
  }

  await db.update(connectedApps).set({ lastSynced: new Date() }).where(eq(connectedApps.id, connection.id));

  return Response.json({ success: true, imported });
}
