import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ConnectAccounts } from '@/components/ConnectAccounts';

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
