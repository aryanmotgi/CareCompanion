import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { careProfiles, medications, appointments } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { validateCsrf } from '@/lib/csrf';
import { ApiErrors } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) return ApiErrors.rateLimited();

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  let messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  try {
    const body = await req.json();
    messages = body.messages;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) return NextResponse.json({ error: 'No user message' }, { status: 400 });

  try {
    const [profile] = await db
      .select()
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1);

    const [meds, appts] = await Promise.all([
      profile?.id
        ? db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))).limit(20).catch(() => [])
        : Promise.resolve([]),
      profile?.id
        ? db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt))).limit(10).catch(() => [])
        : Promise.resolve([]),
    ]);

    const systemPrompt = [
      `You are CareCompanion AI, a compassionate AI assistant for cancer patients and their caregivers.`,
      profile?.patientName ? `Patient: ${profile.patientName}` : '',
      profile?.cancerType ? `Cancer type: ${profile.cancerType}` : '',
      profile?.cancerStage ? `Stage: ${profile.cancerStage}` : '',
      profile?.treatmentPhase ? `Treatment phase: ${profile.treatmentPhase}` : '',
      meds.length > 0 ? `Medications: ${meds.map((m: any) => m.name).join(', ')}` : '',
      appts.length > 0 ? `Upcoming appointments: ${appts.map((a: any) => a.purpose || a.specialty || 'Appointment').join(', ')}` : '',
      `Be warm, concise, and medically accurate. Keep responses focused and supportive.`,
    ].filter(Boolean).join('\n');

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      maxOutputTokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    return NextResponse.json({ content: text });
  } catch (err) {
    console.error('[chat/mobile] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
