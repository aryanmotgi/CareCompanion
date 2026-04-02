'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

/* ───────────────────────────────────────────
   Global scroll observer
   ─────────────────────────────────────────── */
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

    const selectors = '.scroll-reveal, .scroll-reveal-stagger, .scroll-reveal-scale, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-step';
    document.querySelectorAll(selectors).forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}

/* ───────────────────────────────────────────
   WordReveal — word-by-word fade up
   ─────────────────────────────────────────── */
function WordReveal({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split(' ').map((word, i) => (
        <span
          key={i}
          className="inline-block opacity-0 translate-y-4 animate-[word-reveal_0.5s_ease_forwards]"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {word}&nbsp;
        </span>
      ))}
    </span>
  );
}

/* ───────────────────────────────────────────
   TiltCard — 3D tilt on hover
   ─────────────────────────────────────────── */
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`;
  };

  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg) scale(1)';
  };

  return (
    <div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className={`transition-transform duration-300 ease-out ${className}`}>
      {children}
    </div>
  );
}

/* ───────────────────────────────────────────
   PhoneMockup — 3D floating phone
   ─────────────────────────────────────────── */
function PhoneMockup() {
  return (
    <div className="relative mt-16 mx-auto" style={{ perspective: '1000px' }}>
      {/* Glow */}
      <div className="absolute inset-0 bg-blue-500/20 rounded-[40px] blur-[60px] animate-[glow-pulse_4s_ease-in-out_infinite]" />
      {/* Phone */}
      <div
        className="relative w-[280px] h-[560px] bg-[#1e293b] rounded-[40px] border-2 border-white/10 overflow-hidden shadow-2xl animate-[phone-float_6s_ease-in-out_infinite]"
        style={{ transform: 'rotateY(-5deg) rotateX(5deg)' }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#0f172a] rounded-b-2xl z-10" />
        {/* Screen content */}
        <div className="pt-10 px-4 space-y-3">
          <div className="text-white/60 text-[10px]">Good afternoon</div>
          <div className="text-white text-sm font-bold">Mom&apos;s Care Summary</div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-red-300 text-[8px] font-semibold">NEEDS ATTENTION</span>
            </div>
            <div className="text-white text-[11px] font-medium mt-1">Lisinopril refill due tomorrow</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-2.5">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-cyan-300 text-[8px] font-semibold">UPCOMING</span>
            </div>
            <div className="text-white text-[11px] font-medium mt-1">Dr. Patel — Thursday 2:30 PM</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-2.5">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-amber-300 text-[8px] font-semibold">ALERT</span>
            </div>
            <div className="text-white text-[11px] font-medium mt-1">LDL Cholesterol flagged high</div>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2.5 text-center">
            <div className="text-indigo-300 text-[8px]">QUICK ASK</div>
            <div className="text-white/80 text-[10px] mt-1">What should I ask Dr. Patel?</div>
          </div>
        </div>
        {/* Bottom tab bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#0f172a] border-t border-white/10 flex justify-around py-2.5 px-3">
          <div className="flex flex-col items-center gap-0.5"><div className="w-4 h-4 rounded bg-cyan-400/20" /><span className="text-[7px] text-cyan-400">Home</span></div>
          <div className="flex flex-col items-center gap-0.5"><div className="w-4 h-4 rounded bg-white/10" /><span className="text-[7px] text-white/30">Chat</span></div>
          <div className="flex flex-col items-center gap-0.5"><div className="w-4 h-4 rounded bg-white/10" /><span className="text-[7px] text-white/30">Care</span></div>
          <div className="flex flex-col items-center gap-0.5"><div className="w-4 h-4 rounded bg-white/10" /><span className="text-[7px] text-white/30">Scan</span></div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   DrawLine — SVG connecting line that draws
   itself when scrolled into view
   ─────────────────────────────────────────── */
function DrawLine() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          el.classList.add('draw-active');
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={svgRef} className="draw-line absolute left-7 top-0 bottom-0 w-[2px] z-0" style={{ height: '100%' }} preserveAspectRatio="none" viewBox="0 0 2 100">
      <line x1="1" y1="0" x2="1" y2="100" stroke="url(#line-grad)" strokeWidth="2" strokeDasharray="100" strokeDashoffset="100" className="connecting-line" />
      <defs>
        <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(59,130,246,0.5)" />
          <stop offset="100%" stopColor="rgba(99,102,241,0.5)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ───────────────────────────────────────────
   Particles
   ─────────────────────────────────────────── */
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

/* ───────────────────────────────────────────
   Counter — counts up on scroll
   ─────────────────────────────────────────── */
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

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
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
      {/* Styles are in globals.css */}

      {/* ── Nav ── */}
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
            className="shimmer-btn rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all duration-200"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-36 pb-24 px-6 relative min-h-[90vh] flex items-center">
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-violet-600/15 to-blue-600/15 rounded-full blur-3xl animate-float-slower" />
        <div className="absolute bottom-20 left-1/3 w-[300px] h-[300px] bg-gradient-to-br from-cyan-600/10 to-blue-600/10 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: '2s' }} />
        <Particles />

        <div className="max-w-6xl mx-auto relative w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: text */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 backdrop-blur-sm rounded-full mb-8 animate-fade-in border border-blue-500/20">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm text-blue-300 font-medium">AI-Powered Caregiving Assistant</span>
              </div>

              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
                <WordReveal text="Your health second brain" className="text-white" />
              </h1>

              <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto lg:mx-0 mb-12 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
                CareCompanion remembers every medication, appointment, lab result, and insurance detail — so you can focus on what matters most: <span className="text-white font-medium">the people you love</span>.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 animate-fade-in-up" style={{ animationDelay: '1s' }}>
                <Link
                  href="/login"
                  className="shimmer-btn w-full sm:w-auto rounded-2xl bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-1 transition-all duration-300"
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

              <div className="mt-16 animate-fade-in" style={{ animationDelay: '1.4s' }}>
                <div className="w-6 h-10 rounded-full border-2 border-white/20 mx-auto lg:mx-0 flex justify-center pt-2">
                  <div className="w-1 h-2 bg-white/40 rounded-full animate-bounce" />
                </div>
              </div>
            </div>

            {/* Right: phone mockup */}
            <div className="hidden lg:flex justify-center animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-12 px-6 bg-white/[0.02] border-y border-white/5 scroll-reveal">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: 10000, suffix: '+', label: 'Caregivers' },
            { value: 50000, suffix: '+', label: 'Medications tracked' },
            { value: 99, suffix: '%', label: 'Accuracy' },
            { value: 2, suffix: ' min', label: 'Setup time' },
          ].map((stat) => (
            <div key={stat.label} className="relative stat-divider">
              <p className="font-display text-3xl sm:text-4xl font-bold text-white">
                <Counter target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
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
              <TiltCard key={feature.title} className="feature-card">
                <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-7 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group cursor-default h-full">
                  <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-5 transition-colors duration-300`}>
                    <svg className={`w-6 h-6 ${feature.iconColor} icon-glow`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 scroll-reveal">
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Up and running in 2 minutes
            </h2>
          </div>

          <div className="relative space-y-8">
            {/* Connecting line */}
            <DrawLine />

            {[
              { step: '01', title: 'Enter your name', description: 'No email required. No passwords. Just tell us who you are and get started instantly.', side: 'from-left' },
              { step: '02', title: 'Tell us about your loved one', description: 'A quick 5-step wizard captures their medications, doctors, appointments, and conditions. Or just snap a photo — we\'ll do the rest.', side: 'from-right' },
              { step: '03', title: 'Start chatting', description: 'Ask CareCompanion anything. It knows your full care situation and gives specific, actionable answers. Like having a knowledgeable friend on call 24/7.', side: 'from-left' },
            ].map((item) => (
              <div key={item.step} className={`scroll-reveal-step ${item.side} relative z-10 flex items-start gap-6 p-6 rounded-2xl hover:bg-white/[0.03] transition-colors duration-300`}>
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

      {/* ── Testimonial ── */}
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

      {/* ── CTA ── */}
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
            className="shimmer-btn inline-flex rounded-2xl bg-blue-600 px-10 py-5 text-lg font-semibold text-white hover:bg-blue-500 hover:shadow-2xl hover:shadow-blue-600/30 hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-blue-600/20"
          >
            Get started for free
          </Link>
          <p className="text-sm text-slate-600 mt-4">No credit card required. No email needed.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative py-10 px-6 border-t border-white/5">
        {/* Gradient fade at top */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#0A0C10] to-transparent -translate-y-full pointer-events-none" />
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="text-sm text-slate-500 footer-link">CareCompanion</span>
          </div>
          <p className="text-xs text-slate-600">Built with care, for caregivers.</p>
        </div>
      </footer>
    </div>
  );
}
