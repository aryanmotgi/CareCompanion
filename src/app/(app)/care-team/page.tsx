import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CareTeamView } from '@/components/CareTeamView';

export default async function CareTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ accept?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const acceptInviteId = params.accept || null;

  return <CareTeamView acceptInviteId={acceptInviteId} />;
}
