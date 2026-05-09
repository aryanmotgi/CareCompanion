import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  let body: { endpoint: string; p256dh: string; auth: string };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid request body', 400);
  }

  const { endpoint, p256dh, auth } = body;
  if (!endpoint || !p256dh || !auth) {
    return apiError('Missing required fields: endpoint, p256dh, auth', 400);
  }

  await db
    .insert(pushSubscriptions)
    .values({ userId: user!.id, endpoint, p256dh, auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user!.id, p256dh, auth },
    });

  return apiSuccess({ subscribed: true });
}

export async function DELETE(req: NextRequest) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  let body: { endpoint: string };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid request body', 400);
  }

  const { endpoint } = body;
  if (!endpoint) {
    return apiError('Missing required field: endpoint', 400);
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user!.id),
        eq(pushSubscriptions.endpoint, endpoint),
      )
    );

  return apiSuccess({ unsubscribed: true });
}
