import { withMetrics } from '@/lib/api-metrics';
import { verifyCronRequest } from '@/lib/cron-auth';

export const maxDuration = 300;

// Placeholder cron — health system sync (1upHealth/FHIR) has been removed.
// Retain this route so the Vercel cron schedule stays valid.
async function handler(req: Request) {
  const authError = verifyCronRequest(req);
  if (authError) return authError;

  return Response.json({ message: 'No connections to sync', synced: 0 });
}

export const GET = withMetrics('/api/cron/sync', handler);
