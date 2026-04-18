import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { db } from '@/lib/db';
import { careProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const Schema = z.object({
  allergies: z.array(z.object({
    name: z.string().min(1),
    reaction: z.string().optional(),
  })).min(1),
});

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data, error: valError } = validateBody(Schema, body);
    if (valError) return valError;

    const [profile] = await db
      .select({ id: careProfiles.id, allergies: careProfiles.allergies })
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1);

    if (!profile) return apiError('No care profile found', 400);

    const existing = profile.allergies || '';
    const newAllergies = data.allergies
      .filter((a) => !existing.toLowerCase().includes(a.name.toLowerCase()))
      .map((a) => a.reaction ? `${a.name} (${a.reaction})` : a.name);

    if (newAllergies.length > 0) {
      const updated = existing
        ? `${existing}\n${newAllergies.join('\n')}`
        : newAllergies.join('\n');
      await db.update(careProfiles).set({ allergies: updated }).where(eq(careProfiles.id, profile.id));
    }

    return apiSuccess({ saved: newAllergies.length });
  } catch (err) {
    console.error('[upload/allergies] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
