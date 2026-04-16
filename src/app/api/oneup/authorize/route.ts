import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { userPreferences } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buildAuthUrl, createOneUpUser } from '@/lib/oneup';

export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return new Response('Unauthorized', { status: 401 });

  const [prefs] = await db
    .select({ oneupUserId: userPreferences.oneupUserId })
    .from(userPreferences)
    .where(eq(userPreferences.userId, dbUser!.id))
    .limit(1);

  let oneupUserId = prefs?.oneupUserId;

  if (!oneupUserId) {
    try {
      oneupUserId = await createOneUpUser(dbUser!.id);

      await db.insert(userPreferences).values({
        userId: dbUser!.id,
        oneupUserId,
      }).onConflictDoUpdate({
        target: userPreferences.userId,
        set: { oneupUserId },
      });
    } catch (err) {
      console.error('Failed to create 1upHealth user:', err);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/connect?error=oneup_user_creation_failed`);
    }
  }

  const authorizeUrl = buildAuthUrl(dbUser!.id, oneupUserId);
  return NextResponse.redirect(authorizeUrl);
}
