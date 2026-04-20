import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const p = profile as Record<string, string>
        token.providerSub = String(p.sub)
        token.displayName = p.name || token.name || token.email || ''
        token.isDemo = false
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.providerSub as string
      session.user.displayName = token.displayName as string
      session.user.isDemo = token.isDemo as boolean
      return session
    },
    async signIn({ user, profile }) {
      if (!user.email) return true
      try {
        const p = profile as Record<string, string> | undefined
        const sub = String(p?.sub || user.id || '')
        if (!sub) return true
        await db
          .insert(users)
          .values({
            cognitoSub: sub,
            email: user.email,
            displayName: user.name || user.email || '',
            isDemo: false,
          })
          .onConflictDoUpdate({
            target: users.cognitoSub,
            set: { email: user.email ?? '' },
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
  trustHost: true,
  debug: process.env.NODE_ENV !== 'production',
  logger: {
    error(error) {
      const e = error as Error & { cause?: unknown }
      console.error('[auth][error]', error.name, e.message)
      if (e.cause) {
        try {
          console.error('[auth][error][cause]', JSON.stringify(e.cause, null, 2))
        } catch {
          console.error('[auth][error][cause]', String(e.cause))
        }
      }
    },
  },
})
