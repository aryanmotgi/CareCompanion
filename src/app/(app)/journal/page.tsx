import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SymptomJournal } from '@/components/SymptomJournal';

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id, patient_name')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/setup');

  // Fetch last 14 days of entries
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: entries } = await supabase
    .from('symptom_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', since)
    .order('date', { ascending: false });

  return (
    <SymptomJournal
      patientName={profile.patient_name || 'your loved one'}
      initialEntries={entries || []}
    />
  );
}
