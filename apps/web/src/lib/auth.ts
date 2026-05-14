import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Apple from 'next-auth/providers/apple'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rateLimit } from '@/lib/rate-limit'
import { verifyCareGroupCredentials } from '@/lib/care-group-auth'

const loginLimiter = rateLimit({ interval: 15 * 60 * 1000, maxRequests: 50 })
const careGroupLoginLimiter = rateLimit({ interval: 60 * 60 * 1000, maxRequests: 5 })

function extractIp(request: Request | undefined): string {
  if (!request) return '127.0.0.1'
  return (
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    '127.0.0.1'
  )
}

export const { handlers, auth } = NextAuth({
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
    Credentials({
      id: 'care-group',
      name: 'Care Group',
      credentials: {
        groupName: { label: 'Group Name', type: 'text' },
        groupPassword: { label: 'Group Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.groupName || !credentials?.groupPassword) return null

        const name = (credentials.groupName as string).trim()
        const password = credentials.groupPassword as string

        // Rate-limit keyed on IP + group name (mirrors mobile-care-group-login).
        const ip = extractIp(request as Request | undefined)
        const { success } = await careGroupLoginLimiter.check(`care-group-login:${ip}:${name.toLowerCase()}`)
        if (!success) return null

        const result = await verifyCareGroupCredentials(name, password)
        if (!result.ok) return null

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.displayName ?? result.user.email,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile, trigger, session }) {
      // On session update (e.g. after /set-role saves to DB), update token immediately
      // from the data passed to update(), falling back to a DB re-read if not provided.
      if (trigger === 'update' && token.dbUserId) {
        if (session?.role !== undefined) {
          token.role = session.role
          return token
        }
        const refreshed = await db.query.users.findFirst({
          where: eq(users.id, token.dbUserId as string),
          columns: { role: true, displayName: true },
        })
        if (refreshed) {
          token.role = refreshed.role ?? null
          if (refreshed.displayName) token.displayName = refreshed.displayName
        }
        return token
      }

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

          // Fetch role — non-critical; null sends user to /set-role after sign-in
          try {
            const socialDbUser = await db.query.users.findFirst({ where: eq(users.id, dbUserId) })
            token.role = socialDbUser?.role ?? null
          } catch {
            token.role = null
          }
        } else {
          // Credentials sign-in: user.id is the DB UUID from authorize()
          token.dbUserId = user.id
          token.displayName = user.name ?? user.email ?? ''
          token.isDemo = false

          // Fetch role — non-critical; null sends user to /set-role after sign-in
          try {
            const credDbUser = await db.query.users.findFirst({ where: eq(users.id, user.id as string) })
            token.role = credDbUser?.role ?? null
          } catch {
            token.role = null
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.dbUserId as string
      session.user.displayName = token.displayName as string
      session.user.isDemo = token.isDemo as boolean
      session.user.role = token.role as string | null
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
