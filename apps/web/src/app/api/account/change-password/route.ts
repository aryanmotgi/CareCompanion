import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const limiter = rateLimit({ interval: 15 * 60 * 1000, maxRequests: 5 });

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error: authError } = await getAuthenticatedUser();
  if (authError) return authError;

  const { success } = await limiter.check(`change-password:${dbUser!.id}`);
  if (!success) {
    return NextResponse.json({ error: 'Too many password change attempts. Please try again later.' }, { status: 429 });
  }

  const { body, error: bodyError } = await parseBody<{ currentPassword: string; password: string }>(req);
  if (bodyError) return bodyError;
  const { currentPassword, password } = body;

  if (!currentPassword) {
    return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, dbUser!.id))
    .limit(1);

  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'No password set for this account' }, { status: 400 });
  }

  const valid_pw = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid_pw) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  return NextResponse.json({ success: true });
}
