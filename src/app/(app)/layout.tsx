import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

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

  // Fetch profile data for sidebar
  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Don't redirect if no profile — the connect page will handle profile creation
  // Only redirect if user has no profile AND is not on the connect or manual-setup page

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  const displayName = user.user_metadata?.display_name || '';

  return (
    <AppShell
      patientName={profile?.patient_name || 'your loved one'}
      patientAge={profile?.patient_age}
      relationship={profile?.relationship}
      userName={displayName}
      notifications={notifications || []}
    >
      {children}
    </AppShell>
  );
}
