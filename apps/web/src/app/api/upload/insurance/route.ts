import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { insurance } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const Schema = z.object({
  provider: z.string().min(1),
  member_id: z.string().optional(),
  group_number: z.string().optional(),
  plan_type: z.string().optional(),
  deductible_limit: z.number().nonnegative().optional(),
  deductible_used: z.number().nonnegative().optional(),
  oop_limit: z.number().nonnegative().optional(),
  oop_used: z.number().nonnegative().optional(),
  plan_year: z.number().optional(),
  is_additional: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const { valid, error: csrfError } = await validateCsrf(req);
    if (!valid) return csrfError!;

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data, error: valError } = validateBody(Schema, body);
    if (valError) return valError;

    const planYear = data.plan_year || new Date().getFullYear();
    const row = {
      userId: user!.id,
      provider: data.provider,
      memberId: data.member_id || null,
      groupNumber: data.group_number || null,
      deductibleLimit: data.deductible_limit?.toString() || null,
      deductibleUsed: data.deductible_used?.toString() || null,
      oopLimit: data.oop_limit?.toString() || null,
      oopUsed: data.oop_used?.toString() || null,
      planYear,
    };

    if (data.is_additional) {
      await db.insert(insurance).values(row);
    } else {
      const [existing] = await db
        .select({ id: insurance.id })
        .from(insurance)
        .where(and(eq(insurance.userId, user!.id), eq(insurance.planYear, planYear)))
        .limit(1);

      if (existing) {
        await db.update(insurance).set(row).where(eq(insurance.id, existing.id));
      } else {
        await db.insert(insurance).values(row);
      }
    }

    return apiSuccess({ saved: 1 });
  } catch (err) {
    console.error('[upload/insurance] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
