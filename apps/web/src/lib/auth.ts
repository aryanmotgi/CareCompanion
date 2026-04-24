import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Apple from 'next-auth/providers/apple'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rateLimit } from '@/lib/rate-limit'

const loginLimiter = rateLimit({ interval: 15 * 60 * 1000, maxRequests: 5 })

export const { handlers, signIn, auth } = NextAuth({
  providers: [
    Apple({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }),
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

        const email = (credentials.email as string).trim().toLowerCase()

        // Rate limit by email: 5 attempts per 15 minutes
        const { success } = await loginLimiter.check(email)
        if (!success) return null

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        })
        if (!user?.passwordHash) return null
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.displayName ?? user.email }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        if (account?.provider === 'apple' || account?.provider === 'google') {
          // Social sign-in: find or create user in our database
          const socialEmail = (user.email ?? profile?.email ?? '').toLowerCase().trim()
          if (!socialEmail) {
            throw new Error('No email provided by social provider')
          }

          const existingUser = await db.query.users.findFirst({
            where: eq(users.email, socialEmail),
          })

          let dbUserId: string
          let dbDisplayName: string | null

          if (existingUser) {
            dbUserId = existingUser.id
            dbDisplayName = existingUser.displayName
          } else {
            // Create a new user from social sign-in
            const [newUser] = await db
              .insert(users)
              .values({
                email: socialEmail,
                displayName: user.name ?? socialEmail,
                providerSub: account.providerAccountId,
              })
              .returning({ id: users.id, displayName: users.displayName })
            dbUserId = newUser.id
            dbDisplayName = newUser.displayName
          }

          token.dbUserId = dbUserId
          token.displayName = dbDisplayName ?? user.name ?? socialEmail
          token.isDemo = false
        } else {
          // Credentials sign-in: user.id is the DB UUID from authorize()
          token.dbUserId = user.id
          token.displayName = user.name ?? user.email ?? ''
          token.isDemo = false
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.dbUserId as string
      session.user.displayName = token.displayName as string
      session.user.isDemo = token.isDemo as boolean
      return session
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
