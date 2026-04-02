import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardView } from '@/components/DashboardView';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';

async function DashboardContent() {
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

  const [
    { data: medications },
    { data: appointments },
    { data: labResults },
    { data: claims },
  ] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id).order('date_time', { ascending: true }),
    supabase.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: false }).limit(5),
    supabase.from('claims').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
  ]);

  const patientName = profile.patient_name || 'your loved one';

  return (
    <DashboardView
      patientName={patientName}
      medications={medications || []}
      appointments={appointments || []}
      labResults={labResults || []}
      claims={claims || []}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
