import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Claim } from '@/lib/types'

const InsuranceView = dynamic(() => import('@/components/InsuranceView').then(m => m.InsuranceView))

export const metadata = {
  title: 'Insurance & Claims — CareCompanion',
  description: 'View and manage your insurance claims, appeals, and coverage.',
}

async function InsuranceContent() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: claims }, { data: insurance }] = await Promise.all([
    supabase
      .from('claims')
      .select('*')
      .eq('user_id', user.id)
      .order('service_date', { ascending: false }),
    supabase
      .from('insurance')
      .select('*')
      .eq('user_id', user.id)
      .single(),
  ])

  return (
    <InsuranceView
      claims={(claims as Claim[]) || []}
      insuranceProvider={insurance?.provider || null}
      memberId={insurance?.member_id || null}
      deductibleLimit={insurance?.deductible_limit || null}
      deductibleUsed={insurance?.deductible_used || 0}
      oopLimit={insurance?.oop_limit || null}
      oopUsed={insurance?.oop_used || 0}
    />
  )
}

function InsuranceSkeleton() {
  return (
    <div className="px-5 py-6 space-y-4 animate-pulse">
      <div className="h-7 bg-white/[0.06] rounded-lg w-48" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-white/[0.04] rounded-2xl border border-white/[0.06]" />
        ))}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 bg-white/[0.06] rounded-full w-20" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 bg-white/[0.04] rounded-2xl border border-white/[0.06]" />
      ))}
    </div>
  )
}

export default function InsurancePage() {
  return (
    <Suspense fallback={<InsuranceSkeleton />}>
      <InsuranceContent />
    </Suspense>
  )
}
