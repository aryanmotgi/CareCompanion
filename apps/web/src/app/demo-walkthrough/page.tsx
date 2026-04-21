import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';

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
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA] rounded-l-2xl" />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#6366F1]/20 text-[#A78BFA] text-sm font-bold flex items-center justify-center">
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

  return (
    <div className="min-h-dvh bg-[#080A14] page-grid">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-5 pt-24 pb-8 space-y-6">

      {/* Reviewer credentials card */}
      <details className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] to-orange-500/[0.04] overflow-hidden group">
        <summary className="cursor-pointer list-none p-4 sm:p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">For Reviewers</p>
              <p className="text-xs text-white/50">Test credentials and review checklist</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-white/40 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>
        <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-white/[0.06] pt-4">
          <div>
            <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">Test credentials</p>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/40">URL:</span>
                <Link href="/login" className="text-[#A78BFA] hover:text-[#c4b5fd] transition-colors">carecompanionai.org/login</Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Email:</span>
                <span className="text-white select-all">reviewer@carecompanionai.org</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Password:</span>
                <span className="text-white select-all">OneUpReview2026!</span>
              </div>
            </div>
            <p className="text-[11px] text-white/30 mt-2">Account pre-loaded with realistic HER2+ Breast Cancer demo data.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">What to verify</p>
            <ul className="space-y-1.5 text-xs text-white/70">
              <li className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5"/></svg>
                <span>Privacy policy and terms are accessible and thorough</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5"/></svg>
                <span>No credentials exposed in client-side code</span>
              </li>
            </ul>
          </div>
          <div className="rounded-lg bg-[#6366F1]/[0.08] border border-[#6366F1]/15 p-3 text-xs text-white/60">
            <p><strong className="text-[#A78BFA]">Contact:</strong> <a href="mailto:privacy@carecompanionai.org" className="underline hover:text-[#c4b5fd]">privacy@carecompanionai.org</a> for questions about this review.</p>
          </div>
        </div>
      </details>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#6366F1]/15 border border-[#6366F1]/25">
          <svg className="w-4 h-4 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <span className="text-xs font-medium text-[#A78BFA]">How CareCompanion Works</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-white via-[#A78BFA] to-white bg-clip-text text-transparent">See it in action</h1>
        <p className="text-sm sm:text-base text-white/50 max-w-lg mx-auto">
          A guided walkthrough of how CareCompanion helps cancer patients and caregivers manage treatment, medications, lab results, and more.
        </p>
      </div>

      {/* Step 1: Connect Your Health Records */}
      <StepCard step={1} title="Connect Your Health Records">
        <p className="text-sm text-white/60 mb-4">
          Stop manually entering medications and lab results. CareCompanion connects securely to your hospital&apos;s patient portal and imports everything automatically.
        </p>
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-3 mb-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#A78BFA] text-xs font-bold flex items-center justify-center mt-0.5">1</span>
            <p className="text-sm text-white/70">Click &quot;Connect Health Records&quot; and pick your hospital from 700+ supported systems</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#A78BFA] text-xs font-bold flex items-center justify-center mt-0.5">2</span>
            <p className="text-sm text-white/70">Log in with your existing MyChart, Kaiser, or Sutter credentials</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#A78BFA] text-xs font-bold flex items-center justify-center mt-0.5">3</span>
            <p className="text-sm text-white/70">Grant read-only access — we never see or store your password</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#A78BFA] text-xs font-bold flex items-center justify-center mt-0.5">4</span>
            <p className="text-sm text-white/70">Your medications, labs, conditions, and appointments appear automatically</p>
          </div>
        </div>
        <p className="text-xs text-white/40 mt-1">
          Works with Epic MyChart, Kaiser Permanente, Sutter Health, and 700+ more health systems.
        </p>
      </StepCard>

      {/* Step 2: What Gets Imported */}
      <StepCard step={2} title="Everything Auto-Imported">
        <p className="text-sm text-white/60 mb-4">
          Once connected, every piece of your medical history flows into CareCompanion. No manual entry. Updates automatically every 24 hours.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {['Medications', 'Conditions', 'Lab Results', 'Allergies', 'Appointments', 'Doctors', 'Claims', 'Insurance'].map((item) => (
            <div
              key={item}
              className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-center"
            >
              <span className="text-xs font-medium text-[#A78BFA]">{item}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-2">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">What happens next</p>
          <ul className="space-y-1.5 text-sm text-white/60">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Active medications with doses and prescribing doctors
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Lab results with automatic abnormal flagging
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Upcoming appointments and your full care team
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Insurance claims and coverage details
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Refreshes every 24 hours without you doing anything
            </li>
          </ul>
        </div>
      </StepCard>

      {/* Step 3: AI That Knows Your Care */}
      <StepCard step={3} title="AI That Knows Your Treatment">
        <p className="text-sm text-white/60 mb-4">
          CareCompanion&apos;s AI doesn&apos;t just answer generic health questions. It knows your specific medications, lab results, and treatment plan — and it answers questions in that context.
        </p>
        <div className="rounded-xl bg-gradient-to-br from-[#6366F1]/10 to-[#A78BFA]/[0.07] border border-[#6366F1]/20 p-4 space-y-3">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Example conversation</p>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-sm text-[#A78BFA] font-medium">You</span>
              <div className="text-sm text-white/70">
                <p>What side effects should I watch for with my chemo?</p>
              </div>
            </div>
            <div className="w-full h-px bg-white/[0.06]" />
            <div className="flex items-start gap-3">
              <span className="text-sm text-emerald-400 font-medium">AI</span>
              <div className="text-sm text-white/70">
                <p>Since you&apos;re on <span className="text-white">Trastuzumab + Taxotere</span>, watch for:</p>
                <p className="mt-1">• Cardiac changes (echo every 3 months)</p>
                <p>• Fever over 100.4°F → call oncology immediately</p>
                <p>• Fatigue and nausea (your Zofran prescription helps)</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-white/40 mt-3">
          Ask anything about medications, lab results, appointment prep, or drug interactions. It knows your history.
        </p>
      </StepCard>

      {/* Step 4: Everything in One Place */}
      <StepCard step={4} title="Everything in One Place">
        <p className="text-sm text-white/60 mb-4">
          Your medications, labs, appointments, care team, and AI chat all live in one app. No more juggling five different tools.
        </p>
        <div className="space-y-2">
          {EXPLORE_LINKS.map((link) => (
            <div
              key={link.href}
              className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 opacity-70"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#6366F1]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{link.label}</p>
                <p className="text-xs text-white/40">{link.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/30 mt-3">
          Launch the interactive demo below to explore each section with real data.
        </p>
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
          <Link href="/privacy" className="text-xs text-[#A78BFA] hover:text-[#c4b5fd] underline underline-offset-2 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-xs text-[#A78BFA] hover:text-[#c4b5fd] underline underline-offset-2 transition-colors">Terms of Service</Link>
        </div>
      </StepCard>

      {/* Step 6: Try It With Demo Data */}
      <div className="relative rounded-2xl border border-[#6366F1]/30 bg-gradient-to-br from-[#6366F1]/[0.08] to-[#A78BFA]/[0.06] backdrop-blur-xl overflow-hidden ring-1 ring-[#6366F1]/10">
        {/* Step number accent */}
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA] rounded-l-2xl" />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#6366F1]/25 text-[#A78BFA] text-sm font-bold flex items-center justify-center">
              6
            </span>
            <h2 className="text-lg font-semibold text-white">Try It Free — No Account Required</h2>
            <span className="ml-auto flex-shrink-0 text-[11px] font-semibold text-[#A78BFA] bg-[#6366F1]/15 border border-[#6366F1]/25 px-2 py-0.5 rounded-full">
              Start here
            </span>
          </div>
          <p className="text-sm text-white/60 mb-4">
            Chat instantly with CareCompanion&apos;s AI — ask about chemo side effects, tumor markers, medications, or how to support a family member. No account needed, no email required.
          </p>

          <div className="space-y-3">
            <Link
              href="/chat/guest"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold hover:from-[#4f52d9] hover:to-[#9068f5] shadow-lg shadow-[#6366F1]/25 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Launch interactive demo
            </Link>
            <p className="text-[11px] text-center text-white/30">
              No account needed — 15 free messages
            </p>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="rounded-2xl border border-[#6366F1]/20 bg-gradient-to-br from-[#6366F1]/10 to-[#A78BFA]/[0.07] p-6 text-center space-y-4">
        <h3 className="text-xl font-bold text-white">Ready to get started?</h3>
        <p className="text-sm text-white/60 max-w-md mx-auto">
          Join cancer patients and caregivers using CareCompanion to simplify their treatment journey. Free forever.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold hover:from-[#4f52d9] hover:to-[#9068f5] transition-all"
        >
          Start for free
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
      </div>
    </div>
  );
}