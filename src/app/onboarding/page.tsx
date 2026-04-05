import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { AmbientBackground } from '@/components/AmbientBackground';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id, onboarding_completed, cancer_type, cancer_stage, treatment_phase, relationship, patient_name, patient_age, onboarding_priorities')
    .eq('user_id', user.id)
    .single();

  const userName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
  const userEmail = user.email || '';
  const userAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <AmbientBackground />
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-16">
        <OnboardingWizard userName={userName} userEmail={userEmail} userAvatar={userAvatar} existingProfileId={profile?.id || null} existingProfile={profile || null} />
      </div>
    </div>
  );
}
