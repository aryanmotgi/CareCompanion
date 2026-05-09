import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { validateCsrf } from '@/lib/csrf';
import { logAudit } from '@/lib/audit';

const ALLOWED_SOURCES = ['google_calendar'] as const;
type AllowedSource = (typeof ALLOWED_SOURCES)[number];

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error: authError } = await getAuthenticatedUser();
  if (authError || !dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { source } = await params;

  if (!ALLOWED_SOURCES.includes(source as AllowedSource)) {
    return NextResponse.json({ error: 'Unknown integration source' }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: connectedApps.id })
    .from(connectedApps)
    .where(and(eq(connectedApps.userId, dbUser.id), eq(connectedApps.source, source)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Not connected' }, { status: 404 });
  }

  await db
    .delete(connectedApps)
    .where(and(eq(connectedApps.userId, dbUser.id), eq(connectedApps.source, source)));

  await logAudit({
    user_id: dbUser.id,
    action: 'integration_disconnected',
    resource_type: 'connected_app',
    details: { source },
  });

  return NextResponse.json({ success: true });
}
