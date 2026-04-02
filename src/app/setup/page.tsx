import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // New users go straight to the connect page
  // The connect page handles profile creation and account linking
  redirect('/connect');
}
