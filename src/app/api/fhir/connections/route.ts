import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const connections = await db
    .select({
      source: connectedApps.source,
      lastSynced: connectedApps.lastSynced,
      metadata: connectedApps.metadata,
      expiresAt: connectedApps.expiresAt,
    })
    .from(connectedApps)
    .where(eq(connectedApps.userId, dbUser!.id));

  const connected = connections.map((c) => ({
    source: c.source,
    provider_name: (c.metadata as Record<string, string>)?.provider_name || c.source,
    last_synced: c.lastSynced,
    is_expired: c.expiresAt ? new Date(c.expiresAt) < new Date() : false,
  }));

  return Response.json({ connections: connected });
}

// DELETE — disconnect a non-1uphealth connected app by source
export async function DELETE(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { source } = await req.json();
  if (!source) return Response.json({ error: 'source is required' }, { status: 400 });

  await db
    .delete(connectedApps)
    .where(and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, source)));

  return Response.json({ success: true });
}

// GET (with full fields) — list all connected apps for the current user
export async function POST() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apps = await db
    .select()
    .from(connectedApps)
    .where(eq(connectedApps.userId, dbUser!.id));

  return Response.json({ data: apps });
}
