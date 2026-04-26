/**
 * Edge-compatible auth configuration.
 *
 * This file MUST NOT import anything that uses Node.js-only modules
 * (bcrypt, AWS SDK, drizzle-orm/postgres, etc.) because it is evaluated
 * by the Next.js middleware which runs on Vercel's Edge runtime.
 *
 * The full server-side auth config (with DB callbacks) lives in auth.ts.
 * Middleware imports NextAuth from this file; route handlers use auth.ts.
 */
import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  providers: [
    // Credentials is omitted here — it uses bcrypt which is Node-only.
    // Middleware only needs to verify the signed JWT cookie, not re-run authorize().
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    // Middleware calls this to decide whether the request is authenticated.
    // Reads the signed JWT from the cookie — zero DB queries, Edge-safe.
    authorized({ auth }) {
      return !!auth?.user
    },
    jwt({ token }) {
      // Explicit pass-through. NextAuth would do this by default, but declaring the
      // callback here makes the token → session data flow visible alongside session().
      return token
    },
    session({ session, token }) {
      // Map custom token fields to session.user so middleware can read them via req.auth.
      // Edge-safe: no DB queries, no Node.js imports.
      if (session.user) {
        session.user.isDemo = (token.isDemo as boolean) ?? false
        session.user.role = (token.role as string | null) ?? null
        session.user.id = (token.dbUserId as string | null) ?? (token.sub ?? '')
        session.user.displayName = (token.displayName as string | null) ?? (token.name ?? '')
      }
      return session
    },
  },
  trustHost: true,
}
