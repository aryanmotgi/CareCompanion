// Note: This page is also accessible from Settings > Connected Accounts.
// It works as a standalone page and is linked from the sidebar menu and settings.
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const ConnectAccounts = dynamic(() => import('@/components/ConnectAccounts').then(m => m.ConnectAccounts));

export default async function ConnectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: connectedApps }, { data: profile }] = await Promise.all([
    supabase.from('connected_apps').select('*').eq('user_id', user.id),
    supabase.from('care_profiles').select('patient_name').eq('user_id', user.id).single(),
  ]);

  return (
    <ConnectAccounts
      connectedApps={connectedApps || []}
      patientName={profile?.patient_name}
      hasProfile={!!profile}
    />
  );
}
