'use client';

import { useState } from 'react';
import Link from 'next/link';

const FHIR_RESOURCES = [
  'Patient',
  'Condition',
  'MedicationRequest',
  'Observation (Labs)',
  'AllergyIntolerance',
  'Encounter',
  'Practitioner',
  'Coverage (Insurance)',
];

const EXPLORE_LINKS = [
  { href: '/dashboard', label: 'Dashboard', desc: 'Health cards and quick actions', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/medications', label: 'Medications', desc: 'Full medication list with refill tracking', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5' },
  { href: '/labs', label: 'Lab Results', desc: 'Lab values with abnormal flagging', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0' },
  { href: '/care-team', label: 'Care Team', desc: 'Synced doctors and specialists', icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
  { href: '/chat', label: 'AI Chat', desc: 'AI assistant with full health context', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
];

function StepCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
      {/* Step number accent */}
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-violet-500 rounded-l-2xl" />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold flex items-center justify-center">
            {step}
          </span>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function DemoWalkthroughPage() {
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [counts, setCounts] = useState<{ medications: number; labs: number; appointments: number; doctors: number } | null>(null);
  const [error, setError] = useState('');

  async function handleSeedDemo() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/seed-demo', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeeded(true);
        setCounts(data.counts);
      } else {
        setError(data.error || 'Failed to load demo data');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-5 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/25">
          <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <span className="text-xs font-medium text-violet-300">For 1upHealth Review Team</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">1upHealth Integration Demo</h1>
        <p className="text-sm text-white/50 max-w-lg mx-auto">
          A guided walkthrough of how CareCompanion integrates with 1upHealth to deliver a personalized cancer care experience.
        </p>
      </div>

      {/* Step 1: Data Connection Flow */}
      <StepCard step={1} title="Data Connection Flow">
        <p className="text-sm text-white/60 mb-4">
          Users connect their health records through a standard OAuth 2.0 flow powered by 1upHealth.
          They search for their health system, authenticate, and grant read-only access to their medical data.
        </p>
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-3 mb-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
            <p className="text-sm text-white/70">User clicks &quot;Connect Health Records&quot; on the Connect page</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
            <p className="text-sm text-white/70">Redirected to 1upHealth system search (Epic, Cerner, etc.)</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
            <p className="text-sm text-white/70">Patient authenticates with their health system portal</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">4</span>
            <p className="text-sm text-white/70">Callback returns tokens; CareCompanion begins FHIR sync</p>
          </div>
        </div>
        <a
          href="/api/fhir/authorize?provider=1uphealth"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 text-sm font-medium hover:bg-blue-500/25 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Try the OAuth Flow
        </a>
      </StepCard>

      {/* Step 2: Data Sync */}
      <StepCard step={2} title="FHIR Data Sync">
        <p className="text-sm text-white/60 mb-4">
          After authorization, our sync engine pulls FHIR R4 resources from 1upHealth and maps them into CareCompanion&apos;s data model.
          A 24-hour auto-sync cron keeps data fresh.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {FHIR_RESOURCES.map((resource) => (
            <div
              key={resource}
              className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-center"
            >
              <span className="text-xs font-medium text-cyan-300">{resource}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-2">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Sync Pipeline</p>
          <ul className="space-y-1.5 text-sm text-white/60">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Fetch resources via 1upHealth FHIR API
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Map FHIR R4 to CareCompanion schema (medications, labs, doctors, etc.)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Upsert with deduplication to avoid duplicates
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Trigger AI profile detection (cancer type, stage, treatment)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Auto-sync cron runs every 24 hours
            </li>
          </ul>
        </div>
      </StepCard>

      {/* Step 3: AI-Powered Profile */}
      <StepCard step={3} title="AI-Powered Cancer Profile">
        <p className="text-sm text-white/60 mb-4">
          After syncing, CareCompanion uses Claude to analyze the patient&apos;s conditions and medications to automatically detect cancer type, stage, and treatment phase.
        </p>
        <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 p-4 space-y-3">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Example Detection</p>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-sm text-white/40 font-mono">IN</span>
              <div className="text-sm text-white/70">
                <p>Medications: Trastuzumab, Pertuzumab, Docetaxel</p>
                <p>Conditions: HER2-positive breast carcinoma, Stage IIIA</p>
              </div>
            </div>
            <div className="w-full h-px bg-white/[0.06]" />
            <div className="flex items-start gap-3">
              <span className="text-sm text-emerald-400 font-mono">OUT</span>
              <div className="text-sm text-white/70">
                <p><span className="text-emerald-400 font-medium">Cancer Type:</span> HER2+ Breast Cancer</p>
                <p><span className="text-emerald-400 font-medium">Stage:</span> Stage IIIA</p>
                <p><span className="text-emerald-400 font-medium">Treatment Phase:</span> Active Treatment</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-white/40 mt-3">
          This powers personalized AI responses, medication interaction checks, and treatment-aware notifications.
        </p>
      </StepCard>

      {/* Step 4: User Experience */}
      <StepCard step={4} title="User Experience">
        <p className="text-sm text-white/60 mb-4">
          Synced data flows into every part of the app. Here are the key pages that use 1upHealth data:
        </p>
        <div className="space-y-2">
          {EXPLORE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 hover:bg-white/[0.07] transition-colors group"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{link.label}</p>
                <p className="text-xs text-white/40">{link.desc}</p>
              </div>
              <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      </StepCard>

      {/* Step 5: Privacy & Security */}
      <StepCard step={5} title="Privacy & Security">
        <p className="text-sm text-white/60 mb-4">
          CareCompanion is built with patient privacy as a core principle. All health data is protected with multiple layers of security.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {[
            { label: 'HIPAA-aligned architecture', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
            { label: 'Row-Level Security (RLS)', icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' },
            { label: 'Encrypted at rest and in transit', icon: 'M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33' },
            { label: 'Read-only API access', icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
            { label: 'Disconnect anytime', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
            { label: 'No data sold or shared', icon: 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="text-xs text-white/70">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Link href="/privacy" className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">Terms of Service</Link>
        </div>
      </StepCard>

      {/* Step 6: Try with Demo Data */}
      <StepCard step={6} title="Try with Demo Data">
        <p className="text-sm text-white/60 mb-4">
          Load a realistic cancer care dataset to explore the full experience. This creates a demo patient profile with HER2+ Breast Cancer, medications, lab results, appointments, and care team.
        </p>

        {!seeded ? (
          <div className="space-y-3">
            <button
              onClick={handleSeedDemo}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white text-sm font-semibold hover:from-blue-400 hover:to-violet-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading Demo Data...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Load Demo Data
                </>
              )}
            </button>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-emerald-400">Demo data loaded successfully</span>
              </div>
              {counts && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Medications', count: counts.medications },
                    { label: 'Lab Results', count: counts.labs },
                    { label: 'Appointments', count: counts.appointments },
                    { label: 'Doctors', count: counts.doctors },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
                      <p className="text-lg font-bold text-white">{item.count}</p>
                      <p className="text-xs text-white/40">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-sm text-white/50">Explore the app with demo data:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXPLORE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center hover:bg-white/[0.07] transition-colors"
                >
                  <p className="text-sm font-medium text-blue-400">{link.label}</p>
                  <p className="text-xs text-white/30 mt-0.5">View &rarr;</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </StepCard>

      {/* Footer */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center space-y-2">
        <p className="text-sm text-white/40">
          CareCompanion &mdash; AI-Powered Cancer Care Management
        </p>
        <p className="text-xs text-white/25">
          Questions? Reach out at{' '}
          <a href="mailto:aryan@carecompanion.app" className="text-blue-400/60 hover:text-blue-400 transition-colors">
            aryan@carecompanion.app
          </a>
        </p>
        <p className="text-xs text-white/20">v1.0 &middot; Built for 1upHealth Integration Review</p>
      </div>
    </div>
  );
}
