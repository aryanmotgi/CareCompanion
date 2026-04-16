'use server'

import { signIn, signOut } from '@/lib/auth'

export async function cognitoSignIn() {
  await signIn('cognito', { redirectTo: '/dashboard' })
}

export async function cognitoSignOut() {
  await signOut({ redirectTo: '/' })
}
