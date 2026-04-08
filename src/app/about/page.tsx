'use client';

import Link from 'next/link';
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
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)] relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-[#6366F1]/[0.06] blur-[120px]" />
        <div className="absolute top-[60%] -right-40 w-[400px] h-[400px] rounded-full bg-[#A78BFA]/[0.05] blur-[100px]" />
      </div>

      <div ref={containerRef} className="max-w-2xl mx-auto px-5 py-12 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-8 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>

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
                { icon: '📋', title: 'Organize health records', desc: 'Medications, lab results, appointments, insurance, and medical documents in one place.' },
                { icon: '🔗', title: 'Connect to hospital portals', desc: 'Securely import your records from Epic MyChart, Cerner, Medicare using SMART on FHIR.' },
                { icon: '🤖', title: 'AI-powered assistance', desc: 'Ask about treatment side effects, understand tumor markers, prep for oncology appointments.' },
                { icon: '📊', title: 'Treatment tracking', desc: 'Log symptoms, track side effects across chemo cycles, share health summaries.' },
                { icon: '👨‍👩‍👦', title: 'Family collaboration', desc: 'Invite family caregivers to help manage care with role-based access control.' },
              ].map((item, i) => (
                <div key={i} className="group flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-[#6366F1]/20 transition-all duration-300 hover:translate-x-1">
                  <span className="text-xl flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">{item.icon}</span>
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
                { icon: '🔒', title: 'Privacy first', desc: 'Row-level security, encrypted storage, no third-party analytics on health data.' },
                { icon: '🏥', title: 'Standards-based', desc: 'SMART on FHIR — the same protocol hospitals use for health record connections.' },
                { icon: '🛡️', title: 'AI with guardrails', desc: 'Never diagnoses, never recommends medication changes, always defers to providers.' },
                { icon: '⚡', title: 'Open standards', desc: 'Built on Next.js, Supabase (PostgreSQL), and Anthropic\'s Claude API.' },
              ].map((item, i) => (
                <div key={i} className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-[#6366F1]/20 transition-all duration-300">
                  <div className="text-xl mb-2 group-hover:scale-110 transition-transform inline-block">{item.icon}</div>
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
                { icon: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>, label: 'Partnership inquiries', email: 'externqllymc@gmail.com' },
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
