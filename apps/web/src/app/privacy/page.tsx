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


export default function PrivacyPolicy() {
  const containerRef = useScrollReveal();

  return (
    <div className="min-h-dvh bg-[#080A14] text-[var(--text)] relative overflow-hidden page-grid">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-[#6366F1]/[0.05] blur-[120px]" />
        <div className="absolute top-[50%] -left-40 w-[400px] h-[400px] rounded-full bg-[#A78BFA]/[0.04] blur-[100px]" />
      </div>

      <PublicNav />
      <div ref={containerRef} className="max-w-2xl mx-auto px-5 pt-24 pb-12 sm:pb-16">

        <div className="reveal-item mb-10" style={{ '--delay': '0s' } as React.CSSProperties}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#A78BFA]/10 border border-[#A78BFA]/20 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
            <span className="text-[#A78BFA] text-xs font-medium">Last Updated: April 3, 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[var(--text)] via-[#A78BFA] to-[var(--text)] bg-clip-text text-transparent bg-[length:200%] animate-[text-shimmer_6s_linear_infinite]">
            Privacy Policy
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">How CareCompanion AI handles your health data</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-[var(--text-secondary)]">

          {[
            {
              num: 1, title: 'WHO WE ARE',
              content: <p>CareCompanion AI (&quot;CareCompanion&quot;, &quot;we&quot;, &quot;us&quot;) is an <strong className="text-[var(--text)]">AI-powered health organizer</strong> built for cancer patients and their family caregivers. We help families manage medications, appointments, lab results, and medical records in one place. Our website is <strong className="text-[var(--text)]">carecompanionai.org</strong>.</p>
            },
            {
              num: 2, title: 'WHAT DATA WE COLLECT',
              content: <>
                <h3 className="text-sm font-semibold text-[#A78BFA] mt-1 mb-2">Data you provide directly:</h3>
                <ul className="space-y-1.5 mb-4">{['Patient profile information (name, age, conditions, allergies)','Medications, dosages, and refill dates','Doctor and care team information','Appointment details and notes','Lab results and health records','Insurance information','Symptom journal entries','Documents and medical files you upload','Chat messages with our AI assistant'].map((t,i) => <li key={i} className="flex items-start gap-2"><span className="text-[#A78BFA] mt-0.5">&#x2022;</span>{t}</li>)}</ul>
                <h3 className="text-sm font-semibold text-[#A78BFA] mb-2">Data we collect automatically:</h3>
                <ul className="space-y-1.5 mb-4">{['Account email and authentication data','App usage and feature interactions','Device type and browser (for app performance only)'].map((t,i) => <li key={i} className="flex items-start gap-2"><span className="text-[#A78BFA] mt-0.5">&#x2022;</span>{t}</li>)}</ul>
                <h3 className="text-sm font-semibold text-[#A78BFA] mb-2">Data imported via health system connections:</h3>
                <p>When you connect your hospital account (e.g. Epic MyChart), we import <strong className="text-[var(--text)]">only the data you explicitly authorize</strong> including medications, conditions, allergies, lab results, appointments, and insurance claims. This only happens with your <strong className="text-[var(--text)]">direct consent</strong> through the hospital&apos;s official OAuth login flow.</p>
              </>
            },
            {
              num: 3, title: 'HOW WE USE YOUR DATA',
              content: <>
                <p className="mb-3">We use your data <strong className="text-[var(--text)]">solely</strong> to:</p>
                <ul className="space-y-1.5 mb-4">{['Power the CareCompanion AI assistant and its responses','Display your health information across the app','Send medication reminders and appointment alerts you have enabled','Generate health summaries and visit prep sheets','Improve app performance and fix bugs'].map((t,i) => <li key={i} className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#x2713;</span>{t}</li>)}</ul>
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/[0.06] to-transparent border border-emerald-500/15 space-y-1">
                  <p className="text-[var(--text)] font-semibold flex items-center gap-2"><span className="text-emerald-400">&#x2717;</span> We <strong>never</strong> use your health data for advertising.</p>
                  <p className="text-[var(--text)] font-semibold flex items-center gap-2"><span className="text-emerald-400">&#x2717;</span> We <strong>never</strong> sell your data to any third party, ever.</p>
                  <p className="text-[var(--text)] font-semibold flex items-center gap-2"><span className="text-emerald-400">&#x2717;</span> We <strong>never</strong> share your data without your explicit consent except as required by law.</p>
                </div>
              </>
            },
            {
              num: 4, title: 'HOW WE STORE AND PROTECT YOUR DATA',
              content: <div className="grid gap-2">{[
                'All data stored in Supabase (PostgreSQL), a SOC 2 Type II certified cloud database',
                'Row-level security ensures no user can access another user\'s data',
                'All data encrypted in transit (HTTPS/TLS) and at rest',
                'API keys and credentials are never stored in code',
                'Care team access is permission-controlled — you decide who sees what',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-[#6366F1]/15 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] mt-1.5 flex-shrink-0" />
                  <span>{text}</span>
                </div>
              ))}</div>
            },
            {
              num: 5, title: 'CARE TEAM SHARING',
              content: <>
                <p className="mb-3">When you invite family members to your care team:</p>
                <ul className="space-y-1.5">{['You control their permission level (viewer, editor, or owner)','They only see data for the patient profile you invited them to','You can remove them at any time','All care team activity is logged in the activity feed'].map((t,i) => <li key={i} className="flex items-start gap-2"><span className="text-[#A78BFA] mt-0.5">&#x2022;</span>{t}</li>)}</ul>
              </>
            },
            {
              num: 6, title: 'DATA RETENTION',
              content: <p>We keep your data for as long as your account is active. If you delete your account, <strong className="text-[var(--text)]">all associated data is permanently deleted within 30 days</strong> including patient profiles, medications, appointments, messages, memories, and uploaded documents. You can also <strong className="text-[var(--text)]">export all your data</strong> before deletion from the Settings page.</p>
            },
            {
              num: 7, title: 'YOUR RIGHTS',
              content: <>
                <p className="mb-3">You have the right to:</p>
                <div className="grid gap-2">{[
                  'Access all your data (export from Settings)',
                  'Correct any inaccurate data',
                  'Delete your account and all associated data',
                  'Disconnect any health system integration at any time',
                  'Withdraw consent for data processing at any time',
                ].map((t,i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-emerald-400 font-bold">&#x2713;</span>
                    <span>{t}</span>
                  </div>
                ))}</div>
              </>
            },
            {
              num: 8, title: 'CHILDREN\'S PRIVACY',
              content: <p>CareCompanion is not directed at children under 13. We do not knowingly collect data from children under 13.</p>
            },
            {
              num: 9, title: 'CHANGES TO THIS POLICY',
              content: <p>We will notify users by email and in-app notification of any material changes to this policy <strong className="text-[var(--text)]">at least 14 days before they take effect</strong>.</p>
            },
            {
              num: 10, title: 'CONTACT US',
              content: <p>For any privacy questions, data requests, or concerns:<br />Email: <a href="mailto:privacy@carecompanionai.org" className="text-[#A78BFA] hover:text-[#c4b5fd] transition-colors font-medium underline decoration-[#A78BFA]/30 hover:decoration-[#A78BFA]">privacy@carecompanionai.org</a><br />Website: carecompanionai.org</p>
            },
            {
              num: 11, title: 'SECURITY PRACTICES',
              content: <div className="p-5 rounded-xl bg-gradient-to-br from-[#6366F1]/[0.06] to-transparent border border-[#6366F1]/15">
                <p>CareCompanion AI encrypts all data in transit using <strong className="text-[var(--text)]">TLS 1.2+</strong> and at rest using <strong className="text-[var(--text)]">AES-256</strong> encryption through our database provider (Supabase, SOC 2 Type II certified). Every database table is protected by <strong className="text-[var(--text)]">row-level security (RLS)</strong> policies that cryptographically enforce user-scoped access, meaning no user can ever query another user&apos;s data, even through direct API calls. All API keys, OAuth tokens, and secrets are stored in environment variables and <strong className="text-[var(--text)]">never committed to source code</strong>. We conduct regular dependency audits and follow OWASP security guidelines. Health portal connections use the <strong className="text-[var(--text)]">SMART on FHIR OAuth 2.0</strong> protocol with PKCE where supported, and we never see or store hospital login passwords.</p>
              </div>
            },
          ].map((section) => (
            <section key={section.num} className="reveal-item" style={{ '--delay': `${section.num * 0.05}s` } as React.CSSProperties}>
              <div className="group p-5 rounded-2xl bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-300">
                <h2 className="text-base font-semibold text-[var(--text)] mb-3 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{String(section.num).padStart(2, '0')}</span>
                  {section.title}
                </h2>
                <div className="pl-10">{section.content}</div>
              </div>
            </section>
          ))}

          <div className="reveal-item" style={{ '--delay': '0.7s' } as React.CSSProperties}>
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#6366F1]/[0.06] to-[#A78BFA]/[0.06] border border-[#6366F1]/15 text-center">
              <p className="text-xs text-[var(--text-muted)]">
                CareCompanion AI follows <strong className="text-[var(--text)]">HIPAA-aligned security practices</strong>. We are not currently a HIPAA-covered entity.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <Link href="/terms" className="hover:text-[#A78BFA] transition-colors">Terms of Service</Link>
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
