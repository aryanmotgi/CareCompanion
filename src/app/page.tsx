'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Single global scroll observer — watches ALL reveal elements on the page
function useGlobalScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );

    // Find every element on the page that needs scroll animation
    const selectors = '.scroll-reveal, .scroll-reveal-stagger, .scroll-reveal-scale, .scroll-reveal-left, .scroll-reveal-right';
    document.querySelectorAll(selectors).forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}

function Typewriter({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [started, text]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && <span className="typewriter-cursor">&nbsp;</span>}
    </span>
  );
}

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-blue-400/20"
          style={{
            width: `${Math.random() * 6 + 2}px`,
            height: `${Math.random() * 6 + 2}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `particle ${Math.random() * 15 + 10}s linear infinite`,
            animationDelay: `${Math.random() * 10}s`,
          }}
        />
      ))}
    </div>
  );
}

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          let current = 0;
          const step = Math.ceil(target / 40);
          const interval = setInterval(() => {
            current += step;
            if (current >= target) { current = target; clearInterval(interval); }
            setCount(current);
          }, 30);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

export default function LandingPage() {
  useGlobalScrollReveal();
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0C10] overflow-hidden">
      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        navScrolled
          ? 'bg-[#0A0C10]/90 backdrop-blur-xl border-b border-white/5'
          : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="font-display font-bold text-white text-lg">CareCompanion</span>
          </div>
          <Link
            href="/login"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all duration-200"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 relative min-h-[90vh] flex items-center">
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-violet-600/15 to-blue-600/15 rounded-full blur-3xl animate-float-slower" />
        <div className="absolute bottom-20 left-1/3 w-[300px] h-[300px] bg-gradient-to-br from-cyan-600/10 to-blue-600/10 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: '2s' }} />
        <Particles />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 backdrop-blur-sm rounded-full mb-8 animate-fade-in border border-blue-500/20">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm text-blue-300 font-medium">AI-Powered Caregiving Assistant</span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            <span className="animate-fade-in-up inline-block text-white">Your health</span>
            <br />
            <span className="animate-fade-in-up inline-block animate-gradient-text" style={{ animationDelay: '0.3s' }}>
              <Typewriter text="second brain" delay={800} />
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            CareCompanion remembers every medication, appointment, lab result, and insurance detail — so you can focus on what matters most: <span className="text-white font-medium">the people you love</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-2xl bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-1 transition-all duration-300 animate-glow-pulse"
            >
              Start for free
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto rounded-2xl bg-white/5 border border-white/10 px-8 py-4 text-base font-semibold text-slate-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5 transition-all duration-200"
            >
              See how it works
            </a>
          </div>

          <div className="mt-16 animate-fade-in" style={{ animationDelay: '1.2s' }}>
            <div className="w-6 h-10 rounded-full border-2 border-white/20 mx-auto flex justify-center pt-2">
              <div className="w-1 h-2 bg-white/40 rounded-full animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
        <section className="py-12 px-6 bg-white/[0.02] border-y border-white/5 scroll-reveal">
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: 10000, suffix: '+', label: 'Caregivers' },
              { value: 50000, suffix: '+', label: 'Medications tracked' },
              { value: 99, suffix: '%', label: 'Accuracy' },
              { value: 2, suffix: ' min', label: 'Setup time' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-3xl sm:text-4xl font-bold text-white">
                  <Counter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 scroll-reveal">
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-3">Features</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything caregivers need
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Stop juggling spreadsheets, sticky notes, and patient portals. CareCompanion organizes it all.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 scroll-reveal-stagger">
            {[
              {
                icon: 'M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z',
                title: 'AI that knows your situation',
                description: 'Tell CareCompanion about your loved one once. It remembers everything and gives specific, personalized guidance — never generic advice.',
                color: 'bg-blue-500/15 group-hover:bg-blue-500/25',
                iconColor: 'text-blue-400',
              },
              {
                icon: 'M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z',
                title: 'Snap to import',
                description: 'Take a photo of any pill bottle, lab report, insurance card, or doctor note. Our AI instantly extracts and organizes every detail.',
                color: 'bg-violet-500/15 group-hover:bg-violet-500/25',
                iconColor: 'text-violet-400',
              },
              {
                icon: 'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0',
                title: 'Never miss a thing',
                description: 'Refill reminders, appointment prep, abnormal lab alerts, denied claim explanations — CareCompanion proactively surfaces what you need to know.',
                color: 'bg-amber-500/15 group-hover:bg-amber-500/25',
                iconColor: 'text-amber-400',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="scroll-reveal-child bg-white/[0.03] rounded-2xl border border-white/[0.06] p-7 hover:bg-white/[0.06] hover:border-white/10 hover:-translate-y-1 transition-all duration-300 group cursor-default"
              >
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-5 transition-colors duration-300`}>
                  <svg className={`w-6 h-6 ${feature.iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                  </svg>
                </div>
                <h3 className="font-display text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 scroll-reveal">
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Up and running in 2 minutes
            </h2>
          </div>

          <div className="space-y-8">
            {[
              { step: '01', title: 'Enter your name', description: 'No email required. No passwords. Just tell us who you are and get started instantly.', direction: 'scroll-reveal-left' },
              { step: '02', title: 'Tell us about your loved one', description: 'A quick 5-step wizard captures their medications, doctors, appointments, and conditions. Or just snap a photo — we\'ll do the rest.', direction: 'scroll-reveal-right' },
              { step: '03', title: 'Start chatting', description: 'Ask CareCompanion anything. It knows your full care situation and gives specific, actionable answers. Like having a knowledgeable friend on call 24/7.', direction: 'scroll-reveal-left' },
            ].map((item) => (
              <div key={item.step} className={`${item.direction} flex items-start gap-6 p-6 rounded-2xl hover:bg-white/[0.03] transition-colors duration-300`}>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/30">
                  <span className="font-display text-lg font-bold text-white">{item.step}</span>
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="scroll-reveal-scale bg-white/[0.03] rounded-3xl border border-white/[0.06] p-8 sm:p-12 text-center">
            <div className="flex justify-center gap-1 mb-6">
              {[1,2,3,4,5].map((star) => (
                <svg key={star} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <blockquote className="font-display text-xl sm:text-2xl text-slate-200 leading-relaxed mb-6">
              &ldquo;I was drowning in pill bottles, appointment reminders, and insurance calls. CareCompanion gave me my sanity back. It&apos;s like having a co-caregiver who never forgets anything.&rdquo;
            </blockquote>
            <div>
              <p className="font-medium text-white">Sarah K.</p>
              <p className="text-sm text-slate-500">Caregiver for her mother, 78</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-blue-700/10 to-indigo-800/20" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl animate-float-slower" />
        <Particles />

        <div className="max-w-3xl mx-auto text-center relative scroll-reveal">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            Caregiving is hard enough.
            <br />
            <span className="text-blue-400">Let us help.</span>
          </h2>
          <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Join thousands of caregivers who use CareCompanion to manage medications, appointments, and insurance — all in one place.
          </p>
          <Link
            href="/login"
            className="inline-flex rounded-2xl bg-blue-600 px-10 py-5 text-lg font-semibold text-white hover:bg-blue-500 hover:shadow-2xl hover:shadow-blue-600/30 hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-blue-600/20"
          >
            Get started for free
          </Link>
          <p className="text-sm text-slate-600 mt-4">No credit card required. No email needed.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="text-sm text-slate-500">CareCompanion</span>
          </div>
          <p className="text-xs text-slate-600">Built with care, for caregivers.</p>
        </div>
      </footer>
    </div>
  );
}
