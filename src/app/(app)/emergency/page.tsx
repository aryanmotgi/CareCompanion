import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EmergencyCard } from '@/components/EmergencyCard';

export default async function EmergencyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/setup');

  const [
    { data: medications },
    { data: doctors },
    { data: insurance },
  ] = await Promise.all([
    supabase.from('medications').select('name, dose, frequency').eq('care_profile_id', profile.id),
    supabase.from('doctors').select('name, specialty, phone').eq('care_profile_id', profile.id),
    supabase.from('insurance').select('provider, member_id, group_number').eq('user_id', user.id).limit(1).single(),
  ]);

  return (
    <EmergencyCard
      patient={{
        name: profile.patient_name || 'Unknown',
        age: profile.patient_age,
        conditions: profile.conditions,
        allergies: profile.allergies,
        emergencyContactName: profile.emergency_contact_name,
        emergencyContactPhone: profile.emergency_contact_phone,
      }}
      medications={(medications || []).map((m) => ({
        name: m.name,
        dose: m.dose || '',
        frequency: m.frequency || '',
      }))}
      doctors={(doctors || []).map((d) => ({
        name: d.name,
        specialty: d.specialty || '',
        phone: d.phone || '',
      }))}
      insurance={insurance ? {
        provider: insurance.provider,
        memberId: insurance.member_id || '',
        groupNumber: insurance.group_number || '',
      } : null}
    />
  );
}
