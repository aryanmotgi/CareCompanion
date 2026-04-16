import { getAuthenticatedUser } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';

export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error || !dbUser) redirect('/login');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    redirect('/settings?error=google_not_configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google-calendar/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent',
    state: dbUser!.id,
  });

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
