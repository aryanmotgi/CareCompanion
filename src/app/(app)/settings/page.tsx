import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SettingsPage } from '@/components/SettingsPage';

export default async function Settings() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: connectedApps }, { data: notifications }] = await Promise.all([
    supabase.from('connected_apps').select('*').eq('user_id', user.id),
    supabase.from('notifications').select('*').eq('user_id', user.id).eq('is_read', false).order('created_at', { ascending: false }).limit(20),
  ]);

  return (
    <div className="max-w-3xl">
      <SettingsPage
        connectedApps={connectedApps || []}
        unreadNotifications={notifications || []}
      />
    </div>
  );
}
