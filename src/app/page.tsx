'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

/* ── Cycling keyword with typing effect ── */
const CYCLING_WORDS = ['medications', 'appointments', 'lab results', 'insurance', 'refills'];
function CyclingWord() {
  const words = CYCLING_WORDS;
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIdx];

    if (!deleting && charIdx < word.length) {
      // Typing
      const timer = setTimeout(() => setCharIdx((c) => c + 1), 80);
      return () => clearTimeout(timer);
    } else if (!deleting && charIdx === word.length) {
      // Pause at full word
      const timer = setTimeout(() => setDeleting(true), 1800);
      return () => clearTimeout(timer);
    } else if (deleting && charIdx > 0) {
      // Deleting
      const timer = setTimeout(() => setCharIdx((c) => c - 1), 40);
      return () => clearTimeout(timer);
    } else if (deleting && charIdx === 0) {
      // Move to next word
      setDeleting(false);
      setWordIdx((w) => (w + 1) % words.length);
    }
  }, [charIdx, deleting, wordIdx, words]);

  return (
    <span className="text-[#A78BFA] font-semibold">
      {words[wordIdx].slice(0, charIdx)}
      <span className="animate-pulse text-[#A78BFA]/60">|</span>
    </span>
  );
}

/* ── Scroll reveal hook (enhanced — handles all reveal classes) ── */
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('revealed');
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale, .blur-reveal, .section-divider, .word-reveal-container, .glow-on-scroll, .stagger-list-container').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ── Scroll progress bar ── */
function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return <div className="scroll-progress" style={{ width: `${progress}%` }} />;
}

/* ── Floating particles ── */
function FloatingParticles() {
  const particles = useRef<{ id: number; left: string; size: number; duration: number; delay: number; drift: number; color: string }[]>([]);
  if (particles.current.length === 0) {
    particles.current = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
      drift: (Math.random() - 0.5) * 60,
      color: i % 3 === 0 ? 'rgba(99,102,241,0.4)' : i % 3 === 1 ? 'rgba(167,139,250,0.3)' : 'rgba(129,140,248,0.3)',
    }));
  }
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.current.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            bottom: '-5%',
            width: p.size,
            height: p.size,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ── Word-by-word reveal heading ── */
function WordReveal({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`word-reveal-container ${className}`}>
      {text.split(' ').map((word, i) => (
        <span key={i} className="word" style={{ transitionDelay: `${i * 80}ms` }}>
          {word}{' '}
        </span>
      ))}
    </span>
  );
}

