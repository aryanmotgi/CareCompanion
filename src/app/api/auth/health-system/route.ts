import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const clientId = process.env.ONEUPH_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    redirect('/settings?error=1uphealth_not_configured');
  }

  // 1upHealth OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/health-system/callback`,
    response_type: 'code',
    scope: 'user/*.read',
    state: user.id,
  });

  redirect(`https://api.1up.health/connect/authorize?${params.toString()}`);
}
