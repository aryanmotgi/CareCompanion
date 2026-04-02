import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScanCenter } from '@/components/ScanCenter'

export default async function ScansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  let documents: { id: string; type: string; description: string | null; document_date: string | null }[] = []
  if (profile) {
    const { data } = await supabase
      .from('documents')
      .select('id, type, description, document_date')
      .eq('care_profile_id', profile.id)
      .order('document_date', { ascending: false })
      .limit(20)
    documents = data || []
  }

  return <ScanCenter documents={documents} />
}
