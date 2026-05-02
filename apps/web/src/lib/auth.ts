import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Apple from 'next-auth/providers/apple'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users, careGroups, careGroupMembers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { rateLimit } from '@/lib/rate-limit'

const loginLimiter = rateLimit({ interval: 15 * 60 * 1000, maxRequests: 50 })

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
      async authorize(credentials) {
        if (!credentials?.groupName || !credentials?.groupPassword) return null

        const name = (credentials.groupName as string).trim()
        const password = credentials.groupPassword as string

        // Find care groups matching the name, then verify password
        const groups = await db.query.careGroups.findMany({
          where: eq(careGroups.name, name),
          orderBy: (g, { asc }) => [asc(g.createdAt)],
        })

        let matchedGroup: typeof groups[0] | null = null
        for (const group of groups) {
          const valid = await bcrypt.compare(password, group.passwordHash)
          if (valid) { matchedGroup = group; break }
        }

        if (!matchedGroup) return null

        const ownerMember = await db.query.careGroupMembers.findFirst({
          where: and(
            eq(careGroupMembers.careGroupId, matchedGroup.id),
            eq(careGroupMembers.role, 'owner'),
          ),
        })
        if (!ownerMember) return null

        const ownerUser = await db.query.users.findFirst({
          where: eq(users.id, ownerMember.userId),
        })
        if (!ownerUser) return null

        return { id: ownerUser.id, email: ownerUser.email, name: ownerUser.displayName ?? ownerUser.email }
      },
    }),
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signIn({ user, account, ...rest }: any) {
      const request = rest.request as { cookies?: { get(name: string): { value: string } | undefined } } | undefined
      if (request && (account?.provider === 'google' || account?.provider === 'apple')) {
        const cookie = request.cookies?.get('pending_role')?.value
        if (cookie && ['caregiver', 'patient', 'self'].includes(cookie)) {
          if (user?.email) {
            const email = (user.email as string).toLowerCase().trim()
            const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
            if (existing && !existing.role) {
              await db.update(users).set({ role: cookie }).where(eq(users.id, existing.id))
            }
          }
        }
      }
      return true
    },
    async jwt({ token, user, account, profile, trigger }) {
      // On session update (e.g. after /set-role saves to DB), re-read role from DB
      if (trigger === 'update' && token.dbUserId) {
        const refreshed = await db.query.users.findFirst({
          where: eq(users.id, token.dbUserId as string),
          columns: { role: true },
        })
        if (refreshed) token.role = refreshed.role ?? null
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

          // Fetch role to put on token
          const socialDbUser = await db.query.users.findFirst({ where: eq(users.id, dbUserId) })
          token.role = socialDbUser?.role ?? null
        } else {
          // Credentials sign-in: user.id is the DB UUID from authorize()
          token.dbUserId = user.id
          token.displayName = user.name ?? user.email ?? ''
          token.isDemo = false

          // Fetch role to put on token
          const credDbUser = await db.query.users.findFirst({ where: eq(users.id, user.id as string) })
          token.role = credDbUser?.role ?? null
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
