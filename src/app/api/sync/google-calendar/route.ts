import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  // Auth: either (a) authenticated user session, or (b) server-side OAuth callback
  // with a valid connected app proving the user_id is legitimate.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { user_id } = await req.json();
  if (!user_id) {
    return Response.json({ error: 'user_id required' }, { status: 400 });
  }

  // If we have a session, verify ownership
  if (user && user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // If no session (server-side callback), verify the user has a connected app
  if (!user) {
    const { data: app } = await admin
      .from('connected_apps')
      .select('id')
      .eq('user_id', user_id)
      .eq('source', 'google_calendar')
      .limit(1)
      .single();
    if (!app) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get connection
  const { data: connection } = await admin
    .from('connected_apps')
    .select('*')
    .eq('user_id', user_id)
    .eq('source', 'google_calendar')
    .single();

  if (!connection?.access_token) {
    return Response.json({ error: 'Not connected' }, { status: 400 });
  }

  // Check token expiry and refresh if needed
  let accessToken = connection.access_token;
  if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
    if (!connection.refresh_token) {
      return Response.json({ error: 'Token expired, reconnect required' }, { status: 401 });
    }
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!refreshRes.ok) {
      return Response.json({ error: 'Token refresh failed' }, { status: 401 });
    }
    const tokens = await refreshRes.json();
    accessToken = tokens.access_token;

    await admin
      .from('connected_apps')
      .update({
        access_token: tokens.access_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
      .eq('id', connection.id);
  }

  // Get the user's care profile
  const { data: profile } = await admin
    .from('care_profiles')
    .select('id')
    .eq('user_id', user_id)
    .single();

  if (!profile) {
    return Response.json({ error: 'No care profile' }, { status: 400 });
  }

  // Fetch upcoming calendar events (next 90 days)
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

  // Filter health-related events
  const healthEvents = events.filter((e) => {
    const text = `${e.summary || ''} ${e.description || ''}`.toLowerCase();
    return healthKeywords.some((kw) => text.includes(kw));
  });

  // Import to appointments table
  let imported = 0;
  for (const event of healthEvents) {
    const dateTime = event.start?.dateTime || event.start?.date || null;

    // Check for duplicate
    const { data: existing } = await admin
      .from('appointments')
      .select('id')
      .eq('care_profile_id', profile.id)
      .eq('doctor_name', event.summary || '')
      .eq('date_time', dateTime || '')
      .limit(1);

    if (existing && existing.length > 0) continue;

    await admin.from('appointments').insert({
      care_profile_id: profile.id,
      doctor_name: event.summary || 'Calendar Event',
      date_time: dateTime,
      purpose: event.description || null,
      location: event.location || null,
    });
    imported++;
  }

  // Update last_synced
  await admin
    .from('connected_apps')
    .update({ last_synced: new Date().toISOString() })
    .eq('id', connection.id);

  return Response.json({ success: true, imported });
}
