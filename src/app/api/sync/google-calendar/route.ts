import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { connectedApps, careProfiles, appointments } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const body = await req.json();
  const { user_id } = body;

  if (!user_id) {
    return Response.json({ error: 'user_id required' }, { status: 400 });
  }

  // Auth: either (a) authenticated user session, or (b) server-side OAuth callback
  const { user: dbUser, error: authError } = await getAuthenticatedUser();

  if (!authError && dbUser) {
    // Session present — verify ownership
    if (dbUser.id !== user_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    // No session — verify internal secret
    const internalSecret = req.headers.get('x-internal-secret');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || internalSecret !== cronSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [connection] = await db
    .select()
    .from(connectedApps)
    .where(and(eq(connectedApps.userId, user_id), eq(connectedApps.source, 'google_calendar')))
    .limit(1);

  if (!connection?.accessToken) {
    return Response.json({ error: 'Not connected' }, { status: 400 });
  }

  let accessToken = connection.accessToken;
  if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
    if (!connection.refreshToken) {
      return Response.json({ error: 'Token expired, reconnect required' }, { status: 401 });
    }
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!refreshRes.ok) {
      return Response.json({ error: 'Token refresh failed' }, { status: 401 });
    }
    const tokens = await refreshRes.json();
    accessToken = tokens.access_token;

    await db.update(connectedApps).set({
      accessToken: tokens.access_token,
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
