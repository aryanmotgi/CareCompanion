import { getAuthenticatedUser } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';

export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error || !dbUser) redirect('/login');

  const clientId = process.env.WALGREENS_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    redirect('/settings?error=walgreens_not_configured');
  }

  // Walgreens Developer API OAuth
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/walgreens/callback`,
    response_type: 'code',
    scope: 'prescriptions',
    state: dbUser!.id,
  });

  redirect(`https://developer.walgreens.com/oauth/authorize?${params.toString()}`);
}
