import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { sharedLinks } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface SharedData {
  patient?: { name?: string; cancerType?: string; cancerStage?: string; treatmentPhase?: string; conditions?: string; allergies?: string };
  medications?: { name: string; dose?: string | null; frequency?: string | null; prescribingDoctor?: string | null; notes?: string | null }[];
  lab_results?: { name: string; value?: string | null; unit?: string | null; referenceRange?: string | null; date?: string | null; status?: string | null }[];
  appointments?: { doctorName?: string | null; specialty?: string | null; dateTime?: string | null; location?: string | null; purpose?: string | null }[];
  care_team?: { name: string; specialty?: string | null; phone?: string | null }[];
}

interface WeeklyData {
  narrative: string;
  patientName?: string;
  cancerType?: string;
  treatmentPhase?: string;
  weekOf?: string;
  stats?: {
    symptomDays: number;
    adherenceRate: number | null;
    commonSymptoms: string[];
    avgPain: string | null;
    newLabs: number;
    upcomingAppointments: { doctorName?: string | null; specialty?: string | null; dateTime?: string | null; purpose?: string | null }[];
  };
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <span className="text-[#A78BFA]">{icon}</span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-xs text-white/40 w-28 flex-shrink-0">{label}</span>
      <span className="text-sm text-white/80">{value}</span>
    </div>
  );
}

const MedIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L4.2 15.3" />
  </svg>
);

const CalIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </svg>
);

const TeamIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
  </svg>
);

const PersonIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);