/* ── 3D tilt card wrapper ── */
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.setProperty('--tilt-x', `${-y * 8}deg`);
    ref.current.style.setProperty('--tilt-y', `${x * 8}deg`);
  };
  const handleMouseLeave = () => {
    if (!ref.current) return;
    ref.current.style.setProperty('--tilt-x', '0deg');
    ref.current.style.setProperty('--tilt-y', '0deg');
  };
  return (
    <div ref={ref} className={`tilt-card ${className}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
    </div>
  );
}

/* ── Glow trail card — mouse-follow light effect ── */
function GlowCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ref.current.style.setProperty('--glow-x', `${x}px`);
    ref.current.style.setProperty('--glow-y', `${y}px`);
  };
  return (
    <div ref={ref} className={`glow-trail ${className}`} onMouseMove={handleMouseMove}>
      {children}
    </div>
  );
}

/* ── Gradient section divider ── */
function SectionDivider() {
  return <div className="section-divider scroll-reveal my-0" />;
}

/* ── Tab bar icon SVGs (matching BottomTabBar.tsx exactly) ── */
function TabIconHome({ active, size = 14 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke={active ? '#A78BFA' : 'rgba(255,255,255,0.25)'} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    </svg>
  );
}
function TabIconChat({ active, size = 14 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke={active ? '#A78BFA' : 'rgba(255,255,255,0.25)'} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
function TabIconCare({ active, size = 14 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke={active ? '#A78BFA' : 'rgba(255,255,255,0.25)'} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
function TabIconScan({ active, size = 14 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke={active ? '#A78BFA' : 'rgba(255,255,255,0.25)'} strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="3" x2="9" y2="9" />
    </svg>
  );
}

/* ── Phone mockup with auto-cycling screens ── */
function PhoneMockup({ className = '', size = 'large' }: { className?: string; size?: 'large' | 'small' }) {
  const [activeScreen, setActiveScreen] = useState(0);
  const screens = [
    { label: 'Home', content: <DashboardScreen /> },
    { label: 'Chat', content: <ChatScreen /> },
    { label: 'Care', content: <MedicationsScreen /> },
    { label: 'Scan', content: <ScanScreen /> },
  ];

  useEffect(() => {
    // Simple loop: Home → Chat → Care → Scan, 4s each (Chat gets 5s)
    const durations = [4000, 5000, 4000, 4000];
    let current = 0;
    let timer: NodeJS.Timeout;

    function next() {
      current = (current + 1) % 4;
      setActiveScreen(current);
      timer = setTimeout(next, durations[current]);
    }

    timer = setTimeout(next, durations[0]);
    return () => clearTimeout(timer);
  }, []);

  const isLarge = size === 'large';
  const w = isLarge ? 320 : 220;
  const h = isLarge ? 660 : 440;

  const tabIcons = [
    { Icon: TabIconHome, label: 'Home', screenIdx: 0 },
    { Icon: TabIconChat, label: 'Chat', screenIdx: 1 },
    { Icon: TabIconCare, label: 'Care', screenIdx: 2 },
    { Icon: TabIconScan, label: 'Scan', screenIdx: 3 },
  ];

  /* ── Small / flat variant (feature sections) ── */
  if (!isLarge) {
    return (
      <div className={`relative mx-auto ${className}`} style={{ width: w, height: h }}>
        <div className="absolute inset-0 rounded-[30px] bg-[#1a1a2e] shadow-[0_0_50px_rgba(99,102,241,0.12),0_15px_40px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-[3px] rounded-[27px] bg-[#0C0E1A] overflow-hidden border border-white/[0.06]">
            {/* Status bar */}
            <div className="relative z-20 flex items-center justify-between px-4 pt-2 pb-0.5">
              <span className="text-[8px] text-white/40 font-medium">9:41</span>
              <div className="absolute left-1/2 -translate-x-1/2 top-1.5">
                <div className="w-16 h-[16px] bg-black rounded-full" />
              </div>
              <div className="flex items-center gap-0.5">
                <svg width="10" height="7" viewBox="0 0 14 10" fill="none"><path d="M1 6h1v3H1zM4 4h1v5H4zM7 2h1v7H7zM10 0h1v9h-1z" fill="rgba(255,255,255,0.4)"/></svg>
                <svg width="14" height="7" viewBox="0 0 20 10" fill="none"><rect x="0.5" y="0.5" width="17" height="9" rx="2" stroke="rgba(255,255,255,0.25)"/><rect x="2" y="2" width="12" height="6" rx="1" fill="rgba(255,255,255,0.4)"/></svg>
              </div>
            </div>
            {/* Screen content */}
            <div className="absolute top-8 left-0 right-0 bottom-10 overflow-hidden">
              {screens.map((screen, i) => (
                <div key={i} className={`absolute inset-0 px-3 py-1.5 transition-opacity duration-700 ${i === activeScreen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  {screen.content}
                </div>
              ))}
            </div>
            {/* Tab bar */}
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#0C0E1A]/90 backdrop-blur border-t border-white/[0.06] pb-2 pt-1.5">
              <div className="flex justify-around items-center px-3">
                {tabIcons.map((tab) => {
                  const active = activeScreen === tab.screenIdx;
                  return (
                    <div key={tab.label} className="flex flex-col items-center gap-0.5">
                      <tab.Icon active={active} size={11} />
                      <span className={`text-[6px] ${active ? 'text-[#A78BFA] font-semibold' : 'text-white/25'}`}>{tab.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mx-auto mt-1 w-16 h-0.5 rounded-full bg-white/15" />
            </div>
          </div>
        </div>
        {/* Screen dots */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5">
          {screens.map((s, i) => (
            <button key={i} onClick={() => setActiveScreen(i)} className={`h-1.5 rounded-full transition-all duration-300 ${i === activeScreen ? 'bg-[#A78BFA] w-4' : 'bg-white/15 w-1.5'}`} aria-label={s.label} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Large / 3D variant (hero) ── */
  return (
    <div className={`relative mx-auto ${className}`} style={{ width: w + 40, height: h + 30, perspective: '1100px' }}>
      {/* Glow behind phone */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: '120%',
          height: '80%',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, rgba(167,139,250,0.06) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Floor shadow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: '70%',
          height: '20px',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.2) 0%, transparent 70%)',
          filter: 'blur(12px)',
        }}
      />

      {/* 3D transformed phone container */}
      <div
        className="relative w-full h-full animate-phone-float"
        style={{
          transform: 'rotateY(-5deg) rotateX(2deg)',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Side buttons — volume (left edge, visible due to 3D rotation) */}
        <div className="absolute top-[140px] w-[3px] h-[28px] rounded-l-sm" style={{ left: 27, background: 'linear-gradient(to right, #35355a, #2a2a42)', boxShadow: '-3px 0 8px rgba(0,0,0,0.5)' }} />
        <div className="absolute top-[178px] w-[3px] h-[28px] rounded-l-sm" style={{ left: 27, background: 'linear-gradient(to right, #35355a, #2a2a42)', boxShadow: '-3px 0 8px rgba(0,0,0,0.5)' }} />
        {/* Side button — power (right edge) */}
        <div className="absolute top-[160px] w-[3px] h-[40px] rounded-r-sm" style={{ right: 27, background: 'linear-gradient(to left, #35355a, #2a2a42)', boxShadow: '3px 0 8px rgba(0,0,0,0.5)' }} />
        {/* Side button — silent toggle */}
        <div className="absolute top-[105px] w-[3px] h-[14px] rounded-l-sm" style={{ left: 27, background: 'linear-gradient(to right, #35355a, #2a2a42)', boxShadow: '-3px 0 8px rgba(0,0,0,0.5)' }} />

        {/* Phone outer frame — titanium-style gradient */}
        <div
          className="absolute rounded-[48px]"
          style={{
            left: 30,
            right: 30,
            top: 15,
            bottom: 15,
            background: 'linear-gradient(145deg, #3a3a56 0%, #252540 15%, #1e1e35 50%, #18182d 85%, #252540 100%)',
            boxShadow: `
              0 0 0 0.5px rgba(255,255,255,0.08),
              0 2px 4px rgba(0,0,0,0.3),
              0 8px 16px rgba(0,0,0,0.4),
              0 20px 40px rgba(0,0,0,0.35),
              0 40px 80px rgba(0,0,0,0.25),
              0 0 100px rgba(99,102,241,0.1),
              0 0 200px rgba(167,139,250,0.05),
              inset 0 1px 0 rgba(255,255,255,0.1),
              inset 0 -1px 0 rgba(0,0,0,0.3)
            `,
          }}
        >
          {/* Reflection / shine overlay — top-left highlight */}
          <div
            className="absolute inset-0 rounded-[48px] pointer-events-none z-30"
            style={{
              background: `
                linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 15%, transparent 40%),
                linear-gradient(225deg, transparent 60%, rgba(255,255,255,0.02) 85%, rgba(255,255,255,0.04) 100%)
              `,
            }}
          />

          {/* Edge highlight — subtle rim light */}
          <div
            className="absolute inset-0 rounded-[48px] pointer-events-none z-30"
            style={{
              border: '0.5px solid rgba(255,255,255,0.06)',
              background: 'transparent',
            }}
          />

          {/* Phone inner bezel — screen area */}
          <div className="absolute inset-[4px] rounded-[44px] bg-[#0C0E1A] overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.04)' }}>
            {/* Screen glass effect — subtle top reflection */}
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background: 'linear-gradient(170deg, rgba(255,255,255,0.04) 0%, transparent 25%)',
              }}
            />

            {/* Status bar */}
            <div className="relative z-20 flex items-center justify-between px-6 pt-3 pb-1">
              <span className="text-[10px] text-white/50 font-medium">9:41</span>
              {/* Dynamic Island */}
              <div className="absolute left-1/2 -translate-x-1/2 top-2">
                <div className="w-[90px] h-[18px] bg-black rounded-full flex items-center justify-center"
                  style={{ boxShadow: 'inset 0 0 3px rgba(0,0,0,0.9)' }}>
                  <div className="w-2 h-2 rounded-full bg-[#0a0a15] border border-white/[0.05]" />
                </div>
              </div>
              {/* Status icons */}
              <div className="flex items-center gap-1">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 6h1v3H1zM4 4h1v5H4zM7 2h1v7H7zM10 0h1v9h-1z" fill="rgba(255,255,255,0.5)"/></svg>
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M6.5 3C8.5 3 10.2 4 11.5 5.5L6.5 10 1.5 5.5C2.8 4 4.5 3 6.5 3z" fill="rgba(255,255,255,0.5)"/></svg>
                <svg width="20" height="10" viewBox="0 0 20 10" fill="none"><rect x="0.5" y="0.5" width="17" height="9" rx="2" stroke="rgba(255,255,255,0.3)"/><rect x="2" y="2" width="12" height="6" rx="1" fill="rgba(255,255,255,0.5)"/><path d="M19 3.5v3a1 1 0 000-3z" fill="rgba(255,255,255,0.3)"/></svg>
              </div>
            </div>

            {/* Screen content */}
            <div className="absolute top-10 left-0 right-0 bottom-14 overflow-hidden" style={{ background: 'linear-gradient(180deg, #0e1025 0%, #0C0E1A 100%)' }}>
              {screens.map((screen, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 px-4 py-2 transition-opacity duration-700 ${i === activeScreen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  {screen.content}
                </div>
              ))}
            </div>

            {/* Bottom tab bar with real SVG icons */}
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#0C0E1A]/90 backdrop-blur border-t border-white/[0.06] pb-3 pt-2">
              <div className="flex justify-around items-center px-4">
                {tabIcons.map((tab) => {
                  const active = activeScreen === tab.screenIdx;
                  return (
                    <div key={tab.label} className="flex flex-col items-center gap-0.5">
                      <tab.Icon active={active} size={14} />
                      <span className={`text-[8px] ${active ? 'text-[#A78BFA] font-semibold' : 'text-white/25'}`}>{tab.label}</span>
                      {active && <div className="w-1 h-1 rounded-full bg-[#A78BFA]" />}
                    </div>
                  );
                })}
              </div>
              {/* Home indicator */}
              <div className="mx-auto mt-2 w-28 h-1 rounded-full bg-white/15" />
            </div>
          </div>
        </div>
      </div>
      {/* Screen dots */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {screens.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveScreen(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === activeScreen ? 'bg-[#A78BFA] w-5' : 'bg-white/15 w-2'}`}
            aria-label={s.label}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Demo screens for phone mockup ── */
function DashboardScreen() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    // Start collapsed, expand after 1.5s, collapse at 3.2s (before screen cycles)
    const openTimer = setTimeout(() => setExpanded(true), 1500);
    const closeTimer = setTimeout(() => setExpanded(false), 3200);
    return () => { clearTimeout(openTimer); clearTimeout(closeTimer); };
  }, []);
  return (
    <div className="space-y-2">
      {/* App header */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-white/90">CareCompanion</span>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-[7px] text-white font-bold">AM</div>
      </div>
      {/* Greeting */}
      <div className="mb-0.5">
        <div className="text-[8px] text-[#94a3b8] uppercase tracking-wider">Good afternoon</div>
        <div className="text-[13px] font-bold text-white/90">3 items need attention</div>
      </div>
      {/* Urgent card — EXPANDED with details */}
      <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-xl p-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
              <span className="text-[7px] text-[#ef4444] font-semibold tracking-wider uppercase">Urgent</span>
            </div>
            <div className="text-[10px] text-white/90 font-semibold">Lisinopril refill due tomorrow</div>
            <div className="text-[8px] text-white/40">3 pills remaining · Dr. Patel</div>
          </div>
          <span className={`text-[10px] text-white/30 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}>▸</span>
        </div>
        {/* Animated expanded details */}
        <div
          className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ maxHeight: expanded ? '120px' : '0px', opacity: expanded ? 1 : 0 }}
        >
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <div className="grid grid-cols-2 gap-1 text-[7px] mb-2">
              <div><span className="text-white/30">Dose:</span> <span className="text-white/70">10mg</span></div>
              <div><span className="text-white/30">Frequency:</span> <span className="text-white/70">Once daily</span></div>
              <div><span className="text-white/30">Doctor:</span> <span className="text-white/70">Dr. Patel</span></div>
              <div><span className="text-white/30">Remaining:</span> <span className="text-[#fbbf24]">3 pills</span></div>
            </div>
            <div className="bg-gradient-to-r from-[#6366F1] to-[#A78BFA] rounded-md py-1 text-center">
              <span className="text-[8px] text-white font-semibold">Call Pharmacy</span>
            </div>
          </div>
        </div>
      </div>
      {/* Upcoming — collapsed */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#818CF8]" />
              <span className="text-[7px] text-[#818CF8] font-semibold tracking-wider uppercase">Upcoming</span>
            </div>
            <div className="text-[10px] text-white/90 font-semibold">Dr. Patel — Cardiology</div>
            <div className="text-[8px] text-white/40">Tomorrow at 2:30 PM</div>
          </div>
          <span className="text-[10px] text-white/20">▸</span>
        </div>
      </div>
      {/* Alert — collapsed */}
      <div className="bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)] rounded-xl p-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]" />
              <span className="text-[7px] text-[#fbbf24] font-semibold tracking-wider uppercase">Alert</span>
            </div>
            <div className="text-[10px] text-white/90 font-semibold">LDL Cholesterol — 165 mg/dL</div>
            <div className="text-[8px] text-white/40">Above normal (&lt; 100)</div>
          </div>
          <span className="text-[10px] text-white/20">▸</span>
        </div>
      </div>
    </div>
  );
}

function MedicationsScreen() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const openTimer = setTimeout(() => setExpanded(true), 1200);
    const closeTimer = setTimeout(() => setExpanded(false), 3200);
    return () => { clearTimeout(openTimer); clearTimeout(closeTimer); };
  }, []);
  return (
    <div className="space-y-2">
      {/* Segment control */}
      <div className="flex gap-0.5 bg-[#10122B] rounded-[10px] p-[2px] border border-white/[0.04]">
        <div className="flex-1 text-center text-[9px] py-1.5 rounded-[8px] bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white font-semibold">Medications</div>
        <div className="flex-1 text-center text-[9px] py-1.5 text-white/30 font-medium">Appointments</div>
        <div className="flex-1 text-center text-[9px] py-1.5 text-white/30 font-medium">Conflicts</div>
      </div>
      <div className="text-[7px] text-red-400 uppercase tracking-wider font-semibold">Needs Refill</div>
      {/* Lisinopril — collapsed */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-white/85 font-semibold">Lisinopril</div>
            <div className="text-[8px] text-white/40">10mg · Once daily</div>
          </div>
          <span className="text-[10px] text-white/20">▸</span>
        </div>
      </div>
      <div className="text-[7px] text-white/30 uppercase tracking-wider">Active Medications</div>
      {/* Metformin — EXPANDED with slide-down details */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-white/85 font-semibold">Metformin</div>
            <div className="text-[8px] text-white/40">500mg · Twice daily</div>
          </div>
          <span className={`text-[10px] text-white/30 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}>▸</span>
        </div>
        {/* Animated expanded details */}
        <div
          className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ maxHeight: expanded ? '120px' : '0px', opacity: expanded ? 1 : 0 }}
        >
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <div className="grid grid-cols-2 gap-1 text-[7px] mb-2">
              <div><span className="text-white/30">Doctor:</span> <span className="text-white/70">Dr. Chen</span></div>
              <div><span className="text-white/30">Refill:</span> <span className="text-white/70">Apr 15</span></div>
              <div><span className="text-white/30">Remaining:</span> <span className="text-white/70">28 pills</span></div>
              <div><span className="text-white/30">Frequency:</span> <span className="text-white/70">Twice daily</span></div>
            </div>
            <div className="flex gap-1.5">
              <div className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-md py-1 text-center">
                <span className="text-[7px] text-white/70 font-medium">Edit</span>
              </div>
              <div className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-md py-1 text-center">
                <span className="text-[7px] text-[#ef4444] font-medium">Delete</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Atorvastatin — collapsed */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-white/85 font-semibold">Atorvastatin</div>
            <div className="text-[8px] text-white/40">20mg · Once daily</div>
          </div>
          <span className="text-[10px] text-white/20">▸</span>
        </div>
      </div>
      {/* Add button */}
      <div className="bg-gradient-to-r from-[#6366F1] to-[#A78BFA] rounded-xl py-1.5 text-center">
        <span className="text-[9px] text-white font-semibold">+ Add Medication</span>
      </div>
    </div>
  );
}

function ChatScreen() {
  const userMsg = 'What should I ask Dr. Patel about my blood pressure?';
  const aiLines = [
    'Here are 3 questions for your visit:',
    '',
    '1. Should we adjust my Lisinopril dose given my recent readings?',
    '2. How often should I check my BP at home?',
    '3. Are there lifestyle changes to try before adding medication?',
  ];

  const [phase, setPhase] = useState<'user-typing' | 'thinking' | 'ai-typing' | 'done'>('user-typing');
  const [userChars, setUserChars] = useState(0);
  const [aiChars, setAiChars] = useState(0);

  const fullAiText = aiLines.join('\n');

  // User typing phase
  useEffect(() => {
    if (phase !== 'user-typing') return;
    if (userChars >= userMsg.length) {
      const t = setTimeout(() => setPhase('thinking'), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setUserChars((c) => c + 1), 28);
    return () => clearTimeout(t);
  }, [phase, userChars]);

  // Thinking phase (show dots for 1.2s then start AI)
  useEffect(() => {
    if (phase !== 'thinking') return;
    const t = setTimeout(() => setPhase('ai-typing'), 1200);
    return () => clearTimeout(t);
  }, [phase]);

  // AI typing phase
  useEffect(() => {
    if (phase !== 'ai-typing') return;
    if (aiChars >= fullAiText.length) {
      const t = setTimeout(() => setPhase('done'), 1500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setAiChars((c) => c + 1), 18);
    return () => clearTimeout(t);
  }, [phase, aiChars, fullAiText.length]);

  // Reset loop
  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(() => {
      setPhase('user-typing');
      setUserChars(0);
      setAiChars(0);
    }, 2500);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-[6px] text-white font-bold flex-shrink-0">AI</div>
        <span className="text-[10px] text-white/70 font-semibold">CareCompanion Chat</span>
      </div>

      <div className="flex-1 space-y-2 overflow-hidden">
        {/* User message bubble */}
        {(phase === 'user-typing' || phase === 'thinking' || phase === 'ai-typing' || phase === 'done') && userChars > 0 && (
          <div className="flex justify-end">
            <div className="bg-gradient-to-br from-[#6366F1] to-[#A78BFA] rounded-2xl rounded-tr-sm px-2.5 py-1.5 max-w-[85%]">
              <div className="text-[9px] text-white leading-relaxed">
                {userMsg.slice(0, userChars)}
                {phase === 'user-typing' && <span className="inline-block w-[3px] h-[9px] bg-white/70 ml-[1px] animate-pulse align-middle" />}
              </div>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {phase === 'thinking' && (
          <div className="flex gap-1.5 items-start">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-[6px] text-white font-bold flex-shrink-0">AI</div>
            <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-3 py-2">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* AI response */}
        {(phase === 'ai-typing' || phase === 'done') && (
          <div className="flex gap-1.5 items-start">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-[6px] text-white font-bold flex-shrink-0">AI</div>
            <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-2.5 py-1.5 max-w-[85%]">
              <div className="text-[9px] text-white/80 leading-relaxed whitespace-pre-wrap">
                {fullAiText.slice(0, aiChars)}
                {phase === 'ai-typing' && <span className="inline-block w-[3px] h-[9px] bg-[#A78BFA]/70 ml-[1px] animate-pulse align-middle" />}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-xl px-2.5 py-1.5 mt-2 border border-white/[0.06]">
        <div className="text-[8px] text-white/30 flex-1">Ask about your health...</div>
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </div>
      </div>
    </div>
  );
}

function ScanScreen() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <svg width="12" height="12" fill="none" stroke="#A78BFA" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="3" x2="9" y2="9" />
        </svg>
        <span className="text-[10px] text-[#A78BFA] font-semibold">Scan Results</span>
      </div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-lg bg-[#6366F1]/15 flex items-center justify-center">
            <svg width="10" height="10" fill="none" stroke="#818CF8" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <div className="text-[9px] text-white/70 font-medium">Lab Report Detected</div>
            <div className="text-[7px] text-white/30">Extracted 3 values</div>
          </div>
        </div>
        <div className="space-y-1.5">
          {[
            { name: 'Blood Pressure', value: '142/88', flag: true },
            { name: 'LDL Cholesterol', value: '165 mg/dL', flag: true },
            { name: 'A1C', value: '7.2%', flag: true },
          ].map((lab) => (
            <div key={lab.name} className="flex items-center justify-between py-0.5">
              <span className="text-[8px] text-white/50">{lab.name}</span>
              <div className="flex items-center gap-1">
                <span className={`text-[8px] font-medium ${lab.flag ? 'text-[#ef4444]' : 'text-emerald-400'}`}>{lab.value}</span>
                {lab.flag && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-gradient-to-r from-[#6366F1] to-[#A78BFA] rounded-xl py-2 text-center shadow-lg shadow-[#6366F1]/20">
        <span className="text-[9px] text-white font-semibold">Save to Profile</span>
      </div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl py-1.5 text-center">
        <span className="text-[9px] text-white/40 font-medium">Ask AI about these results</span>
      </div>
    </div>
  );
}

/* ── Feature section ── */
/* ── Feature Carousel — cards slide through the phone ── */
function FeatureShowcase() {
  const cards = [
    { badge: 'Dashboard', color: '#ef4444', icon: '📊', title: 'Smart Alerts', desc: 'Urgent refills, appointments, and abnormal labs surfaced automatically.' },
    { badge: 'Scan', color: '#818CF8', icon: '📸', title: 'Scan Documents', desc: 'Photo a prescription or lab report. AI extracts and organizes everything.' },
    { badge: 'AI Chat', color: '#A78BFA', icon: '💬', title: 'Ask AI Anything', desc: 'Questions about meds, labs, insurance. Your AI companion knows it all.' },
    { badge: 'Family', color: '#34D399', icon: '👨‍👩‍👦', title: 'Care Team', desc: 'Invite family, detect conflicts, find backup care when plans collide.' },
  ];

  const [active, setActive] = useState(0);

  useEffect(() => {
    // Swap between page 0 (cards 0,1) and page 2 (cards 2,3)
    const timer = setInterval(() => setActive((a) => a === 0 ? 2 : 0), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto max-w-[700px]">
      {/* Phone centered */}
      <div className="flex justify-center mb-12 sm:mb-16">
        <PhoneMockup size="small" />
      </div>

      {/* 2 cards at a time, swipe through pairs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4">
        {[cards[active], cards[(active + 1) % cards.length]].map((card, i) => (
          <div
            key={`${active}-${i}`}
            className="transition-all duration-500 animate-fade-in-up"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <TiltCard>
              <GlowCard>
                <div
                  className="backdrop-blur-md rounded-2xl p-4 border border-white/[0.08] h-full glow-on-scroll revealed"
                  style={{
                    background: 'rgba(12, 14, 26, 0.85)',
                    boxShadow: `0 4px 20px rgba(0,0,0,0.25), 0 0 15px ${card.color}08`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base" style={{ background: `${card.color}15` }}>
                      {card.icon}
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: card.color }}>{card.badge}</span>
                  </div>
                  <div className="text-[13px] font-bold text-white/90 mb-1">{card.title}</div>
                  <div className="text-[10px] text-white/40 leading-relaxed">{card.desc}</div>
                </div>
              </GlowCard>
            </TiltCard>
          </div>
        ))}
      </div>

      {/* Dots — 2 pages */}
      <div className="flex gap-2 justify-center mt-5">
        {[0, 2].map((pageStart, i) => (
          <button
            key={i}
            onClick={() => setActive(pageStart)}
            className={`h-1.5 rounded-full transition-all duration-300 ${active === pageStart ? 'w-5 bg-[#A78BFA]' : 'w-1.5 bg-white/15'}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Animated stat counter ── */
function AnimatedStat({ end, suffix = '', label }: { end: number; suffix?: string; label: string }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let frame: number;
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [started, end]);

  return (
    <div ref={ref} className="scroll-reveal">
      <div className="text-fluid-3xl font-bold text-[var(--text)] font-display">
        {count}{suffix}
      </div>
      <div className="text-[var(--text-secondary)] text-xs mt-1">{label}</div>
    </div>
  );
}

/* ── Main page ── */
export default function LandingPage() {
  useScrollReveal();
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setHeaderVisible(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-x-hidden">
      {/* Scroll progress bar */}
      <ScrollProgress />

      {/* Ambient background + floating particles */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute w-[500px] h-[500px] rounded-full animate-blob-1" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', top: '-15%', right: '-10%', filter: 'blur(80px)' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full animate-blob-2" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)', bottom: '10%', left: '-10%', filter: 'blur(80px)' }} />
        <FloatingParticles />
      </div>

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${headerVisible ? 'opacity-100 translate-y-0 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--border)]' : 'opacity-0 -translate-y-full'}`}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center shadow-lg shadow-[#6366F1]/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="font-display font-bold text-[var(--text)] text-lg">CareCompanion</span>
          </div>
          <Link
            href="/login"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold hover:opacity-90 transition-opacity shimmer-btn relative overflow-hidden"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-20 sm:pt-24 pb-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row-reverse items-center gap-6 lg:gap-12">
          {/* Phone — FIRST on mobile, right side on desktop */}
          <div className="flex-shrink-0 w-full max-w-[360px] lg:max-w-none lg:w-auto animate-fade-in-up overflow-visible flex justify-center">
            <PhoneMockup size="large" />
          </div>
          {/* Text — BELOW phone on mobile, left side on desktop */}
          <div className="flex-1 text-center lg:text-left mt-8 lg:mt-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#A78BFA]/10 border border-[#A78BFA]/20 mb-6 animate-fade-in">
              <div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
              <span className="text-[#A78BFA] text-xs font-medium">AI-Powered Caregiving</span>
            </div>
            <h1 className="font-display text-fluid-3xl sm:text-fluid-4xl font-bold leading-tight mb-4 text-shimmer">
              Your family&apos;s health,<br />finally in one place
            </h1>
            <p className="text-[var(--text-secondary)] text-fluid-base max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Stop juggling 5 apps for <CyclingWord />. CareCompanion brings it all together, so you can focus on <strong className="text-[var(--text)]">the people you love</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <Link
                href="/login"
                className="px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white font-semibold text-sm shadow-lg shadow-[#6366F1]/25 hover:shadow-[#6366F1]/40 transition-shadow shimmer-btn relative overflow-hidden"
              >
                Start for free
              </Link>
              <a
                href="#features"
                className="px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[var(--text)] font-semibold text-sm hover:bg-white/[0.08] transition-colors"
              >
                See how it works
              </a>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Features — phone center, cards below */}
      <section id="features" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center font-display text-fluid-2xl font-bold text-[var(--text)] mb-3 blur-reveal"><WordRevealH text="What you can do" /></h2>
          <p className="text-center text-[var(--text-secondary)] text-fluid-sm mb-12 sm:mb-16 blur-reveal">Everything a caregiver needs. Nothing they don&apos;t.</p>
          <FeatureShowcase />
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center font-display text-fluid-2xl font-bold text-[var(--text)] mb-3 blur-reveal"><WordRevealH text="How it works" /></h2>
          <p className="text-center text-[var(--text-secondary)] text-fluid-sm mb-10 sm:mb-12 blur-reveal">Three steps. Five minutes. Your whole family organized.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { step: '1', icon: '👤', title: 'Add your loved ones', desc: 'Create a profile for each person you care for. Add their medications, doctors, and conditions.' },
              { step: '2', icon: '📸', title: 'Scan their documents', desc: 'Photo a prescription bottle, lab report, or insurance card. AI extracts and organizes everything.' },
              { step: '3', icon: '✨', title: 'Get AI-powered insights', desc: 'Ask questions, get refill alerts, prepare for appointments, and coordinate with family.' },
            ].map((item, i) => (
              <div key={i} className="relative blur-reveal" style={{ transitionDelay: `${i * 150}ms` }}>
                <TiltCard>
                  <GlowCard>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 text-center h-full glow-on-scroll">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center mx-auto mb-4 text-white font-bold text-sm shadow-lg shadow-[#6366F1]/20">
                      {item.step}
                    </div>
                    <div className="text-2xl mb-3">{item.icon}</div>
                    <h3 className="font-display font-bold text-[var(--text)] text-sm mb-2">{item.title}</h3>
                    <p className="text-[var(--text-secondary)] text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  </GlowCard>
                </TiltCard>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 text-white/10 text-xl">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ BEFORE vs AFTER COMPARISON ═══════ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[rgba(167,139,250,0.02)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center font-display text-fluid-2xl font-bold text-[var(--text)] mb-8 sm:mb-12 blur-reveal"><WordRevealH text="Life before vs. after" /></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Before */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 scroll-reveal-left">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-sm">😩</div>
                <h3 className="font-display font-bold text-red-400 text-sm">Without CareCompanion</h3>
              </div>
              <div className="space-y-3 stagger-list-container">
                {[
                  'Medication info scattered across 3 apps',
                  'Forget to refill until it\'s too late',
                  'Can\'t remember what the doctor said',
                  'Family group chat is chaos',
                  'Lab results make no sense',
                  'Insurance claims pile up unread',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 stagger-list-item" style={{ transitionDelay: `${i * 100}ms` }}>
                    <span className="text-red-400/60 text-xs mt-0.5">✕</span>
                    <span className="text-[var(--text-secondary)] text-xs leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* After */}
            <div className="bg-[rgba(99,102,241,0.04)] border border-[rgba(99,102,241,0.12)] rounded-2xl p-6 scroll-reveal-right">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#6366F1]/10 flex items-center justify-center text-sm">😌</div>
                <h3 className="font-display font-bold text-[#A78BFA] text-sm">With CareCompanion</h3>
              </div>
              <div className="space-y-3 stagger-list-container">
                {[
                  'Everything in one place for your whole family',
                  'Smart alerts before you run out',
                  'AI prepares questions for every visit',
                  'Care team shares one clear view',
                  'AI explains results in plain English',
                  'Denied claims? AI helps you appeal',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 stagger-list-item" style={{ transitionDelay: `${i * 100}ms` }}>
                    <span className="text-[#A78BFA] text-xs mt-0.5">✓</span>
                    <span className="text-[var(--text-secondary)] text-xs leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ TRUST & SECURITY ═══════ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center font-display text-fluid-2xl font-bold text-[var(--text)] mb-3 blur-reveal"><WordRevealH text="Built on trust" /></h2>
          <p className="text-center text-[var(--text-secondary)] text-fluid-sm mb-8 sm:mb-12 blur-reveal">Your health data is sensitive. We treat it that way.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: '🔒', title: 'End-to-end encrypted', desc: 'Your data is encrypted at rest and in transit' },
              { icon: '🛡️', title: 'HIPAA-aware design', desc: 'Built with healthcare privacy standards in mind' },
              { icon: '🚫', title: 'Never sold', desc: 'We don\'t sell your health data. Period.' },
              { icon: '👤', title: 'You own your data', desc: 'Export or delete everything anytime' },
            ].map((item, i) => (
              <TiltCard key={i}>
                <GlowCard>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-center blur-reveal glow-on-scroll" style={{ transitionDelay: `${i * 100}ms` }}>
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <h3 className="font-display font-bold text-[var(--text)] text-xs mb-1">{item.title}</h3>
                    <p className="text-[var(--text-muted)] text-[10px] leading-relaxed">{item.desc}</p>
                  </div>
                </GlowCard>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ ANIMATED NUMBERS ═══════ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[rgba(167,139,250,0.02)]">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            <AnimatedStat end={50} suffix="+" label="Medications tracked" />
            <AnimatedStat end={200} suffix="+" label="Appointments managed" />
            <AnimatedStat end={100} suffix="%" label="Free to use" />
            <AnimatedStat end={5} suffix=" min" label="Setup time" />
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Final CTA */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[rgba(167,139,250,0.02)]">
        <div className="max-w-lg mx-auto text-center blur-reveal">
          <h2 className="font-display text-fluid-3xl font-bold mb-4 animate-greeting">Start caring smarter</h2>
          <p className="text-[var(--text-secondary)] text-fluid-sm mb-8">Join caregivers who finally have everything in one place.</p>
          <Link
            href="/login"
            className="inline-block px-10 py-4 rounded-2xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white font-semibold shadow-lg shadow-[#6366F1]/25 hover:shadow-[#6366F1]/40 transition-shadow shimmer-btn relative overflow-hidden"
          >
            Get started — it&apos;s free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="text-[var(--text-muted)] text-sm">CareCompanion</span>
          </div>
          <div className="text-[var(--text-muted)] text-xs">
            Built with care. Your health data stays yours.
          </div>
        </div>
      </footer>
    </div>
  );
}

