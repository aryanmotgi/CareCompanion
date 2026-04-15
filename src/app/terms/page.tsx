'use client';

import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { useEffect, useRef } from 'react';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll('.reveal-item');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('revealed');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    items.forEach((item) => obs.observe(item));
    return () => obs.disconnect();
  }, []);
  return ref;
}

const SECTION_ICONS: Record<number, string> = {
  1: '✅', 2: '📱', 3: '⚕️', 4: '👤', 5: '💾', 6: '👨‍👩‍👦',
  7: '🚫', 8: '🤖', 9: '🌐', 10: '🗑️', 11: '⚖️', 12: '📝',
  13: '🏛️', 14: '📧',
};

export default function TermsOfService() {
  const containerRef = useScrollReveal();

  return (
    <div className="min-h-dvh bg-[#080A14] text-[var(--text)] relative overflow-hidden page-grid">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] rounded-full bg-[#A78BFA]/[0.05] blur-[120px]" />
        <div className="absolute top-[70%] -right-32 w-[350px] h-[350px] rounded-full bg-[#6366F1]/[0.04] blur-[100px]" />
      </div>

      <PublicNav />
      <div ref={containerRef} className="max-w-2xl mx-auto px-5 pt-24 pb-12 sm:pb-16">

        <div className="reveal-item mb-10" style={{ '--delay': '0s' } as React.CSSProperties}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#A78BFA]/10 border border-[#A78BFA]/20 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
            <span className="text-[#A78BFA] text-xs font-medium">Last Updated: April 3, 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[var(--text)] via-[#A78BFA] to-[var(--text)] bg-clip-text text-transparent bg-[length:200%] animate-[text-shimmer_6s_linear_infinite]">
            Terms of Service
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">Rules and guidelines for using CareCompanion AI</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-[var(--text-secondary)]">

          {[
            {
              num: 1, title: 'ACCEPTANCE OF TERMS',
              content: <p>By using CareCompanion AI (&quot;CareCompanion&quot;, &quot;the app&quot;), you agree to these Terms of Service. If you do not agree, <strong className="text-[var(--text)]">do not use the app</strong>.</p>
            },
            {
              num: 2, title: 'WHAT CARECOMPANION IS',
              content: <>
                <p className="mb-3">CareCompanion is an <strong className="text-[var(--text)]">AI-powered health organizer</strong> for cancer patients and their family caregivers. It helps you organize medical information, track medications, manage appointments, and communicate with an AI assistant about your loved one&apos;s health situation.</p>
                <div className="p-4 rounded-xl bg-gradient-to-br from-[#6366F1]/[0.06] to-transparent border border-[#6366F1]/15">
                  <p className="text-[var(--text)] font-semibold">CareCompanion is a health information organizer, <span className="text-[#A78BFA]">not a medical provider</span>. Nothing in this app constitutes medical advice, diagnosis, or treatment.</p>
                </div>
              </>
            },
            {
              num: 3, title: 'NOT MEDICAL ADVICE',
              highlight: true,
              content: <>
                <div className="p-5 rounded-xl bg-gradient-to-br from-amber-500/[0.08] to-transparent border border-amber-500/20 mb-3">
                  <p className="text-amber-300 font-semibold leading-relaxed">
                    IMPORTANT: CareCompanion is <strong>not a substitute</strong> for professional medical advice, diagnosis, or treatment.
                    Always seek the advice of your physician or qualified health provider with any questions about a medical
                    condition. <strong>Never disregard professional medical advice</strong> because of something you read in this app.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 p-3 rounded-lg bg-red-500/[0.06] border border-red-500/15 text-center">
                    <p className="text-red-400 font-semibold text-xs">Medical emergencies</p>
                    <p className="text-[var(--text)] font-bold text-lg mt-1">Call 911</p>
                  </div>
                  <div className="flex-1 p-3 rounded-lg bg-[#6366F1]/[0.06] border border-[#6366F1]/15 text-center">
                    <p className="text-[#A78BFA] font-semibold text-xs">Mental health crises</p>
                    <p className="text-[var(--text)] font-bold text-lg mt-1">Call 988</p>
                  </div>
                </div>
              </>
            },
            {
              num: 4, title: 'YOUR ACCOUNT',
              content: <ul className="space-y-1.5">{['You must be 18 or older to create an account','You are responsible for maintaining the security of your account credentials','You are responsible for all activity under your account','You must provide accurate information','One person may manage multiple patient profiles (e.g. a caregiver managing a parent and spouse)'].map((t,i) => <li key={i} className="flex items-start gap-2"><span className="text-[#A78BFA] mt-0.5">&#x2022;</span>{t}</li>)}</ul>
            },
            {
              num: 5, title: 'HEALTH DATA',
              content: <div className="grid gap-2">{[
                { icon: '✅', text: 'You own all health data you enter into CareCompanion' },
                { icon: '📄', text: 'You grant CareCompanion a limited license to store and process your data solely to provide the service' },
                { icon: '✏️', text: 'You are responsible for the accuracy of data you enter' },
                { icon: '🔗', text: 'When you connect a health system, you authorize CareCompanion to import your records on your behalf' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-[#6366F1]/15 transition-colors">
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}</div>
            },
            {
              num: 6, title: 'CARE TEAM',
              content: <ul className="space-y-1.5">{['You control who has access to each patient profile','You are responsible for only inviting people you trust','Invitations expire after 7 days','You can remove care team members at any time'].map((t,i) => <li key={i} className="flex items-start gap-2"><span className="text-[#A78BFA] mt-0.5">&#x2022;</span>{t}</li>)}</ul>
            },
            {
              num: 7, title: 'ACCEPTABLE USE',
              content: <>
                <p className="mb-3">You agree <strong className="text-[var(--text)]">not to</strong>:</p>
                <ul className="space-y-1.5">{[
                  'Use CareCompanion for any unlawful purpose',
                  'Enter false or misleading health information intentionally to deceive others',
                  'Attempt to access another user\'s data',
                  'Reverse engineer or tamper with the app',
                  'Use the app to store data for someone without their knowledge or consent',
                ].map((t,i) => <li key={i} className="flex items-start gap-2"><span className="text-red-400 mt-0.5">&#x2717;</span>{t}</li>)}</ul>
              </>
            },
            {
              num: 8, title: 'AI LIMITATIONS',
              content: <>
                <p className="mb-3">Our AI assistant:</p>
                <div className="grid gap-2">{[
                  { status: 'never', text: 'Diagnoses medical conditions' },
                  { status: 'never', text: 'Recommends starting, stopping, or changing medications' },
                  { status: 'never', text: 'Guarantees the safety of drug combinations' },
                  { status: 'always', text: 'Defers to healthcare providers for medical decisions' },
                  { status: 'warn', text: 'May make mistakes — always verify important medical information with your care team' },
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border ${item.status === 'never' ? 'bg-red-500/[0.04] border-red-500/10' : item.status === 'always' ? 'bg-emerald-500/[0.04] border-emerald-500/10' : 'bg-amber-500/[0.04] border-amber-500/10'}`}>
                    <span className={`font-bold text-xs mt-0.5 ${item.status === 'never' ? 'text-red-400' : item.status === 'always' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {item.status === 'never' ? '✗' : item.status === 'always' ? '✓' : '⚠'}
                    </span>
                    <span>{item.status === 'never' ? <><strong className="text-red-400">Never</strong> {item.text.toLowerCase()}</> : item.status === 'always' ? <><strong className="text-emerald-400">Always</strong> {item.text.toLowerCase()}</> : item.text}</span>
                  </div>
                ))}</div>
              </>
            },
            {
              num: 9, title: 'SERVICE AVAILABILITY',
              content: <p>We aim for high availability but <strong className="text-[var(--text)]">do not guarantee uninterrupted service</strong>. We are not liable for any harm caused by service downtime or data loss. We recommend exporting your data regularly from the Settings page.</p>
            },
            {
              num: 10, title: 'TERMINATION',
              content: <p>You may <strong className="text-[var(--text)]">delete your account at any time</strong> from Settings. We may suspend accounts that violate these terms. Upon account deletion, all your data is <strong className="text-[var(--text)]">permanently deleted within 30 days</strong>.</p>
            },
            {
              num: 11, title: 'LIMITATION OF LIABILITY',
              content: <p>CareCompanion is provided <strong className="text-[var(--text)]">&quot;as is.&quot;</strong> To the maximum extent permitted by law, CareCompanion AI is not liable for any indirect, incidental, or consequential damages arising from your use of the app.</p>
            },
            {
              num: 12, title: 'CHANGES TO TERMS',
              content: <p>We will notify users by email and in-app notification of material changes <strong className="text-[var(--text)]">at least 14 days before they take effect</strong>. Continued use after that date constitutes acceptance.</p>
            },
            {
              num: 13, title: 'GOVERNING LAW',
              content: <p>These terms are governed by the laws of the <strong className="text-[var(--text)]">State of California</strong>.</p>
            },
            {
              num: 14, title: 'CONTACT',
              content: <p>For questions about these terms:<br />Email: <a href="mailto:privacy@carecompanionai.org" className="text-[#A78BFA] hover:text-[#c4b5fd] transition-colors font-medium underline decoration-[#A78BFA]/30 hover:decoration-[#A78BFA]">privacy@carecompanionai.org</a><br />Website: carecompanionai.org</p>
            },
          ].map((section) => (
            <section key={section.num} className="reveal-item" style={{ '--delay': `${section.num * 0.04}s` } as React.CSSProperties}>
              <div className="group p-5 rounded-2xl bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-300">
                <h2 className="text-base font-semibold text-[var(--text)] mb-3 flex items-center gap-3">
                  <span className="text-lg">{SECTION_ICONS[section.num]}</span>
                  <span className="text-[#A78BFA]/60 text-xs font-mono">{String(section.num).padStart(2, '0')}</span>
                  {section.title}
                </h2>
                <div className="pl-9">{section.content}</div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <Link href="/privacy" className="hover:text-[#A78BFA] transition-colors">Privacy Policy</Link>
          <span>&copy; {new Date().getFullYear()} CareCompanion AI</span>
        </div>
      </div>

      <style jsx>{`
        .reveal-item {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
          transition-delay: var(--delay, 0s);
        }
        .reveal-item.revealed {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
