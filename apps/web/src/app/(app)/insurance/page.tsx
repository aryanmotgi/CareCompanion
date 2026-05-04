import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, claims, insurance } from '@/lib/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import type { Claim } from '@/lib/types'

const InsuranceView = dynamic(() => import('@/components/InsuranceView').then(m => m.InsuranceView))

export const metadata = {
  title: 'Insurance & Claims — CareCompanion',
  description: 'View and manage your insurance claims, appeals, and coverage.',
}

async function InsuranceContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  const [claimsData, insRows] = await Promise.all([
    db.select().from(claims).where(and(eq(claims.userId, dbUser.id), isNull(claims.deletedAt))).orderBy(desc(claims.serviceDate)).catch(() => []),
    db.select().from(insurance).where(eq(insurance.userId, dbUser.id)).limit(1).catch(() => []),
  ]);
  const [ins] = insRows;

  return (
    <InsuranceView
      claims={claimsData as Claim[]}
      insuranceProvider={ins?.provider || null}
      memberId={ins?.memberId || null}
      deductibleLimit={ins?.deductibleLimit != null ? parseFloat(ins.deductibleLimit) : null}
      deductibleUsed={ins?.deductibleUsed != null ? parseFloat(ins.deductibleUsed) : 0}
      oopLimit={ins?.oopLimit != null ? parseFloat(ins.oopLimit) : null}
      oopUsed={ins?.oopUsed != null ? parseFloat(ins.oopUsed) : 0}
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
