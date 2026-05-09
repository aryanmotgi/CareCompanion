import { db } from '@/lib/db';
import { connectedApps, auditLogs } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { NextResponse } from 'next/server';

export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apps = await db
    .select({
      id: connectedApps.id,
      source: connectedApps.source,
      lastSynced: connectedApps.lastSynced,
      expiresAt: connectedApps.expiresAt,
      createdAt: connectedApps.createdAt,
      metadata: connectedApps.metadata,
    })
    .from(connectedApps)
    .where(eq(connectedApps.userId, dbUser!.id))
    .orderBy(desc(connectedApps.lastSynced));

  // Get recent sync errors from audit_logs if available
  const recentErrors = await db
    .select({
      action: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.userId, dbUser!.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  const syncErrors = recentErrors.filter((log) =>
    log.action?.startsWith('sync_')
  );

  const cronSchedule = [
    { name: 'Data Sync', schedule: 'Daily at 6:00 AM', path: '/api/cron/sync' },
    { name: 'Notifications', schedule: 'Daily at 9:00 AM', path: '/api/notifications/generate' },
    { name: 'Reminders', schedule: 'Daily at 10:00 AM', path: '/api/reminders/check' },
    { name: 'Data Cleanup', schedule: 'Weekly (Sunday 3 AM)', path: '/api/cron/purge' },
  ];

  return NextResponse.json({
    connected_apps: apps,
    recent_errors: syncErrors,
    cron_schedule: cronSchedule,
  });
}
