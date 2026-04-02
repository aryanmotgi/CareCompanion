import { generateNotificationsForAllUsers } from '@/lib/notifications';

export const maxDuration = 60;

// Called by Vercel Cron alongside the sync job
export async function GET() {
  const result = await generateNotificationsForAllUsers();
  return Response.json(result);
}

export async function POST() {
  return GET();
}
