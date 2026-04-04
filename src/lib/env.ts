function required(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Check your .env.local file.`
    )
  }
  return value
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback
}

/**
 * Warn at startup if a key is missing but don't crash.
 * Used for env vars that are required in production but optional in dev.
 */
function warnIfMissing(key: string): string | undefined {
  const value = process.env[key]
  if (!value && process.env.NODE_ENV === 'production') {
    console.warn(`[env] WARNING: ${key} is not set. Some features will not work.`)
  }
  return value
}

export const env = {
  // Required — app will not start without these
  NEXT_PUBLIC_SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),

  // Required in production, warned in dev
  SUPABASE_SERVICE_ROLE_KEY: warnIfMissing('SUPABASE_SERVICE_ROLE_KEY'),
  ANTHROPIC_API_KEY: warnIfMissing('ANTHROPIC_API_KEY'),

  // Optional with defaults
  NEXT_PUBLIC_APP_URL: optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),

  // Cron security
  CRON_SECRET: process.env.CRON_SECRET,

  // Integrations — optional, features degrade gracefully
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  WALGREENS_CLIENT_ID: process.env.WALGREENS_CLIENT_ID,
  WALGREENS_CLIENT_SECRET: process.env.WALGREENS_CLIENT_SECRET,
  ONEUPH_CLIENT_ID: process.env.ONEUPH_CLIENT_ID,
  ONEUPH_CLIENT_SECRET: process.env.ONEUPH_CLIENT_SECRET,
  EPIC_CLIENT_ID: process.env.EPIC_CLIENT_ID,
  EPIC_CLIENT_SECRET: process.env.EPIC_CLIENT_SECRET,
} as const
