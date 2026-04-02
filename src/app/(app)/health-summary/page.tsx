import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HealthSummaryView } from '@/components/HealthSummaryView';

export default async function HealthSummaryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('patient_name')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/setup');

  return <HealthSummaryView patientName={profile.patient_name || 'your loved one'} />;
}
