import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, careProfiles, medications, labResults, appointments, claims, insurance } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';
import { UploadHub } from '@/components/UploadHub';
import type { UploadCategoryId } from '@/components/upload/CategoryUploadCard';

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.cognitoSub, session.user.id))
    .limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({ id: careProfiles.id, conditions: careProfiles.conditions, allergies: careProfiles.allergies })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/onboarding');

  const [
    [{ value: medCount }],
    [{ value: labCount }],
    [{ value: apptCount }],
    [{ value: claimCount }],
    insuranceRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(medications).where(eq(medications.careProfileId, profile.id)),
    db.select({ value: count() }).from(labResults).where(eq(labResults.userId, dbUser.id)),
    db.select({ value: count() }).from(appointments).where(eq(appointments.careProfileId, profile.id)),
    db.select({ value: count() }).from(claims).where(eq(claims.userId, dbUser.id)),
    db.select({ id: insurance.id }).from(insurance).where(eq(insurance.userId, dbUser.id)).limit(1),
  ]);

  const initialCounts: Record<UploadCategoryId, number> = {
    medications: Number(medCount),
    conditions: profile.conditions?.trim() ? 1 : 0,
    allergies: profile.allergies?.trim() ? 1 : 0,
    appointments: Number(apptCount),
    lab_results: Number(labCount),
    insurance: insuranceRows.length ? 1 : 0,
    claims: Number(claimCount),
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-white mb-1">Upload Health Records</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Upload photos or PDFs of your documents — your AI assistant uses this information to help you.
          </p>
        </div>
        <UploadHub initialCounts={initialCounts} />
      </div>
    </div>
  );
}
