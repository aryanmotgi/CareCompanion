import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppointmentsView } from '@/components/AppointmentsView';

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/setup');

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('care_profile_id', profile.id)
    .order('date_time', { ascending: true });

  return (
    <div className="max-w-3xl">
      <AppointmentsView appointments={appointments || []} profileId={profile.id} />
    </div>
  );
}
