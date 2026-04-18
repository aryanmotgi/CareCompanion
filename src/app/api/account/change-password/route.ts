import { NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'us-east-1',
});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

// 5 attempts per 15 minutes, keyed per user so VPNs can't bypass it
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

  const { currentPassword, password } = await req.json();

  if (!currentPassword) {
    return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const [user] = await db
    .select({ cognitoSub: users.cognitoSub, email: users.email })
    .from(users)
    .where(eq(users.id, dbUser!.id))
    .limit(1);

  if (!user?.cognitoSub) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify current password before allowing change
  try {
    await cognito.send(new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: user.email!,
        PASSWORD: currentPassword,
      },
    }));
  } catch {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  try {
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: user.cognitoSub,
      Password: password,
      Permanent: true,
    }));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
