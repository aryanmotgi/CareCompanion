import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const { handlers, signIn, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        })
        if (!user?.passwordHash) return null
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.displayName ?? user.email }
      },
    }),
  ],
  callbacks: {
    // jwt callback: runs once at sign-in. Stores DB UUID in token so session callback
    // needs zero DB queries on every subsequent request.
    async jwt({ token, account, profile, user }) {
      if (account && (profile || user)) {
        const email = (profile as Record<string, string>)?.email ?? (user?.email ?? '')
        const sub = (profile as Record<string, string>)?.sub ?? (user?.id ?? '')
        token.providerSub = sub
        token.displayName = (profile as Record<string, string>)?.name ?? user?.name ?? email
        token.isDemo = false

        // Look up DB UUID once — stored in signed JWT, not repeated on every request.
        // If Aurora is still waking up, skip gracefully — layout will resolve the user by email.
        try {
          const dbUser = await db.query.users.findFirst({ where: eq(users.email, email) })
          token.dbUserId = dbUser?.id ?? null
        } catch {
          token.dbUserId = null
        }
      }
      return token
    },
    // session callback: reads from JWT only — zero DB queries
    async session({ session, token }) {
      session.user.id = (token.dbUserId ?? token.providerSub) as string
      session.user.displayName = token.displayName as string
      session.user.isDemo = token.isDemo as boolean
      return session
    },
    async signIn({ user, account, profile }) {
      if (!user.email) return true
      // Only run the upsert for Google OAuth — Credentials users already exist
      // by definition (authorize() only returns a user if it found one in the DB).
      // Running the insert for Credentials would set cognitoSub to the DB UUID,
      // which the spec explicitly forbids.
      if (account?.provider !== 'google') return true
      try {
        const p = profile as Record<string, string> | undefined
        const sub = p?.sub
        if (!sub) return true
        await db
          .insert(users)
          .values({
            providerSub: sub,
            email: user.email,
            displayName: user.name || user.email || '',
          })
          .onConflictDoNothing()
      } catch { /* user already exists */ }
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
