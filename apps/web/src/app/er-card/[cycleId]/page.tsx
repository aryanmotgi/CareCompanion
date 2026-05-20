import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  treatmentCycles,
  careProfiles,
  users,
  medications,
  labResults,
  careGroupMembers,
} from '@/lib/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ cycleId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function isAncTest(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('anc') || n.includes('absolute neutrophil');
}

export default async function ErCardPage({ params }: Props) {
  const { cycleId } = await params;
  if (!UUID_RE.test(cycleId)) notFound();

  const session = await auth();
  if (!session?.user?.email) redirect(`/login?redirect=/er-card/${cycleId}`);

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
      patientAge: careProfiles.patientAge,
      dateOfBirth: careProfiles.dateOfBirth,
      cancerType: careProfiles.cancerType,
      cancerStage: careProfiles.cancerStage,
      allergies: careProfiles.allergies,
      conditions: careProfiles.conditions,
      sexAtBirth: careProfiles.sexAtBirth,
      emergencyContactName: careProfiles.emergencyContactName,
      emergencyContactPhone: careProfiles.emergencyContactPhone,
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

  const [meds, labs] = await Promise.all([
    db.select({
        name: medications.name,
        dose: medications.dose,
        frequency: medications.frequency,
      })
      .from(medications)
      .where(and(
        eq(medications.careProfileId, cycleRow.careProfileId),
        isNull(medications.deletedAt),
      ))
      .orderBy(medications.name)
      .catch(() => []),
    db.select({
        testName: labResults.testName,
        value: labResults.value,
        unit: labResults.unit,
        referenceRange: labResults.referenceRange,
        dateTaken: labResults.dateTaken,
        isAbnormal: labResults.isAbnormal,
      })
      .from(labResults)
      .where(and(
        eq(labResults.userId, cycleRow.patientUserId),
        isNull(labResults.deletedAt),
      ))
      .orderBy(desc(labResults.dateTaken))
      .limit(12)
      .catch(() => []),
  ]);

  const ancLab = labs.find((l) => isAncTest(l.testName));
  const otherLabs = labs.filter((l) => l !== ancLab).slice(0, 5);

  const startMs = new Date(cycleRow.startDate + 'T00:00:00').getTime();
  const todayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const dayOfCycle = Math.floor((todayMs - startMs) / 86400000) + 1;

  const age = cycleRow.patientAge ?? computeAge(cycleRow.dateOfBirth);
  const patientName = cycleRow.patientName?.trim() || 'Patient';

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.5in; }
          body { background: white !important; color: black !important; }
          .er-print-hide { display: none !important; }
          .er-card { box-shadow: none !important; border: 2px solid black !important; }
          a { color: black !important; text-decoration: none !important; }
        }
        @media screen {
          .er-card-bg { background: #f4f4f4; }
        }
        .er-section { page-break-inside: avoid; }
      `}</style>
      <div className="er-card-bg" style={{ minHeight: '100vh', padding: '24px 16px', color: '#000' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="er-print-hide" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <PrintButton />
          </div>

          <div
            className="er-card"
            style={{
              background: '#fff',
              border: '3px solid #000',
              borderRadius: 4,
              padding: '20px 24px',
              fontFamily: 'Helvetica, Arial, sans-serif',
              color: '#000',
              lineHeight: 1.35,
            }}
          >
            <h1
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                margin: 0,
                paddingBottom: 10,
                borderBottom: '3px solid #000',
                textAlign: 'center',
              }}
            >
              Oncology Patient — Neutropenic Fever Protocol
            </h1>

            <div style={{ fontSize: 13, textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
              Hand this card to ER staff. Fever ≥ 100.4°F (38°C) in a chemotherapy patient may indicate
              febrile neutropenia — empiric IV antibiotics within 60 minutes of presentation per IDSA guidance.
            </div>

            <Section title="Patient">
              <Row label="Name" value={patientName} bold />
              <Row label="Age" value={age !== null ? `${age}` : '—'} />
              <Row label="DOB" value={formatDate(cycleRow.dateOfBirth)} />
              <Row label="Sex at birth" value={cycleRow.sexAtBirth || '—'} />
              <Row label="Allergies" value={cycleRow.allergies?.trim() || 'None reported'} bold={!!cycleRow.allergies?.trim()} />
              {cycleRow.conditions?.trim() && (
                <Row label="Other conditions" value={cycleRow.conditions} />
              )}
            </Section>

            <Section title="Diagnosis">
              <Row label="Cancer type" value={cycleRow.cancerType || '—'} bold />
              <Row label="Stage" value={cycleRow.cancerStage || '—'} />
            </Section>

            <Section title="Current chemotherapy">
              <Row label="Regimen" value={cycleRow.regimenName || '—'} bold />
              <Row label="Cycle" value={`Cycle ${cycleRow.cycleNumber} · Day ${dayOfCycle} of ${cycleRow.cycleLengthDays}`} bold />
              <Row label="Cycle started" value={formatDate(cycleRow.startDate)} />
              {dayOfCycle >= 7 && dayOfCycle <= 14 && (
                <div style={{ marginTop: 6, padding: '8px 10px', border: '2px solid #000', fontWeight: 800, fontSize: 14 }}>
                  ⚠ NADIR WINDOW (day 7–14) — expect immunosuppression and low ANC.
                </div>
              )}
            </Section>

            <Section title="Most recent ANC (Absolute Neutrophil Count)">
              {ancLab ? (
                <>
                  <Row label="Value" value={`${ancLab.value ?? '—'}${ancLab.unit ? ' ' + ancLab.unit : ''}`} bold />
                  <Row label="Reference" value={ancLab.referenceRange || '—'} />
                  <Row label="Date taken" value={formatDate(ancLab.dateTaken)} />
                  {ancLab.isAbnormal && (
                    <div style={{ marginTop: 4, fontWeight: 800 }}>FLAGGED ABNORMAL</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 14 }}>No ANC value on file. Draw CBC with differential on presentation.</div>
              )}
            </Section>

            {otherLabs.length > 0 && (
              <Section title="Recent labs">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #000' }}>
                      <th style={thStyle}>Test</th>
                      <th style={thStyle}>Value</th>
                      <th style={thStyle}>Ref</th>
                      <th style={thStyle}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherLabs.map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                        <td style={tdStyle}>{l.testName}{l.isAbnormal ? ' ⚠' : ''}</td>
                        <td style={tdStyle}>{l.value ?? '—'}{l.unit ? ' ' + l.unit : ''}</td>
                        <td style={tdStyle}>{l.referenceRange || '—'}</td>
                        <td style={tdStyle}>{formatDate(l.dateTaken)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            <Section title={`Current medications (${meds.length})`}>
              {meds.length === 0 ? (
                <div style={{ fontSize: 14 }}>None on file.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #000' }}>
                      <th style={thStyle}>Medication</th>
                      <th style={thStyle}>Dose</th>
                      <th style={thStyle}>Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meds.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                        <td style={tdStyle}><strong>{m.name}</strong></td>
                        <td style={tdStyle}>{m.dose || '—'}</td>
                        <td style={tdStyle}>{m.frequency || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {(cycleRow.emergencyContactName || cycleRow.emergencyContactPhone) && (
              <Section title="Emergency contact">
                <Row label="Name" value={cycleRow.emergencyContactName || '—'} bold />
                <Row label="Phone" value={cycleRow.emergencyContactPhone || '—'} bold />
              </Section>
            )}

            <div style={{ borderTop: '2px solid #000', marginTop: 16, paddingTop: 10, fontSize: 11, textAlign: 'center' }}>
              Card generated {formatDate(new Date())} by CareCompanion. Verify all clinical details with patient
              or chart before treatment.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 4px',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 4px',
  verticalAlign: 'top',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="er-section" style={{ marginTop: 16 }}>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: '0 0 6px',
          paddingBottom: 3,
          borderBottom: '1.5px solid #000',
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 14, padding: '2px 0' }}>
      <span style={{ minWidth: 130, fontWeight: 600 }}>{label}:</span>
      <span style={{ fontWeight: bold ? 800 : 400 }}>{value}</span>
    </div>
  );
}
