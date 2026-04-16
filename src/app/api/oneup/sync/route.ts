import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { syncOneUpData, TokenExpiredError } from '@/lib/oneup-sync';
import { safeDecryptToken } from '@/lib/token-encryption';

export const maxDuration = 60;

export async function POST() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return new Response('Unauthorized', { status: 401 });

  const [app] = await db
    .select()
    .from(connectedApps)
    .where(and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, '1uphealth')))
    .orderBy(desc(connectedApps.createdAt))
    .limit(1);

  if (!app || !app.accessToken) {
    return Response.json({ error: 'Not connected to 1upHealth' }, { status: 400 });
  }

  const accessToken = safeDecryptToken(app.accessToken);
  if (!accessToken) {
    // Token can't be decrypted — mark as expired so next authorize flow re-auths
    await db.update(connectedApps).set({ expiresAt: new Date(0) })
      .where(and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, '1uphealth')));
    return Response.json({ error: 'token_expired' }, { status: 401 });
  }

  try {
    const results = await syncOneUpData(dbUser!.id, accessToken);
    return Response.json({ success: true, synced: results });
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      await db.update(connectedApps).set({ expiresAt: new Date(0) })
        .where(and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, '1uphealth')));
      return Response.json({ error: 'token_expired' }, { status: 401 });
    }
    console.error('1upHealth sync error:', err);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
