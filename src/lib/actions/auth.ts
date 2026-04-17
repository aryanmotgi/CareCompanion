'use client';

import { signOut as nextAuthSignOut } from 'next-auth/react';

export async function signOut() {
  await nextAuthSignOut({ callbackUrl: '/api/auth/cognito-logout' });
}
