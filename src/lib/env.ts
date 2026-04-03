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

export const env = {
  // Required — app will not start without these
  NEXT_PUBLIC_SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),

  // Optional — features degrade gracefully without these
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

  // Integrations — optional
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  WALGREENS_CLIENT_ID: process.env.WALGREENS_CLIENT_ID,
  WALGREENS_CLIENT_SECRET: process.env.WALGREENS_CLIENT_SECRET,
  ONEUPH_CLIENT_ID: process.env.ONEUPH_CLIENT_ID,
  ONEUPH_CLIENT_SECRET: process.env.ONEUPH_CLIENT_SECRET,
  EPIC_CLIENT_ID: process.env.EPIC_CLIENT_ID,
  EPIC_CLIENT_SECRET: process.env.EPIC_CLIENT_SECRET,
} as const
