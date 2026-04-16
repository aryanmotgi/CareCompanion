import { NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'us-east-1',
});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

export async function POST(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { password } = await req.json();
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  // Fetch the user's cognitoSub to use as Cognito username
  const [user] = await db
    .select({ cognitoSub: users.cognitoSub, email: users.email })
    .from(users)
    .where(eq(users.id, dbUser!.id))
    .limit(1);

  if (!user?.cognitoSub) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
