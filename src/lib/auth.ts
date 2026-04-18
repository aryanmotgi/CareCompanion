import NextAuth from 'next-auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

// Use Cognito as plain OAuth 2.0 (not OIDC) to avoid nonce validation errors.
// When Cognito federates with Google it embeds its own nonce in the ID token,
// which doesn't match what Auth.js sent — causing `n5: unexpected nonce` errors.
// Switching to `type: 'oauth'` skips ID token / OIDC nonce validation entirely
// and uses the Cognito userinfo endpoint instead.
const COGNITO_DOMAIN = (process.env.COGNITO_DOMAIN ?? '').replace(/\/$/, '')
// Cognito OIDC issuer URL — must match the `iss` claim in Cognito's ID tokens.
// Format: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
// Auth.js v5 beta defaults to "https://authjs.dev" when no issuer is set,
// causing OAUTH_JWT_CLAIM_COMPARISON_FAILED on the iss claim.
const COGNITO_ISSUER = process.env.COGNITO_ISSUER ?? 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ZLns0ABGw'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: 'cognito',
      name: 'CareCompanion',
      type: 'oauth',
      issuer: COGNITO_ISSUER,
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET ?? '',
      authorization: {
        url: `${COGNITO_DOMAIN}/oauth2/authorize`,
        params: { scope: 'openid email profile', response_type: 'code' },
      },
      token: {
        url: `${COGNITO_DOMAIN}/oauth2/token`,
        // Strip id_token from the response so Auth.js skips JWT/nonce validation entirely.
        // Cognito embeds its own nonce in the ID token when federating with Google,
        // which doesn't match what Auth.js sent — causing OAUTH_JWT_CLAIM_COMPARISON_FAILED.
        // Removing id_token forces Auth.js to use the userinfo endpoint for the profile instead.
        async conform(response: Response) {
          const json = await response.json() as Record<string, unknown>
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id_token: _removed, ...tokens } = json
          return Response.json(tokens)
        },
      },
      userinfo: `${COGNITO_DOMAIN}/oauth2/userInfo`,
      checks: [],
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
