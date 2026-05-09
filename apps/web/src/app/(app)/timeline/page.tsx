import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import {
  users,
  careProfiles,
  medications,
  appointments,
  labResults,
  wellnessCheckins,
  symptomInsights,
  treatmentCycles,
  symptomEntries,
} from '@/lib/db/schema';
import { and, eq, desc, gte, isNull } from 'drizzle-orm';
import { TreatmentTimeline } from '@/components/TreatmentTimeline';
import type { TimelineEvent } from '@/components/TimelineNode';

export const metadata = {
  title: 'Treatment Timeline | CareCompanion',
  description: 'Your complete care journey in one view',
};

function TimelineLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-48 rounded-lg bg-white/[0.06] animate-pulse" />
        <div className="h-4 w-64 rounded-lg bg-white/[0.04] animate-pulse mt-2" />
      </div>
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-white/[0.06] animate-pulse" />
        ))}
      </div>
      <div className="relative pl-8">
        <div
          className="absolute left-[11px] top-0 bottom-0 w-[3px] rounded-full"
          style={{
            background: 'repeating-linear-gradient(180deg, rgba(99,102,241,0.1) 0px, rgba(99,102,241,0.1) 6px, transparent 6px, transparent 12px)',
          }}
        />
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="relative">
              <div
                className="absolute rounded-full bg-white/[0.08] animate-pulse"
                style={{ left: '-22px', top: '6px', width: '10px', height: '10px' }}
              />
              <div className="ml-0">
                <div className="h-3 w-20 rounded bg-white/[0.04] animate-pulse mb-2" />
                <div className="h-20 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function TimelineData() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const [dbUser] = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.email, session.user.email!))
    .limit(1);
  if (!dbUser) redirect('/login?error=session');

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/setup');

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Fetch all data sources in parallel
  const [medsData, apptsData, labsData, checkinsData, insightsData, cyclesData, symptomsData] =
    await Promise.all([
      db
        .select()
        .from(medications)
        .where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt)))
        .orderBy(desc(medications.createdAt))
        .catch(() => []),
      db
        .select()
        .from(appointments)
        .where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt)))
        .orderBy(desc(appointments.dateTime))
        .catch(() => []),
      db
        .select()
        .from(labResults)
        .where(and(eq(labResults.userId, dbUser.id), isNull(labResults.deletedAt)))
        .orderBy(desc(labResults.dateTaken))
        .catch(() => []),
      db
        .select()
        .from(wellnessCheckins)
        .where(and(eq(wellnessCheckins.careProfileId, profile.id), gte(wellnessCheckins.checkedInAt, ninetyDaysAgo)))
        .orderBy(desc(wellnessCheckins.checkedInAt))
        .catch(() => []),
      db
        .select()
        .from(symptomInsights)
        .where(and(eq(symptomInsights.careProfileId, profile.id), gte(symptomInsights.createdAt, ninetyDaysAgo)))
        .orderBy(desc(symptomInsights.createdAt))
        .catch(() => []),
      db
        .select()
        .from(treatmentCycles)
        .where(eq(treatmentCycles.careProfileId, profile.id))
        .catch(() => []),
      db
        .select()
        .from(symptomEntries)
        .where(eq(symptomEntries.userId, dbUser.id))
        .orderBy(desc(symptomEntries.date))
        .catch(() => []),
    ]);

  // Build unified events array
  const events: TimelineEvent[] = [];

  // Medications
  for (const med of medsData) {
    const dateStr = med.createdAt ? new Date(med.createdAt).toISOString() : null;
    if (!dateStr) continue;
    events.push({
      id: `med-${med.id}`,
      type: 'medication',
      date: dateStr,
      title: med.name,
      subtitle: med.dose ? `${med.dose}${med.frequency ? ` — ${med.frequency}` : ''}` : 'Medication started',
      data: { dose: med.dose, frequency: med.frequency, prescribingDoctor: med.prescribingDoctor },
    });
  }

  // Appointments
  for (const appt of apptsData) {
    const dateStr = appt.dateTime
      ? new Date(appt.dateTime).toISOString()
      : appt.createdAt
        ? new Date(appt.createdAt).toISOString()
        : null;
    if (!dateStr) continue;
    events.push({
      id: `appt-${appt.id}`,
      type: 'appointment',
      date: dateStr,
      title: appt.purpose || appt.specialty || 'Appointment',
      subtitle: appt.doctorName ? `Dr. ${appt.doctorName}` : null,
      data: { doctorName: appt.doctorName, specialty: appt.specialty, location: appt.location },
    });
  }

  // Lab results
  for (const lab of labsData) {
    const dateStr = lab.dateTaken
      ? new Date(lab.dateTaken).toISOString()
      : lab.createdAt
        ? new Date(lab.createdAt).toISOString()
        : null;
    if (!dateStr) continue;
    events.push({
      id: `lab-${lab.id}`,
      type: 'lab',
      date: dateStr,
      title: lab.testName,
      subtitle: lab.value ? `${lab.value}${lab.unit ? ` ${lab.unit}` : ''}` : 'Pending',
      severity: lab.isAbnormal ? 'alert' : null,
      data: { value: lab.value, unit: lab.unit, referenceRange: lab.referenceRange, isAbnormal: lab.isAbnormal },
    });
  }

  // Wellness check-ins
  for (const checkin of checkinsData) {
    const dateStr = checkin.checkedInAt ? new Date(checkin.checkedInAt).toISOString() : null;
    if (!dateStr) continue;
    const moodDescriptions: Record<number, string> = { 1: 'Very low', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };
    events.push({
      id: `checkin-${checkin.id}`,
      type: 'checkin',
      date: dateStr,
      title: 'Wellness Check-in',
      subtitle: `Mood: ${moodDescriptions[checkin.mood] || checkin.mood}/5 — Pain: ${checkin.pain}/10`,
      severity: checkin.pain >= 7 ? 'alert' : checkin.mood >= 4 ? 'positive' : 'info',
      data: { mood: checkin.mood, pain: checkin.pain, energy: checkin.energy, sleep: checkin.sleep, notes: checkin.notes },
    });
  }

  // Symptom insights
  for (const insight of insightsData) {
    const dateStr = insight.createdAt ? new Date(insight.createdAt).toISOString() : null;
    if (!dateStr) continue;
    events.push({
      id: `insight-${insight.id}`,
      type: 'insight',
      date: dateStr,
      title: insight.title,
      subtitle: insight.body.length > 100 ? insight.body.slice(0, 100) + '...' : insight.body,
      severity: insight.severity as 'info' | 'watch' | 'alert',
      isMilestone: insight.type === 'milestone',
      data: { body: insight.body, insightType: insight.type, status: insight.status },
    });
  }

  // Treatment cycles
  for (const cycle of cyclesData) {
    const dateStr = cycle.startDate ? new Date(cycle.startDate).toISOString() : null;
    if (!dateStr) continue;
    events.push({
      id: `cycle-${cycle.id}`,
      type: 'cycle',
      date: dateStr,
      title: `Cycle ${cycle.cycleNumber}${cycle.regimenName ? ` — ${cycle.regimenName}` : ''}`,
      subtitle: `${cycle.cycleLengthDays}-day cycle${cycle.isActive ? ' (active)' : ''}`,
      isMilestone: true,
      data: { cycleNumber: cycle.cycleNumber, regimenName: cycle.regimenName, cycleLengthDays: cycle.cycleLengthDays },
    });
  }

  // Symptom entries
  for (const entry of symptomsData) {
    const dateStr = entry.date
      ? new Date(entry.date).toISOString()
      : entry.createdAt
        ? new Date(entry.createdAt).toISOString()
        : null;
    if (!dateStr) continue;
    const symptomList = entry.symptoms || [];
    events.push({
      id: `symptom-${entry.id}`,
      type: 'symptom',
      date: dateStr,
      title: symptomList.length > 0 ? symptomList.slice(0, 3).join(', ') : 'Symptom Entry',
      subtitle: entry.notes
        ? entry.notes.slice(0, 80) + (entry.notes.length > 80 ? '...' : '')
        : entry.painLevel != null
          ? `Pain: ${entry.painLevel}/10`
          : 'Symptom check-in',
      severity: entry.painLevel != null && entry.painLevel >= 7 ? 'alert' : 'info',
      data: { painLevel: entry.painLevel, mood: entry.mood, symptoms: symptomList },
    });
  }

  // Sort descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return <TreatmentTimeline events={events} />;
}

export default function TimelinePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Suspense fallback={<TimelineLoading />}>
        <TimelineData />
      </Suspense>
    </div>
  );
}
