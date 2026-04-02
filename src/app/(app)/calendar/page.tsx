import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProfile } from '@/lib/active-profile';
import { CalendarView } from '@/components/CalendarView';

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await getActiveProfile(supabase, user.id);
  if (!profile) redirect('/setup');

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('care_profile_id', profile.id)
    .order('date_time', { ascending: true });

  const { data: medications } = await supabase
    .from('medications')
    .select('name, refill_date')
    .eq('care_profile_id', profile.id)
    .not('refill_date', 'is', null);

  return (
    <CalendarView
      appointments={appointments || []}
      medications={medications || []}
      patientName={profile.patient_name || 'your loved one'}
    />
  );
}
