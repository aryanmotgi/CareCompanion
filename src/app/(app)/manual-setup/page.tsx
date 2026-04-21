import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, medications, doctors, appointments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SetupWizard } from '@/components/SetupWizard';
import type { Medication, Doctor, Appointment } from '@/lib/types';

export default async function ManualSetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.providerSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.userId, dbUser.id)).limit(1);

  // If onboarding hasn't been completed, redirect to the unified onboarding flow
  if (!profile || !profile.onboardingCompleted) {
    redirect('/onboarding');
  }

  const [meds, docs, appts] = await Promise.all([
    db.select().from(medications).where(eq(medications.careProfileId, profile.id)),
    db.select().from(doctors).where(eq(doctors.careProfileId, profile.id)),
    db.select().from(appointments).where(eq(appointments.careProfileId, profile.id)),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <SetupWizard
        initialStep={1}
        existingProfile={profile}
        existingMedications={meds as Medication[]}
        existingDoctors={docs as Doctor[]}
        existingAppointments={appts as Appointment[]}
      />
    </div>
  );
}