function WeeklySummaryPage({
  link,
  weekly,
  stats,
}: {
  link: { title?: string | null; createdAt?: Date | null; expiresAt: Date };
  weekly: WeeklyData;
  stats: WeeklyData['stats'];
}) {
  const expiresDate = new Date(link.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen" style={{ background: '#0c0c1a' }}>
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">CareCompanion</span>
          </Link>
          <span className="text-xs text-white/30">Weekly Update · {weekly.weekOf}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Title */}
        <div>
          <p className="text-xs font-medium text-[#A78BFA] uppercase tracking-wider mb-2">Weekly Care Update</p>
          <h1 className="text-2xl font-bold text-white">
            {weekly.patientName ? `How ${weekly.patientName} is doing` : 'This week in care'}
          </h1>
          {weekly.cancerType && (
            <p className="text-sm text-white/40 mt-1">{weekly.cancerType}{weekly.treatmentPhase ? ` · ${weekly.treatmentPhase}` : ''}</p>
          )}
        </div>

        {/* AI Narrative */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-white/60">CareCompanion AI</span>
          </div>
          <div className="space-y-3">
            {weekly.narrative.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} className="text-sm text-white/80 leading-relaxed">{para}</p>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.symptomDays > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-bold text-white">{stats.symptomDays}</p>
                <p className="text-xs text-white/40 mt-1">Days tracked</p>
              </div>
            )}
            {stats.adherenceRate !== null && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                <p className={`text-2xl font-bold ${stats.adherenceRate >= 80 ? 'text-emerald-400' : stats.adherenceRate >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                  {stats.adherenceRate}%
                </p>
                <p className="text-xs text-white/40 mt-1">Meds taken</p>
              </div>
            )}
            {stats.avgPain && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-bold text-white">{stats.avgPain}<span className="text-sm text-white/40">/10</span></p>
                <p className="text-xs text-white/40 mt-1">Avg pain</p>
              </div>
            )}
            {stats.newLabs > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-bold text-white">{stats.newLabs}</p>
                <p className="text-xs text-white/40 mt-1">New labs</p>
              </div>
            )}
          </div>
        )}

        {/* Common symptoms */}
        {stats && stats.commonSymptoms.length > 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Symptoms this week</h2>
            <div className="flex flex-wrap gap-2">
              {stats.commonSymptoms.map((s, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-white/[0.06] text-xs text-white/60 capitalize">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming appointments */}
        {stats && stats.upcomingAppointments.length > 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Coming up this week</h2>
            <div className="space-y-2">
              {stats.upcomingAppointments.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-sm text-white">{a.purpose || a.specialty || 'Appointment'}</p>
                    {a.doctorName && <p className="text-xs text-white/40">with {a.doctorName}</p>}
                  </div>
                  {a.dateTime && (
                    <span className="text-xs text-white/50">
                      {new Date(a.dateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Viral CTA — the growth engine */}
        <div className="rounded-2xl border border-[#6366F1]/40 bg-gradient-to-br from-[#6366F1]/10 to-[#A78BFA]/10 p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Supporting someone through cancer?</h3>
            <p className="text-sm text-white/60 mt-1">
              CareCompanion helps caregivers track medications, labs, appointments, and symptoms — and get AI answers at 2am when you need them most. Free.
            </p>
          </div>
          <Link
            href="/chat/guest"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Try it free — no signup needed
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <p className="text-xs text-white/30">Just start talking. No credit card, no account needed to start.</p>
        </div>

        {/* Footer */}
        <div className="pb-8 text-center space-y-1">
          <p className="text-xs text-white/20">Shared privately via CareCompanion. Expires {expiresDate}.</p>
          <p className="text-xs text-white/20">Not a medical record. Always consult your care team for medical decisions.</p>
        </div>
      </div>
    </div>
  );
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [link] = await db.select().from(sharedLinks).where(eq(sharedLinks.token, token)).limit(1);

  if (!link) notFound();

  if (new Date(link.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#0c0c1a' }}>
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Link Expired</h1>
          <p className="text-sm text-white/40">This shared health summary has expired. Ask the sender to share it again.</p>
        </div>
      </div>
    );
  }

  // Increment view count (fire-and-forget)
  db.update(sharedLinks).set({ viewCount: sql`${sharedLinks.viewCount} + 1` }).where(eq(sharedLinks.token, token)).catch(() => {});

  // Weekly summary gets its own layout
  if (link.type === 'weekly_summary') {
    const weekly = link.data as WeeklyData;
    const stats = weekly.stats;
    return <WeeklySummaryPage link={link} weekly={weekly} stats={stats} />;
  }

  const data = link.data as SharedData;
  const expiresDate = new Date(link.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const createdDate = link.createdAt
    ? new Date(link.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const futureAppts = (data.appointments ?? []).filter(a => a.dateTime && new Date(a.dateTime) >= new Date());

  return (
    <div className="min-h-screen" style={{ background: '#0c0c1a' }}>
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">CareCompanion</span>
          </Link>
          <span className="text-xs text-white/30">Shared · Expires {expiresDate}</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">{link.title || 'Health Summary'}</h1>
          {createdDate && <p className="text-sm text-white/40 mt-1">Shared on {createdDate}</p>}
        </div>

        {/* Patient overview */}
        {data.patient && Object.values(data.patient).some(Boolean) && (
          <Section title="Patient Overview" icon={<PersonIcon />}>
            <InfoRow label="Patient" value={data.patient.name} />
            <InfoRow label="Cancer Type" value={data.patient.cancerType} />
            <InfoRow label="Stage" value={data.patient.cancerStage} />
            <InfoRow label="Treatment" value={data.patient.treatmentPhase} />
            <InfoRow label="Conditions" value={data.patient.conditions} />
            <InfoRow label="Allergies" value={data.patient.allergies} />
          </Section>
        )}

        {/* Medications */}
        {data.medications && data.medications.length > 0 && (
          <Section title={`Medications (${data.medications.length})`} icon={<MedIcon />}>
            <div className="space-y-3">
              {data.medications.map((med, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{med.name}</p>
                    {(med.dose || med.frequency) && (
                      <p className="text-xs text-white/50 mt-0.5">{[med.dose, med.frequency].filter(Boolean).join(' · ')}</p>
                    )}
                    {med.notes && <p className="text-xs text-white/40 mt-0.5 italic">{med.notes}</p>}
                  </div>
                  {med.prescribingDoctor && (
                    <span className="text-xs text-white/40 flex-shrink-0">Dr. {med.prescribingDoctor}</span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Lab Results */}
        {data.lab_results && data.lab_results.length > 0 && (
          <Section title={`Lab Results (${data.lab_results.length})`} icon={<MedIcon />}>
            <div className="space-y-2">
              {data.lab_results.map((lab, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-sm text-white">{lab.name}</p>
                    {lab.referenceRange && <p className="text-xs text-white/40">Ref: {lab.referenceRange}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${lab.status === 'high' || lab.status === 'low' ? 'text-amber-400' : 'text-white'}`}>
                      {lab.value}{lab.unit ? ` ${lab.unit}` : ''}
                    </p>
                    {lab.date && (
                      <p className="text-xs text-white/40">
                        {new Date(lab.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Appointments */}
        {futureAppts.length > 0 && (
          <Section title="Upcoming Appointments" icon={<CalIcon />}>
            <div className="space-y-3">
              {futureAppts.map((appt, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{appt.doctorName || 'Appointment'}</p>
                    {appt.specialty && <p className="text-xs text-[#A78BFA]">{appt.specialty}</p>}
                    {appt.purpose && <p className="text-xs text-white/50 mt-0.5">{appt.purpose}</p>}
                    {appt.location && <p className="text-xs text-white/40">{appt.location}</p>}
                  </div>
                  {appt.dateTime && (
                    <span className="text-xs text-white/50 flex-shrink-0">
                      {new Date(appt.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Care Team */}
        {data.care_team && data.care_team.length > 0 && (
          <Section title="Care Team" icon={<TeamIcon />}>
            <div className="space-y-2">
              {data.care_team.map((member, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-sm text-white">{member.name}</p>
                    {member.specialty && <p className="text-xs text-white/40">{member.specialty}</p>}
                  </div>
                  {member.phone && (
                    <a href={`tel:${member.phone}`} className="text-xs text-[#A78BFA] hover:underline">
                      {member.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="pt-4 pb-8 text-center space-y-2">
          <p className="text-xs text-white/20">
            Shared privately via CareCompanion. Expires {expiresDate}.
          </p>
          <p className="text-xs text-white/20">
            Not a medical record. Always consult your care team for medical decisions.
          </p>
          <Link href="/" className="inline-block mt-2 text-xs text-[#A78BFA] hover:underline">
            Create your own CareCompanion profile →
          </Link>
        </div>
      </div>
    </div>
  );
}
