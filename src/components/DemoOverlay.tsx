'use client';

import { useState, useEffect, useCallback } from 'react';

const DEMO_STEPS = [
  {
    title: 'Your cancer care dashboard',
    description: 'See urgent refills, upcoming appointments, and abnormal labs — all in one glance.',
    mockup: 'dashboard',
  },
  {
    title: 'AI that knows your treatment',
    description: 'Ask anything about chemo side effects, tumor markers, or drug interactions. It knows your meds.',
    mockup: 'chat',
  },
  {
    title: 'Track every medication',
    description: 'Chemo drugs, anti-nausea, blood pressure — with refill alerts and dose reminders.',
    mockup: 'medications',
  },
  {
    title: 'Lab trends at a glance',
    description: 'WBC, hemoglobin, tumor markers — see trends, get flagged on abnormals, prep for visits.',
    mockup: 'labs',
  },
  {
    title: 'Connect your health records',
    description: '700+ hospitals via 1upHealth. MyChart, Kaiser, Sutter — auto-syncs everything.',
    mockup: 'connect',
  },
];

/* ── Typing text component ── */
function TypingText({ text, speed = 35 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="animate-pulse text-[#A78BFA]/60">|</span>
      )}
    </span>
  );
}

/* ── Mock phone screens ── */
function MockScreen({ type }: { type: string }) {
  const screens: Record<string, React.ReactNode> = {
    dashboard: (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Good afternoon</p>
            <p className="text-sm font-bold text-white">Looking good, Mom!</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-violet-500/30 flex items-center justify-center text-[10px] text-violet-300 font-bold">AM</div>
        </div>
        <div className="flex gap-1.5 mb-3">
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">Breast — Stage III</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Active Treatment</span>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[9px] font-bold text-red-400 uppercase">Urgent</span>
          </div>
          <p className="text-[11px] text-white font-medium">Lisinopril refill due tomorrow</p>
          <p className="text-[9px] text-white/40">3 pills remaining · Dr. Patel</p>
        </div>
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[9px] font-bold text-blue-400 uppercase">Upcoming</span>
          </div>
          <p className="text-[11px] text-white font-medium">Dr. Chen — Oncology</p>
          <p className="text-[9px] text-white/40">Tomorrow at 10:00 AM</p>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[9px] font-bold text-amber-400 uppercase">Alert</span>
          </div>
          <p className="text-[11px] text-white font-medium">WBC — 3.2 K/uL</p>
          <p className="text-[9px] text-white/40">Below normal (4.5-11.0)</p>
        </div>
      </div>
    ),
    chat: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center">
            <svg className="w-3 h-3 text-violet-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
          </div>
          <p className="text-xs font-semibold text-white">CareCompanion AI</p>
        </div>
        <div className="ml-auto max-w-[80%] rounded-xl rounded-br-sm bg-violet-500/30 p-2.5">
          <p className="text-[11px] text-white">What side effects should I watch for with Herceptin?</p>
        </div>
        <div className="max-w-[85%] rounded-xl rounded-bl-sm bg-white/[0.06] p-2.5">
          <p className="text-[11px] text-white/80 leading-relaxed">Since Mom is on <strong className="text-white">Herceptin + Taxotere</strong>, watch for:</p>
          <ul className="text-[10px] text-white/60 mt-1.5 space-y-1 ml-2">
            <li>• Cardiac changes (echo every 3 months)</li>
            <li>• Fever over 100.4°F → call oncology</li>
            <li>• Fatigue, nausea (Zofran helps)</li>
          </ul>
          <p className="text-[9px] text-violet-300/60 mt-2 italic">Based on Mom&apos;s current medications</p>
        </div>
      </div>
    ),
    medications: (
      <div className="space-y-3">
        <p className="text-xs font-bold text-white mb-3">Medications <span className="text-white/40 font-normal">· 6 tracked</span></p>
        {[
          { name: 'Trastuzumab (Herceptin)', dose: '440mg IV', freq: 'Every 3 weeks', urgent: false },
          { name: 'Ondansetron (Zofran)', dose: '8mg', freq: 'As needed', urgent: true },
          { name: 'Lisinopril', dose: '10mg', freq: 'Daily', urgent: true },
          { name: 'Tamoxifen', dose: '20mg', freq: 'Daily', urgent: false },
        ].map((med) => (
          <div key={med.name} className={`rounded-lg p-2.5 border ${med.urgent ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-white font-medium">{med.name}</p>
              {med.urgent && <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
            </div>
            <p className="text-[9px] text-white/40">{med.dose} · {med.freq}</p>
          </div>
        ))}
      </div>
    ),
    labs: (
      <div className="space-y-3">
        <p className="text-xs font-bold text-white mb-3">Lab Results</p>
        {[
          { name: 'WBC', value: '3.2', unit: 'K/uL', range: '4.5-11.0', abnormal: true, trend: '↓' },
          { name: 'Hemoglobin', value: '11.2', unit: 'g/dL', range: '12.0-16.0', abnormal: true, trend: '↓' },
          { name: 'HER2/neu', value: '15.8', unit: 'ng/mL', range: '<15.0', abnormal: true, trend: '↑' },
          { name: 'Creatinine', value: '0.9', unit: 'mg/dL', range: '0.6-1.2', abnormal: false, trend: '→' },
        ].map((lab) => (
          <div key={lab.name} className={`rounded-lg p-2.5 border ${lab.abnormal ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-white font-medium">{lab.name}</p>
              <span className={`text-[10px] font-mono ${lab.abnormal ? 'text-amber-400' : 'text-emerald-400'}`}>{lab.trend} {lab.value} {lab.unit}</span>
            </div>
            <p className="text-[9px] text-white/40">Normal: {lab.range}</p>
          </div>
        ))}
        <div className="h-12 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <div className="flex items-end gap-[3px] h-6">
            {[3, 5, 4, 6, 3, 4, 3].map((h, i) => (
              <div key={i} className="w-[6px] rounded-sm bg-violet-500/40" style={{ height: `${h * 4}px` }} />
            ))}
          </div>
          <span className="text-[8px] text-white/30 ml-2">7-day trend</span>
        </div>
      </div>
    ),
    connect: (
      <div className="space-y-3">
        <p className="text-xs font-bold text-white mb-3">Connect Records</p>
        <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3 text-center">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center mx-auto mb-2">
            <svg className="w-4 h-4 text-violet-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
          </div>
          <p className="text-[11px] text-white font-medium">700+ health systems</p>
          <p className="text-[9px] text-white/40 mt-0.5">MyChart, Kaiser, Sutter, Aetna</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {['Medications', 'Lab results', 'Conditions', 'Allergies', 'Appointments', 'Doctors', 'Claims', 'Insurance'].map((item) => (
            <div key={item} className="flex items-center gap-1.5 text-[9px] text-white/60 py-1 px-2 rounded bg-white/[0.03] border border-white/[0.04]">
              <span className="text-emerald-400">✓</span> {item}
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-[10px] text-emerald-300 font-medium">Auto-syncs every 24 hours</p>
        </div>
      </div>
    ),
  };

  return (
    <div className="w-[240px] sm:w-[280px] mx-auto">
      {/* Phone frame */}
      <div className="relative rounded-[28px] border-2 border-white/[0.12] bg-[#0a0a14] p-3 pt-8 shadow-2xl shadow-violet-500/10">
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full bg-black border border-white/[0.08]" />
        {/* Screen content */}
        <div className="rounded-xl bg-[#0d0d1a] p-3 min-h-[340px] sm:min-h-[380px] overflow-hidden">
          <div className="animate-fade-in-up">{screens[type]}</div>
        </div>
        {/* Home indicator */}
        <div className="mt-2 mx-auto w-24 h-1 rounded-full bg-white/[0.15]" />
      </div>
    </div>
  );
}

/* ── Progress bar ── */
function ProgressBar({ current, total, progress }: { current: number; total: number; progress: number }) {
  return (
    <div className="flex gap-1.5 w-full max-w-xs mx-auto">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#A78BFA] transition-all duration-100"
            style={{ width: i < current ? '100%' : i === current ? `${progress}%` : '0%' }}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Main overlay ── */
interface DemoOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DemoOverlay({ isOpen, onClose }: DemoOverlayProps) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const STEP_DURATION = 7000; // 7 seconds per step

  const nextStep = useCallback(() => {
    if (step < DEMO_STEPS.length - 1) {
      setStep((s) => s + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [step, onClose]);

  const prevStep = useCallback(() => {
    if (step > 0) {
      setStep((s) => s - 1);
      setProgress(0);
    }
  }, [step]);

  // Auto-advance timer
  useEffect(() => {
    if (!isOpen) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          nextStep();
          return 0;
        }
        return p + (100 / (STEP_DURATION / 50));
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isOpen, step, nextStep]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setProgress(0);
    }
  }, [isOpen]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextStep(); }
      if (e.key === 'ArrowLeft') prevStep();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, nextStep, prevStep, onClose]);

  if (!isOpen) return null;

  const currentStep = DEMO_STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] bg-[#07071a]/98 backdrop-blur-xl flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 sm:top-8 sm:right-8 w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.1] transition-all z-10"
        aria-label="Close demo"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Step counter */}
      <div className="absolute top-5 left-5 sm:top-8 sm:left-8 text-[11px] text-white/30 font-mono">
        {step + 1} / {DEMO_STEPS.length}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-4xl w-full gap-8">
        {/* Title with typing effect */}
        <div className="text-center space-y-3" key={step}>
          <h2 className="text-2xl sm:text-4xl font-bold text-white animate-fade-in-up">
            {currentStep.title}
          </h2>
          <p className="text-sm sm:text-lg text-white/50 max-w-md mx-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <TypingText text={currentStep.description} speed={25} />
          </p>
        </div>

        {/* Phone mockup */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }} key={`phone-${step}`}>
          <MockScreen type={currentStep.mockup} />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="w-full px-6 pb-8 pt-4 space-y-4">
        {/* Progress bar */}
        <ProgressBar current={step} total={DEMO_STEPS.length} progress={progress} />

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevStep}
            disabled={step === 0}
            className="text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:hover:text-white/40 transition-colors px-3 py-1.5"
          >
            ← Back
          </button>
          <button
            onClick={nextStep}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white font-semibold text-sm shadow-lg shadow-[#6366F1]/25 hover:shadow-[#6366F1]/40 transition-shadow"
          >
            {step < DEMO_STEPS.length - 1 ? 'Next' : 'Get Started'}
          </button>
          <button
            onClick={onClose}
            className="text-xs text-white/40 hover:text-white transition-colors px-3 py-1.5"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
