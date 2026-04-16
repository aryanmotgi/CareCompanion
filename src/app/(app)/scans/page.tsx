import { Suspense } from 'react'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, careProfiles, documents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ScanCenter } from '@/components/ScanCenter'
import { ScansSkeleton } from '@/components/skeletons/ScansSkeleton'

async function ScansContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select().from(users).where(eq(users.cognitoSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  let docs: { id: string; type: string | null; description: string | null; documentDate: string | null }[] = [];
  if (profile) {
    docs = await db
      .select({ id: documents.id, type: documents.type, description: documents.description, documentDate: documents.documentDate })
      .from(documents)
      .where(eq(documents.careProfileId, profile.id))
      .orderBy(desc(documents.documentDate))
      .limit(20);
  }

  // Map to shape expected by ScanCenter (filter out docs with null type)
  const docsForView = docs
    .filter((d): d is typeof d & { type: string } => d.type !== null)
    .map(d => ({
      id: d.id,
      type: d.type,
      description: d.description,
      document_date: d.documentDate,
    }));

  return <ScanCenter documents={docsForView} />
}

export default function ScansPage() {
  return (
    <Suspense fallback={<ScansSkeleton />}>
      <ScansContent />
    </Suspense>
  )
}
