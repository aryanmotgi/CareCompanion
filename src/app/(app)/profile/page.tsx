import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileEditor } from '@/components/ProfileEditor';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/setup');

  const [{ data: medications }, { data: doctors }, { data: appointments }] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id),
  ]);

  return (
    <div className="max-w-3xl">
      <ProfileEditor
        profile={profile}
        medications={medications || []}
        doctors={doctors || []}
        appointments={appointments || []}
      />
    </div>
  );
}
