import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ConnectedApp, Medication, Appointment, LabResult, Document } from '@/lib/types'

const RecordsView = dynamic(() => import('@/components/RecordsView').then(m => m.RecordsView))

export const metadata = {
  title: 'Health Records — CareCompanion',
}

async function RecordsContent() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id, conditions, allergies')
    .eq('user_id', user.id)
    .single()

  const [
    { data: connectedApps },
    { data: medications },
    { data: appointments },
    { data: labResults },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from('connected_apps')
      .select('*')
      .eq('user_id', user.id),
    profile
      ? supabase
          .from('medications')
          .select('*')
          .eq('care_profile_id', profile.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Medication[] }),
    profile
      ? supabase
          .from('appointments')
          .select('*')
          .eq('care_profile_id', profile.id)
          .order('date_time', { ascending: false })
      : Promise.resolve({ data: [] as Appointment[] }),
    supabase
      .from('lab_results')
      .select('*')
      .eq('user_id', user.id)
      .order('date_taken', { ascending: false }),
    profile
      ? supabase
          .from('documents')
          .select('*')
          .eq('care_profile_id', profile.id)
          .order('document_date', { ascending: false })
      : Promise.resolve({ data: [] as Document[] }),
  ])

  return (
    <RecordsView
      connectedApps={(connectedApps as ConnectedApp[]) || []}
      medications={(medications as Medication[]) || []}
      appointments={(appointments as Appointment[]) || []}
      labResults={(labResults as LabResult[]) || []}
      documents={(documents as Document[]) || []}
      conditions={profile?.conditions || null}
      allergies={profile?.allergies || null}
    />
  )
}

function RecordsSkeleton() {
  return (
    <div className="px-5 py-6 space-y-4 animate-pulse">
      <div className="h-7 bg-white/[0.06] rounded-lg w-40" />
      <div className="h-4 bg-white/[0.04] rounded w-56" />
      {/* Connected systems skeleton */}
      <div className="h-20 bg-white/[0.04] rounded-2xl border border-white/[0.06]" />
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 bg-white/[0.06] rounded-full w-24" />
        ))}
      </div>
      {/* Cards skeleton */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 bg-white/[0.04] rounded-2xl border border-white/[0.06]" />
      ))}
    </div>
  )
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<RecordsSkeleton />}>
      <RecordsContent />
    </Suspense>
  )
}
