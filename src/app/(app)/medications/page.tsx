import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MedicationsView } from '@/components/MedicationsView';

export default async function MedicationsPage() {
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

  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('care_profile_id', profile.id)
    .order('name', { ascending: true });

  return (
    <div className="max-w-3xl">
      <MedicationsView medications={medications || []} profileId={profile.id} />
    </div>
  );
}
