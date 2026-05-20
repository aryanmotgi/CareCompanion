import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  treatmentCycles,
  careProfiles,
  users,
  wellnessCheckins,
  symptomEntries,
  reminderLogs,
  careGroupMembers,
} from '@/lib/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ cycleId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function NadirSummaryPage({ params }: Props) {
  const { cycleId } = await params;
  if (!UUID_RE.test(cycleId)) notFound();

  const session = await auth();
  if (!session?.user?.email) redirect(`/login?redirect=/nadir-summary/${cycleId}`);

  const [viewer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!viewer) redirect('/login?error=session');

  const [cycleRow] = await db
    .select({
      id: treatmentCycles.id,
      cycleNumber: treatmentCycles.cycleNumber,
      startDate: treatmentCycles.startDate,
      cycleLengthDays: treatmentCycles.cycleLengthDays,
      regimenName: treatmentCycles.regimenName,
      careProfileId: treatmentCycles.careProfileId,
      patientUserId: careProfiles.userId,
      patientName: careProfiles.patientName,
    })
    .from(treatmentCycles)
    .innerJoin(careProfiles, eq(careProfiles.id, treatmentCycles.careProfileId))
    .where(eq(treatmentCycles.id, cycleId))
    .limit(1);

  if (!cycleRow) notFound();

  let hasAccess = cycleRow.patientUserId === viewer.id;
  if (!hasAccess) {
    const [patientMembership] = await db
      .select({ careGroupId: careGroupMembers.careGroupId })
      .from(careGroupMembers)
      .where(eq(careGroupMembers.userId, cycleRow.patientUserId))
      .limit(1);

    if (patientMembership) {
      const [viewerMembership] = await db
        .select({ userId: careGroupMembers.userId })
        .from(careGroupMembers)
        .where(and(
          eq(careGroupMembers.careGroupId, patientMembership.careGroupId),
          eq(careGroupMembers.userId, viewer.id),
        ))
        .limit(1);
      hasAccess = !!viewerMembership;
    }
  }
  if (!hasAccess) notFound();

  const startMs = new Date(cycleRow.startDate + 'T00:00:00').getTime();
  const day7Start = new Date(startMs + 6 * 86400000);
  const day15Start = new Date(startMs + 14 * 86400000);

  const [checkins, symptoms, medLogs] = await Promise.all([
    db.select({
        checkedInAt: wellnessCheckins.checkedInAt,
        mood: wellnessCheckins.mood,
        pain: wellnessCheckins.pain,
        energy: wellnessCheckins.energy,
        sleep: wellnessCheckins.sleep,
        notes: wellnessCheckins.notes,
      })
      .from(wellnessCheckins)
      .where(and(
        eq(wellnessCheckins.careProfileId, cycleRow.careProfileId),
        gte(wellnessCheckins.checkedInAt, day7Start),
        lt(wellnessCheckins.checkedInAt, day15Start),
      ))
      .catch(() => []),
    db.select({
        date: symptomEntries.date,
        painLevel: symptomEntries.painLevel,
        symptoms: symptomEntries.symptoms,
        notes: symptomEntries.notes,
      })
      .from(symptomEntries)
      .where(and(
        eq(symptomEntries.careProfileId, cycleRow.careProfileId),
        gte(symptomEntries.date, day7Start.toISOString().slice(0, 10)),
        lt(symptomEntries.date, day15Start.toISOString().slice(0, 10)),
      ))
      .catch(() => []),
    db.select({
        medicationName: reminderLogs.medicationName,
        status: reminderLogs.status,
        scheduledTime: reminderLogs.scheduledTime,
      })
      .from(reminderLogs)
      .where(and(
        eq(reminderLogs.userId, cycleRow.patientUserId),
        gte(reminderLogs.scheduledTime, day7Start),
        lt(reminderLogs.scheduledTime, day15Start),
      ))
      .catch(() => []),
  ]);

  const allPainLevels: number[] = [
    ...checkins.map((c) => c.pain).filter((p): p is number => typeof p === 'number'),
    ...symptoms.map((s) => s.painLevel).filter((p): p is number => typeof p === 'number'),
  ];
  const maxPain = allPainLevels.length ? Math.max(...allPainLevels) : null;
  const avgPain = allPainLevels.length
    ? (allPainLevels.reduce((s, p) => s + p, 0) / allPainLevels.length)
    : null;

  const symptomList = Array.from(new Set(symptoms.flatMap((s) => s.symptoms || []))).slice(0, 12);
  const concerningCount = symptoms.filter((s) => (s.painLevel ?? 0) >= 8).length
    + checkins.filter((c) => c.pain >= 8).length;

  const medsTaken = medLogs.filter((m) => m.status === 'taken').length;
  const medsTotal = medLogs.length;
  const adherenceRate = medsTotal > 0 ? Math.round((medsTaken / medsTotal) * 100) : null;

  const medNames = Array.from(new Set(medLogs.map((m) => m.medicationName))).slice(0, 8);

  const status = concerningCount === 0
    ? 'Nadir completed without concerning symptoms logged'
    : `Nadir completed — ${concerningCount} concerning ${concerningCount === 1 ? 'symptom' : 'symptoms'} logged`;
  const statusTone: 'good' | 'watch' = concerningCount === 0 ? 'good' : 'watch';

  const patientName = cycleRow.patientName?.trim() || 'Patient';
  const nadirRange = `${formatDate(day7Start)} – ${formatDate(new Date(day15Start.getTime() - 86400000))}`;

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c1a', padding: '32px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', color: 'white' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A78BFA', marginBottom: 8 }}>
            CareCompanion · Nadir Summary
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
            {patientName} · Cycle {cycleRow.cycleNumber}
          </h1>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
            Nadir window: {nadirRange}
            {cycleRow.regimenName ? ` · ${cycleRow.regimenName}` : ''}
          </div>
        </div>

        <div
          style={{
            padding: '18px 20px',
            borderRadius: 16,
            border: `1px solid ${statusTone === 'good' ? 'rgba(74, 222, 128, 0.32)' : 'rgba(251, 191, 36, 0.36)'}`,
            background: statusTone === 'good'
              ? 'linear-gradient(180deg, rgba(74, 222, 128, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)'
              : 'linear-gradient(180deg, rgba(254, 243, 199, 0.08) 0%, rgba(180, 83, 9, 0.10) 100%)',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">
            {statusTone === 'good' ? '✅' : '⚠️'}
          </span>
          <div style={{ fontSize: 15, fontWeight: 600, color: statusTone === 'good' ? '#86efac' : '#fbbf24' }}>
            {status}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <StatCard label="Check-ins" value={String(checkins.length + symptoms.length)} hint="days logged" />
          <StatCard label="Avg pain" value={avgPain !== null ? avgPain.toFixed(1) : '—'} hint={maxPain !== null ? `peak ${maxPain}/10` : 'not tracked'} />
          <StatCard label="Meds taken" value={medsTotal > 0 ? `${medsTaken}/${medsTotal}` : '—'} hint={adherenceRate !== null ? `${adherenceRate}% adherence` : 'not tracked'} />
          <StatCard label="Symptoms" value={String(symptomList.length)} hint={symptomList.length === 0 ? 'none logged' : 'distinct tags'} />
        </div>

        {symptomList.length > 0 && (
          <SummarySection title="Symptoms logged">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {symptomList.map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(167,139,250,0.10)',
                    border: '1px solid rgba(167,139,250,0.22)',
                    color: 'rgba(226,232,240,0.85)',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </SummarySection>
        )}

        {medNames.length > 0 && (
          <SummarySection title="Medications during nadir">
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {medNames.map((m) => (
                <li key={m} style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)' }}>• {m}</li>
              ))}
            </ul>
          </SummarySection>
        )}

        {checkins.length === 0 && symptoms.length === 0 && (
          <SummarySection title="No check-ins logged">
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              No wellness check-ins or symptom entries were recorded during this nadir window.
              Status reflects absence of reported concerns, not absence of symptoms.
            </div>
          </SummarySection>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 24 }}>
          Generated by CareCompanion · Cycle started {formatDate(new Date(startMs))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div
      style={{
        padding: '14px 14px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.7)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{hint}</div>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 14,
        padding: '14px 16px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.7)', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
