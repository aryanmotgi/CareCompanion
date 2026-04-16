import NextAuth from 'next-auth'
import Cognito from 'next-auth/providers/cognito'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Cognito({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET ?? '',
      issuer: `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
      authorization: { params: { scope: 'openid email' } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.cognitoSub = (profile as Record<string, string>).sub
        token.displayName =
          (profile as Record<string, string>)['custom:display_name'] ||
          token.name ||
          token.email ||
          ''
        token.isDemo =
          (profile as Record<string, string>)['custom:is_demo'] === 'true'
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.cognitoSub as string
      session.user.displayName = token.displayName as string
      session.user.isDemo = token.isDemo as boolean
      return session
    },
    async signIn({ user, profile }) {
      if (!user.email) return true
      try {
        const p = profile as Record<string, string> | undefined
        const cognitoSub = p?.sub || user.id || ''
        if (!cognitoSub) return true
        await db
          .insert(users)
          .values({
            cognitoSub,
            email: user.email,
            displayName: user.name || user.email || '',
            isDemo: false,
          })
          .onConflictDoUpdate({
            target: users.cognitoSub,
            set: {
              email: user.email,
              displayName: user.name || user.email,
            },
          })
      } catch (e) {
        console.error('[auth] signIn DB error (non-blocking):', e)
      }
      return true
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  debug: true,
})
