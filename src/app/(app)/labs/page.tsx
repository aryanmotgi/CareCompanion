import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { LabResult } from '@/lib/types'
import { LabsView } from './LabsView'

export const metadata = {
  title: 'Lab Results — CareCompanion',
}

async function LabsContent() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: labResults } = await supabase
    .from('lab_results')
    .select('*')
    .eq('user_id', user.id)
    .order('date_taken', { ascending: false })

  return <LabsView labResults={(labResults as LabResult[]) || []} />
}

function LabsSkeleton() {
  return (
    <div className="px-5 py-6 space-y-4 animate-pulse">
      <div className="h-7 bg-white/[0.06] rounded-lg w-32" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-white/[0.06] rounded-full w-20" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 bg-white/[0.04] rounded-2xl border border-white/[0.06]" />
      ))}
    </div>
  )
}

export default function LabsPage() {
  return (
    <Suspense fallback={<LabsSkeleton />}>
      <LabsContent />
    </Suspense>
  )
}
