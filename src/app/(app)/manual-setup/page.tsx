import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SetupWizard } from '@/components/SetupWizard';
import type { Medication, Doctor, Appointment } from '@/lib/types';

export default async function ManualSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // If no profile at all, create a minimal one first
  if (!profile) {
    const { data: newProfile } = await supabase
      .from('care_profiles')
      .insert({ user_id: user.id, patient_name: 'My loved one' })
      .select('*')
      .single();

    if (!newProfile) redirect('/connect');

    return (
      <div className="max-w-2xl mx-auto">
        <SetupWizard
          initialStep={1}
          existingProfile={newProfile}
          existingMedications={[]}
          existingDoctors={[]}
          existingAppointments={[]}
        />
      </div>
    );
  }

  const [{ data: meds }, { data: docs }, { data: appts }] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <SetupWizard
        initialStep={1}
        existingProfile={profile}
        existingMedications={(meds || []) as Medication[]}
        existingDoctors={(docs || []) as Doctor[]}
        existingAppointments={(appts || []) as Appointment[]}
      />
    </div>
  );
}
