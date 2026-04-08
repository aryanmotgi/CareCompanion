import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import { ToastProvider } from '@/components/ToastProvider';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { getActiveProfile, getAllProfiles } from '@/lib/active-profile';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch active profile and all accessible profiles
  const [profile, allProfiles] = await Promise.all([
    getActiveProfile(supabase, user.id),
    getAllProfiles(supabase, user.id),
  ]);

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  const displayName = user.user_metadata?.display_name || '';

  return (
    <ToastProvider>
      <OfflineIndicator />
      <AppShell
        patientName={profile?.patient_name || 'your loved one'}
        patientAge={profile?.patient_age}
        relationship={profile?.relationship}
        userName={displayName}
        notifications={notifications || []}
        profiles={allProfiles}
        activeProfileId={profile?.id || null}
      >
        <div className="animate-page-blur-in">
          {children}
        </div>
      </AppShell>
    </ToastProvider>
  );
}
