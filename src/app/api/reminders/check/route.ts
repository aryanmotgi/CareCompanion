import { checkMedicationReminders } from '@/lib/reminders';

export const maxDuration = 60;

// Called by Vercel Cron every 15 minutes
export async function GET() {
  const result = await checkMedicationReminders();
  return Response.json(result);
}

export async function POST() {
  return GET();
}
