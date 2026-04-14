import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HealthSummaryView } from '@/components/HealthSummaryView';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { getActiveProfile } from '@/lib/active-profile';

export default async function HealthSummaryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await getActiveProfile(supabase, user.id);
  if (!profile) redirect('/setup');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: labResults },
    { data: symptoms },
    { data: reminderLogs },
    { data: medications },
    { data: claims },
  ] = await Promise.all([
    supabase.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: true }),
    supabase.from('symptom_entries').select('*').eq('user_id', user.id).gte('date', thirtyDaysAgo.split('T')[0]).order('date', { ascending: true }),
    supabase.from('reminder_logs').select('*').eq('user_id', user.id).gte('created_at', thirtyDaysAgo).order('created_at'),
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('claims').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
  ]);

  const patientName = profile.patient_name || 'your loved one';

  return (
    <>
      <HealthSummaryView patientName={patientName} />
      <AnalyticsDashboard
        patientName={patientName}
        labResults={labResults || []}
        symptoms={symptoms || []}
        reminderLogs={reminderLogs || []}
        medications={medications || []}
        claims={claims || []}
      />
    </>
  );
}
