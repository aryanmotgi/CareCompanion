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
  // Required in production, warned in dev
  ANTHROPIC_API_KEY: warnIfMissing('ANTHROPIC_API_KEY'),

  // Optional with defaults
  NEXT_PUBLIC_APP_URL: optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),

  // Cron security
  CRON_SECRET: process.env.CRON_SECRET,

  // Integrations — optional, features degrade gracefully
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  ONEUP_CLIENT_ID: process.env.ONEUP_CLIENT_ID,
  ONEUP_CLIENT_SECRET: process.env.ONEUP_CLIENT_SECRET,
  EPIC_CLIENT_ID: process.env.EPIC_CLIENT_ID,
  EPIC_CLIENT_SECRET: process.env.EPIC_CLIENT_SECRET,
} as const
