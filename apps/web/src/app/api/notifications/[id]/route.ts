import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user, error: authError } = await getAuthenticatedUser();
  if (authError) return authError;

  const { id } = await params;
  if (!id) return apiError('Missing notification id', 400);

  try {
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, user!.id)));
    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[notifications/delete] error:', err);
    return apiError('Internal server error', 500);
  }
}
