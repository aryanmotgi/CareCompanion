import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardView } from '@/components/DashboardView';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { MedicationReminders } from '@/components/MedicationReminders';
import { DashboardInsights } from '@/components/DashboardInsights';

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

  if (!profile) redirect('/onboarding');

  const onboardingComplete = profile.onboarding_completed === true;

  // Get today's date boundaries for reminder logs
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    { data: medications },
    { data: appointments },
    { data: labResults },
    { data: claims },
    { data: reminderLogs },
    { data: connectedApps },
    { count: scannedDocCount },
    { count: doctorCount },
  ] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id).order('date_time', { ascending: true }),
    supabase.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: false }).limit(5),
    supabase.from('claims').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('reminder_logs').select('*').eq('user_id', user.id).gte('scheduled_time', todayStart.toISOString()).lte('scheduled_time', todayEnd.toISOString()).order('scheduled_time', { ascending: true }),
    supabase.from('connected_apps').select('*').eq('user_id', user.id),
    supabase.from('scanned_documents').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('doctors').select('*', { count: 'exact', head: true }).eq('care_profile_id', profile.id),
  ]);

  const hasHealthRecords = (connectedApps && connectedApps.length > 0) || false;
  const hasEmergencyContact = !!(profile.emergency_contact_name && profile.emergency_contact_phone);
  const hasDocumentsScanned = (scannedDocCount ?? 0) > 0;

  const patientName = profile.patient_name || 'your loved one';

  return (
    <>
      {(reminderLogs && reminderLogs.length > 0) && (
        <div className="px-4 sm:px-5 pt-5 sm:pt-6">
          <MedicationReminders reminders={reminderLogs} />
        </div>
      )}
      <DashboardView
        patientName={patientName}
        medications={medications || []}
        appointments={appointments || []}
        labResults={labResults || []}
        claims={claims || []}
        cancerType={profile.cancer_type || null}
        cancerStage={profile.cancer_stage || null}
        treatmentPhase={profile.treatment_phase || null}
        onboardingComplete={onboardingComplete}
        priorities={profile.onboarding_priorities || null}
        hasHealthRecords={hasHealthRecords}
        hasEmergencyContact={hasEmergencyContact}
        hasDocumentsScanned={hasDocumentsScanned}
        profileCreatedAt={profile.created_at}
        allergies={profile.allergies || null}
        conditions={profile.conditions || null}
        emergencyContactName={profile.emergency_contact_name || null}
        emergencyContactPhone={profile.emergency_contact_phone || null}
        doctorCount={doctorCount ?? 0}
        connectedAppCount={(connectedApps && connectedApps.length) || 0}
      />
      <div className="px-4 sm:px-5 pb-6">
        <DashboardInsights />
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
