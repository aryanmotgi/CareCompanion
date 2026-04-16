import { db } from '@/lib/db';
import { sharedLinks, careProfiles, medications, doctors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AmbientBackground } from '@/components/AmbientBackground';

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.token, token))
    .limit(1);

  if (!link) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        <AmbientBackground />
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Link not found</h1>
          <p className="text-[var(--text-muted)]">This shared link doesn&apos;t exist or has expired.</p>
          <a href="/" className="text-[#A78BFA] hover:text-[#C4B5FD] text-sm">Go to CareCompanion</a>
        </div>
      </div>
    );
  }

  // Check expiration
  if (new Date(link.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        <AmbientBackground />
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Link expired</h1>
          <p className="text-[var(--text-muted)]">This shared link has expired. Ask the sender for a new one.</p>
          <a href="/" className="text-[#A78BFA] hover:text-[#C4B5FD] text-sm">Go to CareCompanion</a>
        </div>
      </div>
    );
  }

  const [profile] = await db
    .select({
      id: careProfiles.id,
      patientName: careProfiles.patientName,
      cancerType: careProfiles.cancerType,
      cancerStage: careProfiles.cancerStage,
      treatmentPhase: careProfiles.treatmentPhase,
      conditions: careProfiles.conditions,
      allergies: careProfiles.allergies,
    })
    .from(careProfiles)
    .where(eq(careProfiles.userId, link.userId))
    .limit(1);

  const [meds, docs] = profile
    ? await Promise.all([
        db
          .select({ name: medications.name, dose: medications.dose, frequency: medications.frequency })
          .from(medications)
          .where(eq(medications.careProfileId, profile.id)),
        db
          .select({ name: doctors.name, specialty: doctors.specialty, phone: doctors.phone })
          .from(doctors)
          .where(eq(doctors.careProfileId, profile.id)),
      ])
    : [[], []];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <AmbientBackground />
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-16 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] shadow-lg mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{profile?.patientName || 'Patient'}&apos;s Care Summary</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Shared via CareCompanion</p>
        </div>

        {/* Diagnosis */}
        {(profile?.cancerType || profile?.conditions) && (
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Diagnosis</h2>
            {profile?.cancerType && (
              <p className="text-white font-medium">
                {profile.cancerType}{profile?.cancerStage && profile.cancerStage !== 'Unsure' ? ` — Stage ${profile.cancerStage}` : ''}
              </p>
            )}
            {profile?.conditions && <p className="text-sm text-[var(--text-secondary)] mt-2">{profile.conditions}</p>}
            {profile?.allergies && <p className="text-sm text-red-400 mt-2">Allergies: {profile.allergies}</p>}
          </div>
        )}

        {/* Medications */}
        {meds.length > 0 && (
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Medications</h2>
            <div className="space-y-3">
              {meds.map((med, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{med.name}</p>
                    {med.dose && <p className="text-xs text-[var(--text-muted)]">{med.dose}{med.frequency ? ` — ${med.frequency}` : ''}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Doctors */}
        {docs.length > 0 && (
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Care Team</h2>
            <div className="space-y-3">
              {docs.map((doc, i) => (
                <div key={i}>
                  <p className="text-white text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{doc.specialty}{doc.phone ? ` — ${doc.phone}` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pt-4">
          <p className="text-xs text-[var(--text-muted)]">This link expires {new Date(link.expiresAt).toLocaleDateString()}</p>
          <a href="/" className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] mt-2 inline-block">Learn more about CareCompanion</a>
        </div>
      </div>
    </div>
  );
}
