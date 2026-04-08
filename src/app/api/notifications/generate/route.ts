import { generateNotificationsForAllUsers } from '@/lib/notifications';
import { verifyCronRequest } from '@/lib/cron-auth';

export const maxDuration = 60;

// Called by Vercel Cron daily at 9am UTC
export async function GET(req: Request) {
  const authError = verifyCronRequest(req);
  if (authError) return authError;
  const result = await generateNotificationsForAllUsers();
  return Response.json(result);
}

export async function POST(req: Request) {
  return GET(req);
}
