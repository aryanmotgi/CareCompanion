import { getAuthenticatedUser } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';

// Insurance uses the same 1upHealth FHIR integration
export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error || !dbUser) redirect('/login');

  const clientId = process.env.ONEUPH_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    redirect('/settings?error=1uphealth_not_configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/insurance/callback`,
    response_type: 'code',
    scope: 'user/*.read',
    state: dbUser!.id,
  });

  redirect(`https://api.1up.health/connect/authorize?${params.toString()}`);
}
