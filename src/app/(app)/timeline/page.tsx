import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TreatmentTimeline } from '@/components/TreatmentTimeline';
import type { Medication, Appointment, LabResult, SymptomEntry } from '@/lib/types';

export const metadata = {
  title: 'Treatment Timeline | CareCompanion',
  description: 'Your complete care journey in one view',
};

function TimelineLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-48 rounded-lg bg-white/[0.06] animate-pulse" />
        <div className="h-4 w-64 rounded-lg bg-white/[0.04] animate-pulse mt-2" />
      </div>
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-white/[0.06] animate-pulse" />
        ))}
      </div>
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="w-3 h-3 rounded-full bg-white/[0.08] animate-pulse mt-1.5 shrink-0" />
            <div className="flex-1 h-24 rounded-2xl bg-white/[0.04] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function TimelineData() {
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

  const [
    { data: medications },
    { data: appointments },
    { data: labResults },
    { data: symptomEntries },
  ] = await Promise.all([
    supabase
      .from('medications')
      .select('*')
      .eq('care_profile_id', profile.id)
      .order('start_date', { ascending: false }),
    supabase
      .from('appointments')
      .select('*')
      .eq('care_profile_id', profile.id)
      .order('date_time', { ascending: false }),
    supabase
      .from('lab_results')
      .select('*')
      .eq('user_id', user.id)
      .order('date_taken', { ascending: false }),
    supabase
      .from('symptom_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false }),
  ]);

  return (
    <TreatmentTimeline
      medications={(medications as Medication[]) || []}
      appointments={(appointments as Appointment[]) || []}
      labResults={(labResults as LabResult[]) || []}
      symptomEntries={(symptomEntries as SymptomEntry[]) || []}
    />
  );
}

export default function TimelinePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Suspense fallback={<TimelineLoading />}>
        <TimelineData />
      </Suspense>
    </div>
  );
}
