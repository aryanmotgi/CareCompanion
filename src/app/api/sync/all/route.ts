import { createAdminClient } from '@/lib/supabase/admin';
import { syncOneUpData } from '@/lib/oneup-sync';

export const maxDuration = 300;

// Called by Vercel Cron every 15 minutes
// Syncs all connected 1upHealth accounts

export async function GET() {
  const admin = createAdminClient();

  const { data: apps } = await admin
    .from('connected_apps')
    .select('*')
    .eq('source', '1uphealth')
    .not('access_token', 'is', null);

  if (!apps || apps.length === 0) {
    return Response.json({ message: 'No apps to sync' });
  }

  const results: Array<{ userId: string; status: string; data?: unknown }> = [];

  for (const app of apps) {
    try {
      const synced = await syncOneUpData(app.user_id, app.access_token);
      results.push({ userId: app.user_id, status: 'ok', data: synced });
    } catch (err) {
      console.error(`Sync failed for user ${app.user_id}:`, err);
      results.push({ userId: app.user_id, status: 'error' });
    }
  }

  return Response.json({ synced: results.length, results });
}

export async function POST() {
  return GET();
}
