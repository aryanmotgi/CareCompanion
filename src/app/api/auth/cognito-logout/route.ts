import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

// After NextAuth clears its session cookie, it redirects here.
// We then redirect to Cognito's logout endpoint to kill the Cognito SSO session too.
// Without this, Cognito auto-logs the user back in on next sign-in click.
export async function GET(request: NextRequest) {
  const domain = process.env.COGNITO_DOMAIN!
  const clientId = process.env.COGNITO_CLIENT_ID!
  // Derive base URL from the incoming request so this works in all environments
  // (local, preview, production) without needing NEXTAUTH_URL set explicitly.
  const { origin } = new URL(request.url)
  const logoutUri = encodeURIComponent(origin)
  redirect(`${domain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`)
}
