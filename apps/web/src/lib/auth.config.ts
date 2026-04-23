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
  },
  trustHost: true,
}
