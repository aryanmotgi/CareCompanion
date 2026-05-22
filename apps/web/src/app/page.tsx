'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/* ── Interactive demo button ── */
function DemoButton() {
  const [phase, setPhase] = useState<'idle' | 'seeding' | 'redirecting'>('idle');
  const [error, setError] = useState('');

  const handleClick = async () => {
    setPhase('seeding');
    setError('');
    try {
      const res = await fetch('/api/demo/start', { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong.');
        setPhase('idle');
        return;
      }
      setPhase('redirecting');
      window.location.href = '/dashboard';
    } catch {
      setError('Could not start demo. Please try again.');
      setPhase('idle');
    }
  };

  const label =
    phase === 'seeding' ? 'Setting up demo…' :
    phase === 'redirecting' ? 'Loading dashboard…' :
    'Try interactive demo';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={handleClick}
        disabled={phase !== 'idle'}
        className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl border font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        style={{ borderColor: 'rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.08)', color: '#A78BFA' }}
      >
        {phase !== 'idle' ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
        {label}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/* ── Cycling keyword with typing effect ── */
const CYCLING_WORDS = ['medications', 'appointments', 'lab results', 'care team updates', 'treatment notes'];
function CyclingWord() {
  const words = CYCLING_WORDS;
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIdx];
    if (!deleting && charIdx < word.length) {
      const t = setTimeout(() => setCharIdx((c) => c + 1), 80);
      return () => clearTimeout(t);
    } else if (!deleting && charIdx === word.length) {
      const t = setTimeout(() => setDeleting(true), 1800);
      return () => clearTimeout(t);
    } else if (deleting && charIdx > 0) {
      const t = setTimeout(() => setCharIdx((c) => c - 1), 40);
      return () => clearTimeout(t);
    } else if (deleting && charIdx === 0) {
      setDeleting(false);
      setWordIdx((w) => (w + 1) % words.length);
    }
  }, [charIdx, deleting, wordIdx, words]);

  return (
    <span className="text-violet-400 font-semibold">
      {words[wordIdx].slice(0, charIdx)}
      <span className="animate-pulse text-violet-400/50">|</span>
    </span>
  );
}

