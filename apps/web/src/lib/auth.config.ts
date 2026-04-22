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
import Google from 'next-auth/providers/google'

export const authConfig: NextAuthConfig = {
  providers: [
    // Google is listed here so NextAuth knows how to verify Google OAuth tokens
    // in middleware. Credentials is omitted — it uses bcrypt which is Node-only.
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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
