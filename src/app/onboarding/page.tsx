import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { AmbientBackground } from '@/components/AmbientBackground';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check if user already completed onboarding
  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id, onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (profile?.onboarding_completed) {
    redirect('/dashboard');
  }

  const userName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <AmbientBackground />
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-16">
        <OnboardingWizard userName={userName} existingProfileId={profile?.id || null} />
      </div>
    </div>
  );
}
