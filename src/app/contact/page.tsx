'use client';

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

export default function ContactPage() {
  const containerRef = useScrollReveal();

  return (
    <div className="min-h-dvh bg-[#080A14] text-[var(--text)] relative overflow-hidden page-grid">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-[#6366F1]/[0.06] blur-[120px]" />
        <div className="absolute top-[60%] -right-40 w-[400px] h-[400px] rounded-full bg-[#A78BFA]/[0.05] blur-[100px]" />
      </div>

      <PublicNav />
      <div ref={containerRef} className="max-w-2xl mx-auto px-5 pt-24 pb-16">

        <div className="reveal-item mb-10" style={{ '--delay': '0s' } as React.CSSProperties}>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[var(--text)] via-[#A78BFA] to-[var(--text)] bg-clip-text text-transparent bg-[length:200%] animate-[text-shimmer_6s_linear_infinite] mb-2">
            Contact Us
          </h1>
          <p className="text-sm text-[var(--text-muted)]">We&apos;re here to help. Reach out anytime.</p>
        </div>

        <div className="space-y-3 reveal-item" style={{ '--delay': '0.1s' } as React.CSSProperties}>
          {[
            {
              icon: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
              label: 'General inquiries',
              email: 'hello@carecompanionai.org',
            },
            {
              icon: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
              label: 'Privacy & data requests',
              email: 'privacy@carecompanionai.org',
            },
            {
              icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
              label: 'Security concerns',
              email: 'security@carecompanionai.org',
            },
          ].map((item, i) => (
            <a
              key={i}
              href={`mailto:${item.email}`}
              className="group flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-[#6366F1]/[0.06] hover:border-[#6366F1]/20 transition-all duration-300"
            >
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

        <div className="mt-12 pt-6 border-t border-[var(--border)] text-xs text-[var(--text-muted)] text-right">
          &copy; {new Date().getFullYear()} CareCompanion AI
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
