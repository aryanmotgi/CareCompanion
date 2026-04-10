import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NotificationsView } from '@/components/NotificationsView'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return <NotificationsView notifications={notifications || []} />
}
