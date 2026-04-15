'use client';

import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import Image from 'next/image';
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

export default function AboutPage() {
  const containerRef = useScrollReveal();

  return (
    <div className="min-h-dvh bg-[#080A14] text-[var(--text)] relative overflow-hidden page-grid">
      {/* Background glow orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-[#6366F1]/[0.06] blur-[120px]" />
        <div className="absolute top-[60%] -right-40 w-[400px] h-[400px] rounded-full bg-[#A78BFA]/[0.05] blur-[100px]" />
      </div>

      <PublicNav />
      <div ref={containerRef} className="max-w-2xl mx-auto px-5 pt-24 pb-12 sm:pb-16">

        {/* Logo and title */}
        <div className="reveal-item flex items-center gap-4 mb-10" style={{ '--delay': '0s' } as React.CSSProperties}>
          <Image src="/logo.svg" alt="CareCompanion AI logo" width={64} height={64} className="rounded-2xl shadow-lg shadow-[#6366F1]/20" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[var(--text)] via-[#A78BFA] to-[var(--text)] bg-clip-text text-transparent bg-[length:200%] animate-[text-shimmer_6s_linear_infinite]">
              About CareCompanion AI
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Built for cancer patients and their caregivers</p>
          </div>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-[var(--text-secondary)]">

          {/* Mission */}
          <section className="reveal-item" style={{ '--delay': '0.1s' } as React.CSSProperties}>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-xs">01</span>
              Our Mission
            </h2>
            <div className="pl-10 border-l-2 border-[#6366F1]/20 space-y-3">
              <p>
                Cancer treatment is <strong className="text-[var(--text)]">overwhelming</strong>. Between chemo schedules, lab results, medication lists, insurance claims,
                and oncology appointments, patients and their families are drowning in information spread across dozens of
                apps, portals, and paper records.
              </p>
              <p>
                CareCompanion AI exists to <strong className="text-[var(--text)]">bring all of that into one place</strong>. We built an AI-powered health organizer
                specifically for cancer patients and their family caregivers, so they can spend less time managing
                paperwork and <strong className="text-[var(--text)]">more time on what matters</strong>.
              </p>
            </div>
          </section>

          {/* What we do */}
          <section className="reveal-item" style={{ '--delay': '0.2s' } as React.CSSProperties}>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-xs">02</span>
              What We Do
            </h2>
            <div className="grid gap-3">
              {[
                { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>, title: 'Organize health records', desc: 'Medications, lab results, appointments, insurance, and medical documents in one place.' },
                { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>, title: 'Connect to hospital portals', desc: 'Securely import your records from Epic MyChart, Cerner, Medicare using SMART on FHIR.' },
                { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>, title: 'AI-powered assistance', desc: 'Ask about treatment side effects, understand tumor markers, prep for oncology appointments.' },
                { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>, title: 'Treatment tracking', desc: 'Log symptoms, track side effects across chemo cycles, share health summaries.' },
                { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>, title: 'Family collaboration', desc: 'Invite family caregivers to help manage care with role-based access control.' },
              ].map((item, i) => (
                <div key={i} className="group flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-[#6366F1]/20 transition-all duration-300 hover:translate-x-1">
                  <div className="w-9 h-9 rounded-lg bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0 text-[#A78BFA] group-hover:bg-[#6366F1]/20 transition-colors">{item.icon}</div>
                  <div>
                    <strong className="text-[var(--text)] group-hover:text-[#A78BFA] transition-colors">{item.title}</strong>
                    <span className="text-[var(--text-secondary)]"> — {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Team */}
          <section className="reveal-item" style={{ '--delay': '0.3s' } as React.CSSProperties}>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-xs">03</span>
              Who We Are
            </h2>
            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] hover:border-[#6366F1]/20 transition-all duration-500 group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#6366F1]/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-lg shadow-[#6366F1]/25 group-hover:shadow-[#6366F1]/40 transition-shadow">
                  AM
                </div>
                <div>
                  <h3 className="text-[var(--text)] font-bold text-base">Aryan Motgi</h3>
                  <p className="text-xs text-[#A78BFA]">Founder & Developer</p>
                </div>
              </div>
              <p className="relative">
                CareCompanion started from a <strong className="text-[var(--text)]">personal experience</strong> navigating the healthcare system for a family member.
                The frustration of juggling multiple patient portals, keeping track of medications across providers,
                and trying to understand lab results without medical training made it clear that <strong className="text-[var(--text)]">families need better tools</strong>.
              </p>
            </div>
          </section>

          {/* Tech */}
          <section className="reveal-item" style={{ '--delay': '0.4s' } as React.CSSProperties}>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-xs">04</span>
              How We Build
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>, title: 'Privacy first', desc: 'Row-level security, encrypted storage, no third-party analytics on health data.' },
                { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>, title: 'Standards-based', desc: 'SMART on FHIR — the same protocol hospitals use for health record connections.' },
                { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75h.007v.008H12v-.008z" /></svg>, title: 'AI with guardrails', desc: 'Never diagnoses, never recommends medication changes, always defers to providers.' },
                { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>, title: 'Open standards', desc: 'Built on Next.js, Supabase (PostgreSQL), and Anthropic\'s Claude API.' },
              ].map((item, i) => (
                <div key={i} className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-[#6366F1]/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center mb-3 text-[#A78BFA] group-hover:bg-[#6366F1]/20 transition-colors">{item.icon}</div>
                  <div className="text-[var(--text)] font-semibold text-sm mb-1 group-hover:text-[#A78BFA] transition-colors">{item.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">{item.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section className="reveal-item" style={{ '--delay': '0.5s' } as React.CSSProperties}>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-xs">05</span>
              Contact Us
            </h2>
            <div className="space-y-3">
              {[
                { icon: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>, label: 'General inquiries', email: 'hello@carecompanionai.org' },
                { icon: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, label: 'Privacy & data requests', email: 'privacy@carecompanionai.org' },
                { icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>, label: 'Security concerns', email: 'security@carecompanionai.org' },
              ].map((item, i) => (
                <a key={i} href={`mailto:${item.email}`} className="group flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-[#6366F1]/[0.06] hover:border-[#6366F1]/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#A78BFA]/20 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#A78BFA]">
                      {item.icon}
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[var(--text-muted)]">{item.label}</p>
                    <p className="text-[#A78BFA] group-hover:text-[#c4b5fd] transition-colors font-medium">{item.email}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </div>
          </section>

          {/* Footer badge */}
          <div className="reveal-item text-center" style={{ '--delay': '0.6s' } as React.CSSProperties}>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.03] border border-[var(--border)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
              <p className="text-[var(--text-muted)] text-xs">
                CareCompanion AI &middot; carecompanionai.org &middot; Made in California
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[#A78BFA] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#A78BFA] transition-colors">Terms</Link>
          </div>
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
