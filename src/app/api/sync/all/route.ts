import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { syncOneUpData } from '@/lib/oneup-sync';
import { verifyCronRequest } from '@/lib/cron-auth';
import { safeDecryptToken } from '@/lib/token-encryption';

export const maxDuration = 300;

// Called by Vercel Cron daily at 8am UTC
// Syncs all connected 1upHealth accounts

export async function GET(req: Request) {
  const authError = verifyCronRequest(req);
  if (authError) return authError;

  const apps = await db
    .select()
    .from(connectedApps)
    .where(and(eq(connectedApps.source, '1uphealth'), isNotNull(connectedApps.accessToken)));

  if (apps.length === 0) {
    return Response.json({ message: 'No apps to sync' });
  }

  const results: Array<{ userId: string; status: string; data?: unknown }> = [];

  for (const app of apps) {
    try {
      const accessToken = safeDecryptToken(app.accessToken!);
      if (!accessToken) {
        results.push({ userId: app.userId, status: 'error' });
        continue;
      }
      const synced = await syncOneUpData(app.userId, accessToken);
      results.push({ userId: app.userId, status: 'ok', data: synced });
    } catch (err) {
      console.error(`Sync failed for user ${app.userId}:`, err);
      results.push({ userId: app.userId, status: 'error' });
    }
  }

  return Response.json({ synced: results.length, results });
}

export async function POST(req: Request) {
  return GET(req);
}
