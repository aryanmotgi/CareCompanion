import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CareTeamView } from '@/components/CareTeamView';

export default async function CareTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <CareTeamView />;
}
