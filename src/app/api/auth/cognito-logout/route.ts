import { redirect } from 'next/navigation'

// After NextAuth clears its session cookie, it redirects here.
// We then redirect to Cognito's logout endpoint to kill the Cognito SSO session too.
// Without this, Cognito auto-logs the user back in on next sign-in click.
export async function GET() {
  const domain = process.env.COGNITO_DOMAIN!
  const clientId = process.env.COGNITO_CLIENT_ID!
  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'http://localhost:3000'
  // Use the base URL — it's already in Cognito's allowed sign-out URLs list.
  // The root page will naturally redirect to /login for unauthenticated users.
  const logoutUri = encodeURIComponent(baseUrl)
  redirect(`${domain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`)
}
