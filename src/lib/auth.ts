import NextAuth from 'next-auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

// Use Cognito as plain OAuth 2.0 (not OIDC) to avoid nonce validation errors.
// When Cognito federates with Google it embeds its own nonce in the ID token,
// which doesn't match what Auth.js sent — causing `n5: unexpected nonce` errors.
// Switching to `type: 'oauth'` skips ID token / OIDC nonce validation entirely
// and uses the Cognito userinfo endpoint instead.
const COGNITO_DOMAIN = (process.env.COGNITO_DOMAIN ?? '').replace(/\/$/, '')

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: 'cognito',
      name: 'CareCompanion',
      type: 'oauth',
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET ?? '',
      authorization: {
        url: `${COGNITO_DOMAIN}/oauth2/authorize`,
        params: { scope: 'openid email profile', response_type: 'code' },
      },
      token: `${COGNITO_DOMAIN}/oauth2/token`,
      userinfo: `${COGNITO_DOMAIN}/oauth2/userInfo`,
      checks: ['pkce', 'state'],
      profile(profile: Record<string, string>) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile['custom:display_name'] || profile.name || profile.email,
          image: profile.picture ?? null,
        }
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const p = profile as Record<string, string>
        token.cognitoSub = p.sub
        token.displayName = p['custom:display_name'] || token.name || token.email || ''
        token.isDemo = p['custom:is_demo'] === 'true'
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
  trustHost: true,
  debug: true,
  logger: {
    error(error) {
      console.error('[auth][error]', error.name, (error as Error).message, (error as Error).cause)
    },
  },
})
