import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, medications, doctors, insurance } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { getActiveProfile } from '@/lib/active-profile';
import { EmergencyCard } from '@/components/EmergencyCard';

export default async function EmergencyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  const profile = await getActiveProfile(dbUser.id);
  if (!profile) redirect('/setup');

  const [meds, docs, insRows] = await Promise.all([
    db.select({ name: medications.name, dose: medications.dose, frequency: medications.frequency })
      .from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))).catch(() => []),
    db.select({ name: doctors.name, specialty: doctors.specialty, phone: doctors.phone })
      .from(doctors).where(and(eq(doctors.careProfileId, profile.id), isNull(doctors.deletedAt))).catch(() => []),
    db.select({ provider: insurance.provider, memberId: insurance.memberId, groupNumber: insurance.groupNumber })
      .from(insurance).where(eq(insurance.userId, dbUser.id)).limit(1).catch(() => []),
  ]);
  const [ins] = insRows;

  return (
    <EmergencyCard
      patient={{
        name: profile.patientName || 'Unknown',
        age: profile.patientAge,
        conditions: profile.conditions,
        allergies: profile.allergies,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: profile.emergencyContactPhone,
        updatedAt: profile.createdAt, // TODO: add updatedAt to careProfiles schema — currently no timestamp tracks last edit
      }}
      medications={meds.map((m) => ({
        name: m.name,
        dose: m.dose || '',
        frequency: m.frequency || '',
      }))}
      doctors={docs.map((d) => ({
        name: d.name,
        specialty: d.specialty || '',
        phone: d.phone || '',
      }))}
      insurance={ins ? {
        provider: ins.provider,
        memberId: ins.memberId || '',
        groupNumber: ins.groupNumber || '',
      } : null}
    />
  );
}
