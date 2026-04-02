import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

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
    state: user.id,
  });

  redirect(`https://developer.walgreens.com/oauth/authorize?${params.toString()}`);
}
