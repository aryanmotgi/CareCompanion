import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess, ApiErrors } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { careProfiles, symptomEntries } from '@/lib/db/schema';
import { eq, gte, desc, and } from 'drizzle-orm';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const PostSchema = z.object({
  mood: z.string().optional(),
  energy: z.string().optional(),
  pain: z.number().min(0).max(10).optional(),
  sleep_hours: z.number().min(0).max(24).optional(),
  symptoms: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
}).passthrough();

const DeleteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
});

// POST — save or update today's symptom entry
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) return ApiErrors.rateLimited();

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(PostSchema, body);
    if (valError) return valError;

    const today = new Date().toISOString().split('T')[0];

    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1);

    // Delete existing entry for today if it exists (upsert pattern)
    await db
      .delete(symptomEntries)
      .where(and(eq(symptomEntries.userId, user!.id), eq(symptomEntries.date, today)));

    const [entry] = await db
      .insert(symptomEntries)
      .values({
        userId: user!.id,
        careProfileId: profile?.id ?? null,
        date: today,
        mood: validated.mood ?? null,
        energy: validated.energy ?? null,
        painLevel: validated.pain ?? null,
        sleepHours: validated.sleep_hours?.toString() ?? null,
        symptoms: validated.symptoms ?? [],
        notes: validated.notes ?? null,
      })
      .returning();

    return apiSuccess({ success: true, entry });
  } catch (err) {
    console.error('[journal] POST error:', err);
    return apiError('Internal server error', 500);
  }
}

// GET — fetch symptom entries
export async function GET(req: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '14');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const entries = await db
      .select()
      .from(symptomEntries)
      .where(and(eq(symptomEntries.userId, user!.id), gte(symptomEntries.date, since)))
      .orderBy(desc(symptomEntries.date));

    return apiSuccess({ entries });
  } catch (err) {
    console.error('[journal] GET error:', err);
    return apiError('Internal server error', 500);
  }
}

// DELETE — remove a symptom entry by date
export async function DELETE(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: rlSuccess } = await limiter.check(ip);
  if (!rlSuccess) return ApiErrors.rateLimited();

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('Invalid or missing request body', 400);
    }

    const { data: validated, error: valError } = validateBody(DeleteSchema, body);
    if (valError) return valError;

    await db
      .delete(symptomEntries)
      .where(and(eq(symptomEntries.userId, user!.id), eq(symptomEntries.date, validated.date)));

    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[journal] DELETE error:', err);
    return apiError('Internal server error', 500);
  }
}
