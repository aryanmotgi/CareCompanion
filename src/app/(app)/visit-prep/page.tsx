import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VisitPrepView } from '@/components/VisitPrepView';
import { SkeletonCard } from '@/components/SkeletonCard';

export const metadata = {
  title: 'Visit Prep — CareCompanion',
};

function VisitPrepSkeleton() {
  return (
    <div className="space-y-4 px-5 py-4">
      <div className="space-y-2">
        <div className="h-6 w-40 skeleton-bone" />
        <div className="h-3 w-56 skeleton-bone" style={{ animationDelay: '0.1s' }} />
      </div>
      <SkeletonCard />
      <SkeletonCard variant="wide" />
      <SkeletonCard />
    </div>
  );
}

async function VisitPrepData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/setup');

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('care_profile_id', profile.id)
    .gte('date_time', now.toISOString())
    .lte('date_time', thirtyDaysOut.toISOString())
    .order('date_time', { ascending: true });

  return <VisitPrepView appointments={appointments || []} />;
}

export default function VisitPrepPage() {
  return (
    <div className="max-w-3xl">
      <Suspense fallback={<VisitPrepSkeleton />}>
        <VisitPrepData />
      </Suspense>
    </div>
  );
}