/* ── Scroll reveal hook ── */
function useScrollReveal() {
  useEffect(() => {
    const selector = '.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale, .blur-reveal, .section-divider, .word-reveal-container, .glow-on-scroll, .stagger-list-container';
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('revealed');
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px 100px 0px' }
    );
    document.querySelectorAll(selector).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ── Tab bar icons ── */
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
    <svg width={size} height={size} fill="none" stroke={active ? '#67E8F9' : 'rgba(255,255,255,0.25)'} strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="3" x2="9" y2="9" />
    </svg>
  );
}
function TabIconTrials({ active, size = 14 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke={active ? '#34D399' : 'rgba(255,255,255,0.25)'} strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21a48.309 48.309 0 01-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
}

/* ── Phone mockup ── */
const SCREEN_CONFIG = [
  { glow: '99,102,241',  glowA: 0.22, tabColor: '#A78BFA' },
  { glow: '167,139,250', glowA: 0.18, tabColor: '#A78BFA' },
  { glow: '99,102,241',  glowA: 0.22, tabColor: '#A78BFA' },
  { glow: '52,211,153',  glowA: 0.18, tabColor: '#34D399' },
  { glow: '103,232,249', glowA: 0.15, tabColor: '#67E8F9' },
] as const;

function PhoneMockup({ className = '', onScreenChange }: { className?: string; onScreenChange?: (idx: number) => void }) {
  const [activeScreen, setActiveScreen] = useState(0);
  const [screenKey, setScreenKey] = useState(0);
  const [direction, setDirection] = useState(1);
  const [tilt, setTilt] = useState({ x: 3, y: -5 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  const screens = [
    { label: 'Home',   content: <DashboardScreen /> },
    { label: 'Chat',   content: <ChatScreen /> },
    { label: 'Care',   content: <MedicationsScreen /> },
    { label: 'Trials', content: <TrialsScreen /> },
    { label: 'Scan',   content: <ScanScreen /> },
  ];

  useEffect(() => {
    const durations = [4000, 5000, 4000, 5000, 4000];
    let current = 0;
    let timer: NodeJS.Timeout;
    function next() {
      current = (current + 1) % 5;
      setDirection(1);
      setActiveScreen(current);
      setScreenKey(k => k + 1);
      onScreenChange?.(current);
      timer = setTimeout(next, durations[current]);
    }
    timer = setTimeout(next, durations[0]);
    return () => clearTimeout(timer);
  }, [onScreenChange]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width * 0.65);
    const dy = (e.clientY - cy) / (rect.height * 0.65);
    setTilt({ x: dy * -9, y: dx * 11 });
  };
  const handleMouseLeave = () => setTilt({ x: 3, y: -5 });

  const cfg = SCREEN_CONFIG[activeScreen];

  const tabIcons = [
    { Icon: TabIconHome,   label: 'Home',   screenIdx: 0 },
    { Icon: TabIconChat,   label: 'Chat',   screenIdx: 1 },
    { Icon: TabIconCare,   label: 'Care',   screenIdx: 2 },
    { Icon: TabIconTrials, label: 'Trials', screenIdx: 3 },
    { Icon: TabIconScan,   label: 'Scan',   screenIdx: 4 },
  ];

  return (
    <div
      ref={wrapperRef}
      className={`relative mx-auto ${className}`}
      style={{ width: 360, height: 760 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient ground glow — shifts color per screen */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 240,
          height: 28,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, rgba(${cfg.glow},${cfg.glowA}) 0%, transparent 80%)`,
          filter: 'blur(10px)',
          transition: 'background 0.8s ease',
        }}
      />

      {/* Ambient orbs — shift color per active screen */}
      <div className="absolute pointer-events-none" style={{ top: '12%', left: '50%', transform: 'translateX(-50%)', width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(ellipse, rgba(${cfg.glow},0.13) 0%, transparent 70%)`, filter: 'blur(32px)', transition: 'background 1s ease', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ bottom: '8%', left: '50%', transform: 'translateX(-50%)', width: 220, height: 180, borderRadius: '50%', background: `radial-gradient(ellipse, rgba(${cfg.glow},0.09) 0%, transparent 70%)`, filter: 'blur(24px)', transition: 'background 1s ease', zIndex: 0 }} />

      {/* Floating chip — Refill alert (Home + Care) */}
      <div className="absolute pointer-events-none" style={{ left: 335, top: '28%', zIndex: 20 }}>
        {/* Parallax layer — floats opposite to phone tilt */}
        <div style={{ transform: `translateX(${tilt.y * -1.6}px) translateY(${tilt.x * 1.2}px)`, transition: 'transform 0.18s ease-out' }}>
          {/* Show/hide with spring entrance */}
          <div style={{
            opacity: (activeScreen === 0 || activeScreen === 2) ? 1 : 0,
            transform: `translateX(${(activeScreen === 0 || activeScreen === 2) ? '0px' : '18px'})`,
            transition: `opacity 0.3s ease, transform ${(activeScreen === 0 || activeScreen === 2) ? '0.45s cubic-bezier(0.34,1.56,0.64,1)' : '0.22s ease-in'}`,
          }}>
            <div className="animate-chip-drift rounded-2xl px-3.5 py-2.5" style={{ background: 'rgba(8,8,17,0.94)', border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(239,68,68,0.07)', backdropFilter: 'blur(16px)', minWidth: 168 }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                <span className="text-[9px] text-red-400/80 font-bold tracking-wider uppercase">Medication Alert</span>
              </div>
              <div className="text-[12px] text-white/90 font-semibold whitespace-nowrap">Lisinopril · 10mg</div>
              <div className="text-[10px] text-white/40 whitespace-nowrap mt-0.5">Refill due in 2 days</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating chip — AI replied (Chat) */}
      <div className="absolute pointer-events-none" style={{ left: 335, top: '22%', zIndex: 20 }}>
        <div style={{ transform: `translateX(${tilt.y * -1.6}px) translateY(${tilt.x * 1.2}px)`, transition: 'transform 0.18s ease-out' }}>
          <div style={{
            opacity: activeScreen === 1 ? 1 : 0,
            transform: `translateX(${activeScreen === 1 ? '0px' : '18px'})`,
            transition: `opacity 0.3s ease, transform ${activeScreen === 1 ? '0.45s cubic-bezier(0.34,1.56,0.64,1)' : '0.22s ease-in'}`,
          }}>
            <div className="animate-chip-drift rounded-2xl px-3.5 py-2.5" style={{ background: 'rgba(8,8,17,0.94)', border: '1px solid rgba(167,139,250,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(167,139,250,0.07)', backdropFilter: 'blur(16px)', minWidth: 168, animationDelay: '0.6s' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] text-white font-bold flex-shrink-0" style={{ background: 'rgba(167,139,250,0.22)' }}>AI</div>
                <span className="text-[9px] text-violet-300/80 font-bold tracking-wider uppercase">AI Response</span>
              </div>
              <div className="text-[12px] text-white/90 font-semibold whitespace-nowrap">3 questions ready</div>
              <div className="text-[10px] text-white/40 whitespace-nowrap mt-0.5">For Dr. Patel · Cardiology</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating chip — Trial match (Trials) */}
      <div className="absolute pointer-events-none" style={{ left: 335, top: '52%', zIndex: 20 }}>
        <div style={{ transform: `translateX(${tilt.y * -1.6}px) translateY(${tilt.x * 1.2}px)`, transition: 'transform 0.18s ease-out' }}>
          <div style={{
            opacity: activeScreen === 3 ? 1 : 0,
            transform: `translateX(${activeScreen === 3 ? '0px' : '18px'})`,
            transition: `opacity 0.3s ease, transform ${activeScreen === 3 ? '0.45s cubic-bezier(0.34,1.56,0.64,1)' : '0.22s ease-in'}`,
          }}>
            <div className="animate-chip-drift rounded-2xl px-3.5 py-2.5" style={{ background: 'rgba(8,8,17,0.94)', border: '1px solid rgba(52,211,153,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(52,211,153,0.07)', backdropFilter: 'blur(16px)', minWidth: 168, animationDelay: '1.1s' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="text-[9px] text-emerald-400/80 font-bold tracking-wider uppercase">Trial Match</span>
              </div>
              <div className="text-[12px] text-white/90 font-semibold whitespace-nowrap">94% — KRAS G12C</div>
              <div className="text-[10px] text-white/40 whitespace-nowrap mt-0.5">Phase 2 · Stanford Medical</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3D phone body */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `perspective(1400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.18s ease-out',
        }}
      >
        <div
          className="absolute rounded-[48px]"
          style={{
            left: 30, right: 30, top: 15, bottom: 15,
            background: 'linear-gradient(145deg, #3a3a56 0%, #252540 15%, #1e1e35 50%, #18182d 85%, #252540 100%)',
            boxShadow: `0 0 0 0.5px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4), 0 32px 80px rgba(0,0,0,0.3), 0 0 80px rgba(${cfg.glow},0.12), inset 0 1px 0 rgba(255,255,255,0.1)`,
            transition: 'box-shadow 0.7s ease',
          }}
        >
          {/* Physical buttons */}
          <div className="absolute top-[140px] w-[3px] h-[28px] rounded-l-sm" style={{ left: 27, background: 'linear-gradient(to right, #35355a, #2a2a42)' }} />
          <div className="absolute top-[178px] w-[3px] h-[28px] rounded-l-sm" style={{ left: 27, background: 'linear-gradient(to right, #35355a, #2a2a42)' }} />
          <div className="absolute top-[160px] w-[3px] h-[40px] rounded-r-sm" style={{ right: 27, background: 'linear-gradient(to left, #35355a, #2a2a42)' }} />
          <div className="absolute top-[105px] w-[3px] h-[14px] rounded-l-sm" style={{ left: 27, background: 'linear-gradient(to right, #35355a, #2a2a42)' }} />
          {/* Glass reflection */}
          <div className="absolute inset-0 rounded-[48px] pointer-events-none z-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 15%, transparent 40%)' }} />
          {/* Screen bezel */}
          <div className="absolute inset-[4px] rounded-[44px] bg-[#0C0E1A] overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.04)' }}>
            <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.04) 0%, transparent 25%)' }} />
            {/* Status bar */}
            <div className="relative z-20 flex items-center justify-between px-6 pt-3 pb-1">
              <span className="text-[10px] text-white/50 font-medium">9:41</span>
              <div className="absolute left-1/2 -translate-x-1/2 top-2">
                <div className="w-[90px] h-[18px] bg-black rounded-full flex items-center justify-center" style={{ boxShadow: 'inset 0 0 3px rgba(0,0,0,0.9)' }}>
                  <div className="w-2 h-2 rounded-full bg-[#0a0a15] border border-white/[0.05]" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 6h1v3H1zM4 4h1v5H4zM7 2h1v7H7zM10 0h1v9h-1z" fill="rgba(255,255,255,0.5)"/></svg>
                <svg width="20" height="10" viewBox="0 0 20 10" fill="none"><rect x="0.5" y="0.5" width="17" height="9" rx="2" stroke="rgba(255,255,255,0.3)"/><rect x="2" y="2" width="12" height="6" rx="1" fill="rgba(255,255,255,0.5)"/><path d="M19 3.5v3a1 1 0 000-3z" fill="rgba(255,255,255,0.3)"/></svg>
              </div>
            </div>
            {/* Screen content area */}
            <div className="absolute top-10 left-0 right-0 bottom-14 overflow-hidden" style={{ background: 'linear-gradient(180deg, #0e1025 0%, #0C0E1A 100%)' }}>
              {screens.map((screen, i) => {
                const isActive = i === activeScreen;
                return (
                  <div
                    key={isActive ? `s-${i}-${screenKey}` : `s-${i}`}
                    className="absolute inset-0 px-4 py-2"
                    style={{
                      opacity: isActive ? 1 : 0,
                      pointerEvents: isActive ? 'auto' : 'none',
                      animation: isActive ? `${direction > 0 ? 'screen-slide-forward' : 'screen-slide-back'} 0.38s cubic-bezier(0.2, 0, 0, 1) forwards` : undefined,
                    }}
                  >
                    {screen.content}
                  </div>
                );
              })}
            </div>
            {/* Tab bar */}
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#0C0E1A]/90 backdrop-blur border-t border-white/[0.06] pb-3 pt-2">
              <div className="flex justify-around items-center px-1">
                {tabIcons.map((tab) => {
                  const active = activeScreen === tab.screenIdx;
                  const tabColor = SCREEN_CONFIG[tab.screenIdx].tabColor;
                  return (
                    <div key={tab.label} className="flex flex-col items-center gap-0.5 relative">
                      <div className="relative">
                        <tab.Icon active={active} size={13} />
                      </div>
                      <span className="text-[7px] font-medium" style={{ color: active ? tabColor : 'rgba(255,255,255,0.22)' }}>{tab.label}</span>
                      {active && <div className="w-1 h-1 rounded-full transition-colors duration-500" style={{ background: tabColor }} />}
                    </div>
                  );
                })}
              </div>
              <div className="mx-auto mt-2 w-28 h-1 rounded-full bg-white/15" />
            </div>
          </div>
        </div>
      </div>

      {/* Page indicator dots */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5">
        {screens.map((s, i) => (
          <button
            key={i}
            onClick={() => { setDirection(i > activeScreen ? 1 : -1); setActiveScreen(i); setScreenKey(k => k + 1); onScreenChange?.(i); }}
            className="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
            style={{
              width: i === activeScreen ? 20 : 6,
              background: i === activeScreen ? `rgb(${SCREEN_CONFIG[i].glow})` : 'rgba(255,255,255,0.12)',
            }}
            aria-label={s.label}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Demo screens ── */
function DashboardScreen() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const o = setTimeout(() => setExpanded(true), 1500);
    const c = setTimeout(() => setExpanded(false), 3200);
    return () => { clearTimeout(o); clearTimeout(c); };
  }, []);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-white/90">CareCompanion</span>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-[7px] text-white font-bold">AM</div>
      </div>
      <div className="mb-0.5">
        <div className="text-[8px] text-[#94a3b8] uppercase tracking-wider">Good afternoon</div>
        <div className="text-[13px] font-bold text-white/90">3 items need attention</div>
      </div>
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
        <div className="overflow-hidden transition-all duration-500" style={{ maxHeight: expanded ? '120px' : '0px', opacity: expanded ? 1 : 0 }}>
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
    const o = setTimeout(() => setExpanded(true), 1200);
    const c = setTimeout(() => setExpanded(false), 3200);
    return () => { clearTimeout(o); clearTimeout(c); };
  }, []);
  return (
    <div className="space-y-2">
      <div className="flex gap-0.5 bg-[#10122B] rounded-[10px] p-[2px] border border-white/[0.04]">
        <div className="flex-1 text-center text-[9px] py-1.5 rounded-[8px] bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white font-semibold">Medications</div>
        <div className="flex-1 text-center text-[9px] py-1.5 text-white/30 font-medium">Appointments</div>
        <div className="flex-1 text-center text-[9px] py-1.5 text-white/30 font-medium">Conflicts</div>
      </div>
      <div className="text-[7px] text-red-400 uppercase tracking-wider font-semibold">Needs Refill</div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2">
        <div className="flex items-center justify-between">
          <div><div className="text-[10px] text-white/85 font-semibold">Lisinopril</div><div className="text-[8px] text-white/40">10mg · Once daily</div></div>
          <span className="text-[10px] text-white/20">▸</span>
        </div>
      </div>
      <div className="text-[7px] text-white/30 uppercase tracking-wider">Active Medications</div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2">
        <div className="flex items-center justify-between">
          <div><div className="text-[10px] text-white/85 font-semibold">Metformin</div><div className="text-[8px] text-white/40">500mg · Twice daily</div></div>
          <span className={`text-[10px] text-white/30 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}>▸</span>
        </div>
        <div className="overflow-hidden transition-all duration-500" style={{ maxHeight: expanded ? '120px' : '0px', opacity: expanded ? 1 : 0 }}>
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <div className="grid grid-cols-2 gap-1 text-[7px] mb-2">
              <div><span className="text-white/30">Doctor:</span> <span className="text-white/70">Dr. Chen</span></div>
              <div><span className="text-white/30">Refill:</span> <span className="text-white/70">Apr 15</span></div>
              <div><span className="text-white/30">Remaining:</span> <span className="text-white/70">28 pills</span></div>
              <div><span className="text-white/30">Frequency:</span> <span className="text-white/70">Twice daily</span></div>
            </div>
            <div className="flex gap-1.5">
              <div className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-md py-1 text-center"><span className="text-[7px] text-white/70 font-medium">Edit</span></div>
              <div className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-md py-1 text-center"><span className="text-[7px] text-[#ef4444] font-medium">Delete</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2">
        <div className="flex items-center justify-between">
          <div><div className="text-[10px] text-white/85 font-semibold">Atorvastatin</div><div className="text-[8px] text-white/40">20mg · Once daily</div></div>
          <span className="text-[10px] text-white/20">▸</span>
        </div>
      </div>
      <div className="bg-gradient-to-r from-[#6366F1] to-[#A78BFA] rounded-xl py-1.5 text-center">
        <span className="text-[9px] text-white font-semibold">+ Add Medication</span>
      </div>
    </div>
  );
}

function ChatScreen() {
  const userMsg = 'What should I ask Dr. Patel about my blood pressure?';
  const aiLines = ['Here are 3 questions for your visit:', '', '1. Should we adjust my Lisinopril dose given my recent readings?', '2. How often should I check my BP at home?', '3. Are there lifestyle changes to try before adding medication?'];
  const [phase, setPhase] = useState<'user-typing' | 'thinking' | 'ai-typing' | 'done'>('user-typing');
  const [userChars, setUserChars] = useState(0);
  const [aiChars, setAiChars] = useState(0);
  const fullAiText = aiLines.join('\n');

  useEffect(() => {
    if (phase !== 'user-typing') return;
    if (userChars >= userMsg.length) { const t = setTimeout(() => setPhase('thinking'), 400); return () => clearTimeout(t); }
    const t = setTimeout(() => setUserChars((c) => c + 1), 28);
    return () => clearTimeout(t);
  }, [phase, userChars]);

  useEffect(() => {
    if (phase !== 'thinking') return;
    const t = setTimeout(() => setPhase('ai-typing'), 1200);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'ai-typing') return;
    if (aiChars >= fullAiText.length) { const t = setTimeout(() => setPhase('done'), 1500); return () => clearTimeout(t); }
    const t = setTimeout(() => setAiChars((c) => c + 1), 18);
    return () => clearTimeout(t);
  }, [phase, aiChars, fullAiText.length]);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(() => { setPhase('user-typing'); setUserChars(0); setAiChars(0); }, 2500);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-[6px] text-white font-bold flex-shrink-0">AI</div>
        <span className="text-[10px] text-white/70 font-semibold">CareCompanion Chat</span>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        {userChars > 0 && (
          <div className="flex justify-end">
            <div className="bg-gradient-to-br from-[#6366F1] to-[#A78BFA] rounded-2xl rounded-tr-sm px-2.5 py-1.5 max-w-[85%]">
              <div className="text-[9px] text-white leading-relaxed">
                {userMsg.slice(0, userChars)}
                {phase === 'user-typing' && <span className="inline-block w-[3px] h-[9px] bg-white/70 ml-[1px] animate-pulse align-middle" />}
              </div>
            </div>
          </div>
        )}
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
        <svg width="12" height="12" fill="none" stroke="#67E8F9" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="3" x2="9" y2="9" /></svg>
        <span className="text-[10px] text-[#67E8F9] font-semibold">Scan Results</span>
      </div>
      <div className="relative bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 space-y-2 overflow-hidden">
        {/* Scan line sweeping through the document */}
        <div
          className="animate-scan-sweep absolute left-0 right-0 pointer-events-none"
          style={{
            top: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, rgba(103,232,249,0.0) 10%, rgba(103,232,249,0.7) 50%, rgba(103,232,249,0.0) 90%, transparent 100%)',
            boxShadow: '0 0 8px rgba(103,232,249,0.5), 0 0 16px rgba(103,232,249,0.2)',
            zIndex: 10,
          }}
        />
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-lg bg-[#6366F1]/15 flex items-center justify-center">
            <svg width="10" height="10" fill="none" stroke="#818CF8" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div><div className="text-[9px] text-white/70 font-medium">Lab Report Detected</div><div className="text-[7px] text-white/30">Extracted 3 values</div></div>
        </div>
        <div className="space-y-1.5">
          {[{ name: 'Blood Pressure', value: '142/88', flag: true }, { name: 'LDL Cholesterol', value: '165 mg/dL', flag: true }, { name: 'A1C', value: '7.2%', flag: true }].map((lab) => (
            <div key={lab.name} className="flex items-center justify-between py-0.5">
              <span className="text-[8px] text-white/50">{lab.name}</span>
              <div className="flex items-center gap-1">
                <span className={`text-[8px] font-medium ${lab.flag ? 'text-[#ef4444]' : 'text-emerald-400'}`}>{lab.value}</span>
                {lab.flag && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
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

function TrialsScreen() {
  const [show, setShow] = useState(false);
  const [activeTab, setActiveTab] = useState<'matched' | 'close'>('matched');

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 480);
    return () => clearTimeout(t);
  }, []);

  const trials = [
    { name: 'KRAS G12C Inhibitor', phase: 'Phase 2', site: 'Stanford Medical', match: 94, delay: 0 },
    { name: 'Pembrolizumab Combo', phase: 'Phase 3', site: 'UCSF Diller', match: 78, missing: 'PD-L1 biopsy needed', delay: 180 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <svg width="11" height="11" fill="none" stroke="#34D399" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21a48.309 48.309 0 01-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
        <span className="text-[10px] text-[#34D399] font-semibold">Clinical Trials</span>
        <div className="ml-auto flex items-center gap-0.5 rounded-full px-1.5 py-0.5" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}>
          <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[7px] text-emerald-400 font-medium">Matching</span>
        </div>
      </div>
      <div className="flex gap-0.5 rounded-[10px] p-[2px]" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.08)' }}>
        {(['matched', 'close'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 text-center text-[9px] py-1.5 rounded-[8px] font-semibold transition-all"
            style={{
              background: activeTab === tab ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: activeTab === tab ? '#34D399' : 'rgba(255,255,255,0.25)',
              border: activeTab === tab ? '1px solid rgba(52,211,153,0.2)' : '1px solid transparent',
            }}
          >
            {tab === 'matched' ? 'Matched (2)' : 'Close (5)'}
          </button>
        ))}
      </div>
      {trials.map((trial) => (
        <div
          key={trial.name}
          className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5"
          style={{
            opacity: show ? 1 : 0,
            transform: show ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 0.45s ease ${trial.delay}ms, transform 0.45s ease ${trial.delay}ms`,
          }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[7px] font-bold text-emerald-400 tracking-wider uppercase mb-0.5">{trial.phase}</div>
              <div className="text-[10px] text-white/90 font-semibold leading-snug">{trial.name}</div>
              <div className="text-[8px] text-white/35 mt-0.5">{trial.site}</div>
            </div>
            <div className="flex-shrink-0 mt-0.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: `conic-gradient(#34D399 ${trial.match * 3.6}deg, rgba(255,255,255,0.05) 0deg)` }}
              >
                <div className="w-[26px] h-[26px] rounded-full bg-[#0C0E1A] flex items-center justify-center">
                  <span className="text-[8px] text-emerald-400 font-bold">{trial.match}%</span>
                </div>
              </div>
            </div>
          </div>
          {trial.missing && (
            <div className="mt-1.5 flex items-center gap-1 rounded-lg px-1.5 py-1" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span className="text-[7px] text-amber-400/80 font-medium">{trial.missing}</span>
            </div>
          )}
        </div>
      ))}
      <div className="rounded-xl py-1.5 text-center" style={{ background: 'rgba(10,26,16,0.7)', border: '1px solid rgba(52,211,153,0.14)' }}>
        <span className="text-[9px] text-emerald-400 font-semibold">View 12 more trials →</span>
      </div>
    </div>
  );
}

/* ── Animated stat counter ── */
/* ── Main page ── */
export default function LandingPage() {
  useScrollReveal();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [heroScreen, setHeroScreen] = useState(0);
  const compSectionRef = useRef<HTMLDivElement>(null);
  const [compProgress, setCompProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      if (mobileMenuOpen) setMobileMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = compSectionRef.current;
    if (!el) return;
    if (reduced) { setCompProgress(1); return; }
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when section bottom enters viewport, 1 when section top hits 15% from top
      const p = (vh - rect.top) / (vh * 0.85);
      setCompProgress(Math.max(0, Math.min(1, p)));
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  const flyP = easeOut(Math.min(1, compProgress / 0.7));
  const dimP = easeOut(Math.max(0, (compProgress - 0.7) / 0.3));

  const withoutAnimStyle: React.CSSProperties = {
    opacity: flyP,
    filter: `saturate(${1 - dimP * 0.6})`,
    transform: `translateX(${(1 - flyP) * -80}px)`,
    willChange: 'transform, opacity, filter',
  };
  const withAnimStyle: React.CSSProperties = {
    opacity: flyP,
    transform: `translateX(${(1 - flyP) * 80}px)`,
    boxShadow: dimP > 0.05 ? `0 0 0 1px rgba(139,92,246,${0.08 + dimP * 0.22}), 0 0 ${Math.round(16 + 40 * dimP)}px rgba(139,92,246,${0.04 + dimP * 0.1})` : undefined,
    border: `1px solid rgba(139,92,246,${0.14 + dimP * 0.22})`,
    willChange: 'transform, opacity, box-shadow',
  };

  const features = [
    { id: 0, badge: 'Treatment', color: '#818CF8', title: 'Treatment Tracker', desc: 'Chemo cycles, tumor markers, and blood counts — surfaced automatically and always current. Never lose track of where you are in treatment.', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
    { id: 1, badge: 'Trials', color: '#34D399', title: 'Find Your Trial', desc: 'CareCompanion matches your loved one\'s cancer type, stage, and mutations against thousands of active clinical trials — and tells you exactly what\'s missing to qualify.', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21a48.309 48.309 0 01-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg> },
    { id: 2, badge: 'AI Chat', color: '#A78BFA', title: 'Oncology AI', desc: 'Ask anything about chemo side effects, tumor markers, or treatment options. Get clear, plain-language answers grounded in your actual records.', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg> },
    { id: 3, badge: 'Care Team', color: '#F472B6', title: 'Care Team', desc: 'One shared dashboard for your whole care team. Family caregivers, nurses, and oncologists stay aligned without endless phone calls.', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg> },
  ];

  const stats: { value: React.ReactNode; label: string }[] = [
    { value: '50+', label: 'Chemo drugs tracked' },
    { value: '200+', label: 'Oncology visits managed' },
    {
      value: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#FF375F" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ),
      label: 'Works with Apple Health',
    },
    { value: '5 min', label: 'Setup time' },
  ];

  return (
    <main className="min-h-screen bg-[#080A14] overflow-x-hidden text-white">

      {/* ── Navigation ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#080A14]/95 backdrop-blur-xl border-b border-white/[0.07]' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="font-display font-bold text-white text-lg tracking-tight">CareCompanion</span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-white/50 hover:text-white transition-colors cursor-pointer">Features</button>
            <Link href="/about" className="text-sm text-white/50 hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="text-sm text-white/50 hover:text-white transition-colors">Contact</Link>
            <Link href="/privacy" className="text-sm text-white/50 hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="text-sm text-white/50 hover:text-white transition-colors">Terms</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login?mode=signin" className="hidden md:inline-block px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">Log In</Link>
            <Link href="/login" className="hidden md:inline-block px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-600/20">Get Started</Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer">
              <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />}
              </svg>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.07] bg-[#080A14]/98 backdrop-blur-xl">
            <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1">
              <button onClick={() => { setMobileMenuOpen(false); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-left text-sm text-white/60 hover:text-white py-2.5 cursor-pointer">Features</button>
              <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">About</Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">Contact</Link>
              <Link href="/privacy" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">Privacy</Link>
              <Link href="/terms" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">Terms</Link>
              <div className="border-t border-white/[0.07] pt-3 mt-2 flex flex-col gap-2">
                <Link href="/login?mode=signin" className="w-full text-center py-3 rounded-lg border border-white/[0.10] text-sm font-medium text-white/70">Log In</Link>
                <Link href="/login" className="w-full text-center py-3 rounded-lg bg-violet-600 text-white text-sm font-semibold">Get Started</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ════════════════════════════════════════
          SECTION 1 — HERO
          Full viewport. Headline + CTAs on left,
          phone on right. Stats bar at bottom.
      ════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-24 right-0 w-px h-64 bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />
          <div className="absolute bottom-32 left-0 w-px h-48 bg-gradient-to-b from-transparent via-white/[0.04] to-transparent" />
          {/* Ambient bleed — shifts color with active phone screen */}
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 55% 60% at 72% 45%, rgba(${SCREEN_CONFIG[heroScreen].glow},0.045) 0%, transparent 68%)`, transition: 'background 1.4s ease' }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 w-full relative">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-20">

            {/* Left: text */}
            <div className="flex-1 min-w-0 text-center lg:text-left order-2 lg:order-1">
              <h1 className="font-display text-5xl sm:text-6xl lg:text-[4.5rem] font-bold leading-[1.06] tracking-tight mb-6 animate-fade-in-up">
                <span className="text-white">Cancer care,</span><br />
                <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent">finally in one place</span>
              </h1>

              <p className="text-white/50 text-xl max-w-lg mx-auto lg:mx-0 mb-9 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.12s' }}>
                Stop juggling 5 apps for <CyclingWord />. CareCompanion brings your medications, appointments, lab results, and care team into one place.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start animate-fade-in-up" style={{ animationDelay: '0.22s' }}>
                <Link href="/login" className="px-8 py-4 rounded-xl bg-violet-600 text-white font-semibold text-base hover:bg-violet-500 transition-colors shadow-xl shadow-violet-600/25">
                  Get started free
                </Link>
                <DemoButton />
              </div>

              {/* Stats — 4 numbers under CTAs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-10 pt-10 border-t border-white/[0.07] animate-fade-in-up" style={{ animationDelay: '0.32s' }}>
                {stats.map((s, i) => (
                  <div key={i} className="text-center lg:text-left">
                    <div className="font-display font-bold text-3xl text-white mb-1">{s.value}</div>
                    <div className="text-white/35 text-xs leading-snug">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: phone — visible beside text on desktop, hidden on mobile to keep hero text above the fold */}
            <div className="hidden lg:block flex-shrink-0 order-1 lg:order-2 animate-phone-rise" style={{ animationDelay: '0.08s' }}>
              <PhoneMockup onScreenChange={setHeroScreen} />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-fade-in transition-opacity duration-500 ${scrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={{ animationDelay: '1s' }}>
          <span className="text-[10px] text-white/30 tracking-[0.2em] uppercase font-medium">Scroll to explore</span>
          {/* Mouse outline with scrolling dot */}
          <div className="relative w-6 h-9 rounded-full border-2 border-white/20 flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDuration: '1.4s' }} />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECTION 2 — FEATURE EXPLORER
          Interactive. Click a tab, see detail.
      ════════════════════════════════════════ */}
      <section id="features" className="pt-28 pb-14 px-6 bg-[#080A14]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-start gap-4 scroll-reveal">

            {/* Feature tabs */}
            <div className="w-full lg:w-72 flex flex-row lg:flex-col gap-3 flex-shrink-0">
              <div className="mb-2 hidden lg:block">
                <p className="text-violet-400 text-xs font-bold tracking-widest uppercase mb-2">What it does</p>
                <h2 className="font-display text-3xl font-bold text-white leading-tight">Everything.<br />Nothing extra.</h2>
              </div>
              {features.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFeature(i)}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer w-full ${activeFeature === i ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.10]'}`}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${f.color}18`, color: f.color }}>{f.icon}</div>
                  <div>
                    <div className="font-display font-semibold text-white text-sm">{f.title}</div>
                    <div className="text-[11px] font-semibold tracking-wider uppercase mt-0.5" style={{ color: f.color }}>{f.badge}</div>
                  </div>
                  {activeFeature === i && <div className="ml-auto w-1 h-5 rounded-full" style={{ background: f.color }} />}
                </button>
              ))}
            </div>

            {/* Detail panel */}
            <div className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden" style={{ minHeight: 380 }}>
              {features.map((f, i) => (
                <div key={f.id} className={`p-10 h-full transition-all duration-300 ${activeFeature === i ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                  {/* Top accent line */}
                  <div className="w-full h-px mb-10 rounded-full" style={{ background: `linear-gradient(90deg, ${f.color}60, transparent)` }} />
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-7" style={{ background: `${f.color}15`, color: f.color }}>
                    <div className="w-8 h-8">{f.icon}</div>
                  </div>
                  <div className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: f.color }}>{f.badge}</div>
                  <h3 className="font-display font-bold text-white text-4xl mb-5">{f.title}</h3>
                  <p className="text-white/55 text-lg leading-relaxed max-w-lg">{f.desc}</p>
                  <Link href="/login" className="inline-flex items-center gap-2 mt-8 text-sm font-semibold transition-colors" style={{ color: f.color }}>
                    Try it free
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECTION 3 — BEFORE / AFTER (scroll-driven)
      ════════════════════════════════════════ */}
      <section
        ref={compSectionRef}
        style={{ background: 'linear-gradient(180deg, #080A14 0%, #0C0A1A 100%)' }}
      >
          <div className="max-w-5xl mx-auto px-6 w-full py-24">
            <div className="text-center mb-12">
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">Why families choose CareCompanion</h2>
              <p className="text-white/35 text-lg">One app. Zero juggling.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Without — dims and desaturates as you scroll through */}
              <div
                className="rounded-2xl border border-red-500/[0.12] overflow-hidden"
                style={{ background: '#0f0809', ...withoutAnimStyle }}
              >
                <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-red-500/[0.08]" style={{ background: 'rgba(239,68,68,0.04)' }}>
                  <div className="w-5 h-5 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <span className="font-semibold text-red-400/80 text-xs tracking-wide uppercase">Without CareCompanion</span>
                </div>
                <div className="divide-y divide-red-500/[0.06]">
                  {[
                    { bold: '5 separate apps', detail: 'chemo, meds, labs, notes, and appointments' },
                    { bold: 'No cycle tracking', detail: "no idea which day you're on" },
                    { bold: 'Forgotten conversations', detail: "can't recall what the oncologist said" },
                    { bold: 'Caregivers out of the loop', detail: 'family always behind on updates' },
                    { bold: 'Lab results are cryptic', detail: 'tumor markers and blood counts make no sense' },
                    { bold: 'No warning for side effects', detail: "don't know if what you feel is normal" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(239,68,68,0.08)' }}>
                        <svg className="w-2.5 h-2.5 text-red-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                      <div className="min-w-0">
                        <span className="text-white/55 text-sm font-medium">{item.bold}</span>
                        <span className="text-white/25 text-sm"> — {item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* With — slides in and glows as you scroll through */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: '#09090f', ...withAnimStyle }}
              >
                <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-violet-500/[0.08]" style={{ background: 'rgba(139,92,246,0.05)' }}>
                  <div className="w-5 h-5 rounded-md bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  </div>
                  <span className="font-semibold text-violet-300/80 text-xs tracking-wide uppercase">With CareCompanion</span>
                </div>
                <div className="divide-y divide-violet-500/[0.06]">
                  {[
                    { bold: 'Everything in one place', detail: 'treatment, meds, labs, notes, care team' },
                    { bold: 'Always know your cycle day', detail: 'treatment tracker, cycle by cycle' },
                    { bold: 'Never forget a conversation', detail: 'what your oncologist said, recalled instantly' },
                    { bold: 'Care team stays aligned', detail: 'shared dashboard, real-time updates' },
                    { bold: 'Lab results in plain English', detail: 'explained simply, flagged when it matters' },
                    { bold: 'Know what to expect', detail: 'every chemo day, no surprises' },
                    { bold: 'Clinical trial matching', detail: 'matches your loved one automatically' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-5 py-3.5"
                      style={{
                        opacity: Math.min(1, Math.max(0, flyP * 1.4 - i * 0.1)),
                        transform: `translateY(${Math.max(0, (1 - flyP) * (6 + i * 2))}px)`,
                      }}
                    >
                      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(139,92,246,0.1)' }}>
                        <svg className="w-2.5 h-2.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      </div>
                      <div className="min-w-0">
                        <span className="text-white/80 text-sm font-medium">{item.bold}</span>
                        <span className="text-white/35 text-sm"> — {item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 text-center">
              <Link href="/login" className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-white/85 font-semibold text-base transition-colors" style={{ background: '#2a1f4e', boxShadow: 'none' }} onMouseEnter={e => (e.currentTarget.style.background = '#332560')} onMouseLeave={e => (e.currentTarget.style.background = '#2a1f4e')}>
                Get started free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
              <p className="text-white/25 text-sm mt-4">No credit card. No setup fee. 5 minutes to get started.</p>
            </div>
          </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-10 px-6" style={{ background: '#05060F' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="text-white/60 font-display font-semibold text-sm">CareCompanion</span>
          </div>
          <div className="flex items-center gap-6 text-white/30 text-sm">
            <Link href="/about" className="hover:text-white/60 transition-colors">About</Link>
            <Link href="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
          </div>
          <p className="text-white/20 text-xs">© 2026 CareCompanion. Your data stays yours.</p>
        </div>
      </footer>
    </main>
  );
}
