'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { useCsrfToken } from '@/components/CsrfProvider';

function getCsrfToken(): string {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('cc-csrf-token='))
    ?.split('=')[1] ?? '';
}

interface ExistingProfile {
  id: string;
  cancer_type?: string | null;
  cancer_stage?: string | null;
  treatment_phase?: string | null;
  relationship?: string | null;
  patient_name?: string | null;
  patient_age?: number | null;
  onboarding_priorities?: string[] | null;
}

interface OnboardingWizardProps {
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  existingProfileId: string | null;
  existingProfile?: ExistingProfile | null;
}

interface SimpleMed {
  name: string;
  dose: string;
}

interface SimpleDoc {
  name: string;
  specialty: string;
}

interface SimpleAppt {
  doctor_name: string;
  date_time: string;
}

const CANCER_TYPES = [
  'Breast',
  'Lung',
  'Colorectal',
  'Prostate',
  'Lymphoma',
  'Leukemia',
  'Melanoma',
  'Ovarian',
  'Pancreatic',
  'Thyroid',
  'Bladder',
  'Brain',
  'Other',
];

const CANCER_TIPS: Record<string, string> = {
  Breast: 'We can help track hormone therapy schedules and mammogram follow-ups.',
  Lung: 'Track breathing exercises and pulmonary function results.',
  Colorectal: 'Monitor CEA tumor markers and colonoscopy schedules.',
  Prostate: 'Track PSA levels and treatment side effects.',
  Lymphoma: 'Monitor blood counts and infusion schedules.',
  Leukemia: 'Monitor blood counts and infusion schedules.',
};

const TREATMENT_PHASES = [
  { value: 'just_diagnosed', label: 'Just diagnosed', color: '#60A5FA', svgPath: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z', desc: 'Learning about options' },
  { value: 'active_treatment', label: 'Active treatment', color: '#A78BFA', svgPath: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', desc: 'Chemo, radiation, or surgery' },
  { value: 'between_treatments', label: 'Between treatments', color: '#FB923C', svgPath: 'M15.75 5.25v13.5m-7.5-13.5v13.5', desc: 'Resting between cycles' },
  { value: 'remission', label: 'In remission', color: '#34D399', svgPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', desc: 'Monitoring and follow-ups' },
  { value: 'unsure', label: 'Not sure yet', color: '#94A3B8', svgPath: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z', desc: 'Still figuring things out' },
];

const PRIORITIES = [
  { value: 'side_effects', label: 'Tracking side effects', color: '#F472B6', svgPath: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z', desc: 'Log symptoms and side effects daily' },
  { value: 'medications', label: 'Managing medications', color: '#A78BFA', svgPath: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', desc: 'Track meds, refills, and schedules' },
  { value: 'appointments', label: 'Preparing for appointments', color: '#60A5FA', svgPath: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5', desc: 'Questions, notes, and reminders' },
  { value: 'lab_results', label: 'Understanding lab results', color: '#34D399', svgPath: 'M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5', desc: 'CBC, tumor markers, and more' },
  { value: 'insurance', label: 'Insurance & billing help', color: '#FB923C', svgPath: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z', desc: 'Claims, prior auths, and costs' },
  { value: 'emotional', label: 'Emotional support', color: '#F472B6', svgPath: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z', desc: 'Resources and coping strategies' },
];

const STEP_LABELS = ['About you', 'Diagnosis', 'Your data', 'Details', 'Priorities', 'All set'];
const TOTAL_STEPS = 6;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function OnboardingWizard({ userName, userEmail, userAvatar, existingProfileId, existingProfile }: OnboardingWizardProps) {
  const router = useRouter();
  const csrfTokenFromContext = useCsrfToken();

  // Read the CSRF token synchronously from cookie at call time — avoids the
  // useEffect race condition where csrfToken state is '' on first renders.
  const getCsrfToken = (): string => {
    if (typeof document === 'undefined') return csrfTokenFromContext;
    const match = document.cookie.match(/(^| )cc-csrf-token=([^;]+)/);
    return match ? match[2] : csrfTokenFromContext;
  };

  const getInitialStep = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('onboarding_step');
      if (saved === '5') {
        localStorage.removeItem('onboarding_step');
        return 5;
      }
      // Legacy: handle old step 4 saves
      if (saved === '4') {
        localStorage.removeItem('onboarding_step');
        return 5;
      }
    }
    return 1;
  };

  const [step, setStep] = useState(() => {
    const initial = getInitialStep();
    // Show intro animation for fresh onboarding (step 1, no existing profile data)
    return initial === 1 && !existingProfile?.cancer_type ? 0 : initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  const [animKey, setAnimKey] = useState(0);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  // Focus the step heading on step change for keyboard/screen reader users
  useEffect(() => {
    if (step > 0) {
      stepHeadingRef.current?.focus();
    }
  }, [step]);

  const firstName = userName.split(' ')[0];

  // Track the profile ID we're working with (may get set during save)
  const [profileId, setProfileId] = useState<string | null>(existingProfileId);

  // Step 3 sub-state: which data path was chosen
  const [dataChoice, setDataChoice] = useState<'manual' | 'skip' | null>(null);

  // Step 4: simplified manual entry
  const [medications, setMedications] = useState<SimpleMed[]>([{ name: '', dose: '' }]);
  const [doctors, setDoctors] = useState<SimpleDoc[]>([{ name: '', specialty: '' }]);
  const [appointments, setAppointments] = useState<SimpleAppt[]>([{ doctor_name: '', date_time: '' }]);
  const [manualSection, setManualSection] = useState<'meds' | 'doctors' | 'appointments'>('meds');

  const ensureProfileId = async (): Promise<string | null> => {
    if (profileId) return profileId;
    try {
      const res = await fetch('/api/records/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({
          patient_name: role === 'patient' ? (firstName || 'Me') : patientName.trim() || 'My loved one',
          relationship: role === 'patient' ? 'self' : relationship || null,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.id) {
        setProfileId(data.id);
        return data.id;
      }
    } catch (err) {
      console.error('Failed to ensure profile:', err);
    }
    return null;
  };

  const saveStepProgress = async (currentStep: number) => {
    try {
      let stepData: Record<string, unknown> = {};

      if (currentStep === 1) {
        stepData = {
          patient_name: role === 'patient' ? (firstName || 'Me') : patientName.trim(),
          patient_age: patientAge ? parseInt(patientAge) : null,
          relationship: role === 'patient' ? 'self' : relationship || null,
        };
      } else if (currentStep === 2) {
        stepData = {
          cancer_type: cancerType || null,
          cancer_stage: cancerStage || null,
          treatment_phase: treatmentPhase || null,
        };
      } else {
        return; // Nothing to save for other steps here
      }

      const method = profileId ? 'PATCH' : 'POST';
      const res = await fetch('/api/records/profile', {
        method,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify(profileId ? { id: profileId, ...stepData } : stepData),
      });
      if (res.ok && !profileId) {
        const data = await res.json();
        if (data.id) setProfileId(data.id);
      }
    } catch (err) {
      console.error('Failed to save step progress:', err);
    }
  };

  const goForward = (nextStep: number) => {
    trackEvent({ name: 'onboarding_step', properties: { from: step, to: nextStep } });
    saveStepProgress(step);
    setError(null);
    setSlideDir('left');
    setAnimKey((k) => k + 1);
    setStep(nextStep);
  };

  const goBack = (prevStep: number) => {
    setError(null);
    setSlideDir('right');
    setAnimKey((k) => k + 1);
    setStep(prevStep);
  };

  // Detect Google sign-in (avatar URL present means OAuth)
  const isGoogleUser = !!userAvatar;

  // Step 1: Who is this for — auto-select patient for Google users, or restore from existing profile
  const getInitialRole = (): 'patient' | 'caregiver' | null => {
    if (existingProfile?.relationship === 'self') return 'patient';
    if (existingProfile?.relationship && existingProfile.relationship !== 'self') return 'caregiver';
    if (isGoogleUser) return 'patient';
    return null;
  };
  const [role, setRole] = useState<'patient' | 'caregiver' | null>(getInitialRole);
  const [patientName, setPatientName] = useState(existingProfile?.patient_name || '');
  const [patientAge, setPatientAge] = useState(existingProfile?.patient_age?.toString() || '');
  const [relationship, setRelationship] = useState(existingProfile?.relationship || '');

  // Step 2: Diagnosis
  const [cancerType, setCancerType] = useState(existingProfile?.cancer_type || '');
  const [cancerStage, setCancerStage] = useState(existingProfile?.cancer_stage || '');
  const [treatmentPhase, setTreatmentPhase] = useState(existingProfile?.treatment_phase || '');

  // Step 5: Priorities
  const [priorities, setPriorities] = useState<string[]>(existingProfile?.onboarding_priorities || []);

  const togglePriority = (value: string) => {
    setPriorities((prev) =>
      prev.includes(value)
        ? prev.filter((p) => p !== value)
        : prev.length < 3
          ? [...prev, value]
          : prev
    );
  };

  // Enter key to advance on non-typing steps (placed after all state is declared)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (step === 1 && role !== null && (role === 'patient' || patientName.trim().length > 0)) goForward(2);
      if (step === 2) goForward(3);
      if (step === 5 && !loading) goForward(6);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, role, patientName, loading]);

  // Save manual entry data via API routes
  const saveManualData = async () => {
    const pid = await ensureProfileId();
    if (!pid) return;

    try {
      const validMeds = medications.filter((m) => m.name.trim());
      if (validMeds.length > 0) {
        await fetch('/api/records/medications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ profileId: pid, medications: validMeds }),
        });
      }

      const validDocs = doctors.filter((d) => d.name.trim());
      if (validDocs.length > 0) {
        await fetch('/api/records/doctors', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ profileId: pid, doctors: validDocs }),
        });
      }

      const validAppts = appointments.filter((a) => a.doctor_name.trim());
      if (validAppts.length > 0) {
        await fetch('/api/records/appointments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ profileId: pid, appointments: validAppts }),
        });
      }
    } catch (err) {
      console.error('Failed to save manual data:', err);
    }
  };

  // Handle step 3 data choice
  const handleDataChoice = async (choice: 'manual' | 'skip') => {
    setDataChoice(choice);

    if (choice === 'manual') {
      // Go to step 4 (manual entry)
      goForward(4);
    } else {
      // Skip — jump to step 5 (priorities)
      goForward(5);
    }
  };

  const saveAndFinish = async () => {
    trackEvent({ name: 'onboarding_complete', properties: { dataChoice: dataChoice || 'skip' } });
    setLoading(true);
    setError(null);
    try {
      const profileData = {
        id: profileId,
        patient_name: role === 'patient' ? (firstName || 'Me') : patientName.trim(),
        patient_age: patientAge ? parseInt(patientAge) : null,
        relationship: role === 'patient' ? 'self' : relationship || null,
        cancer_type: cancerType || null,
        cancer_stage: cancerStage || null,
        treatment_phase: treatmentPhase || null,
        onboarding_priorities: priorities.length > 0 ? priorities : null,
        onboarding_completed: true,
      };

      const res = await fetch('/api/records/profile', {
        method: profileId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify(profileData),
      });

      if (!res.ok) {
        throw new Error('Failed to save profile');
      }

      // Trigger welcome email (fire and forget)
      fetch('/api/welcome-email', { method: 'POST' }).catch(() => {});

      // Flag for guided tour on first dashboard visit
      localStorage.setItem('onboarding_just_completed', 'true');
      if (priorities.length > 0) {
        localStorage.setItem('onboarding_priorities', JSON.stringify(priorities));
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('Onboarding error:', err);
      setError('Something went wrong saving your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return role !== null && (role === 'patient' || patientName.trim().length > 0);
    if (step === 2) return true; // All optional
    if (step === 3) return true; // Choose a path
    if (step === 4) return true; // All optional
    if (step === 5) return true; // Optional
    return true;
  };

  // Count what was entered in manual entry for the summary
  const manualSummary = {
    meds: medications.filter((m) => m.name.trim()).length,
    docs: doctors.filter((d) => d.name.trim()).length,
    appts: appointments.filter((a) => a.doctor_name.trim()).length,
  };

  return (
    <div className="space-y-8">
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes celebratePop {
          0% { opacity: 0; transform: scale(0.8); }
          50% { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes confettiFade {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Intro animation - step 0 */}
      {step === 0 && (
        <div className="text-center space-y-8 py-8" style={{ animation: 'celebratePop 0.5s ease-out' }}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] shadow-lg shadow-[#6366F1]/30 mx-auto">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>

          <div>
            <h1 className="font-display text-3xl font-bold text-white mb-3">CareCompanion</h1>
            <p className="text-[var(--text-secondary)] text-lg">Your AI-powered cancer care assistant</p>
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10">
              <svg className="w-3.5 h-3.5 text-[#A78BFA]" aria-hidden="true" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="text-xs text-[var(--text-muted)]">Takes about 2 minutes</span>
            </div>
          </div>

          <div className="space-y-4 max-w-xs mx-auto text-left">
            {[
              { color: '#A78BFA', svgPath: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', text: 'Track medications and side effects' },
              { color: '#60A5FA', svgPath: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z', text: 'AI that understands your treatment' },
              { color: '#34D399', svgPath: 'M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5', text: 'Monitor labs and appointments' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-white/80"
                style={{ animation: `confettiFade 0.4s ease-out ${0.3 + i * 0.15}s both` }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: item.color + '20' }}>
                  <svg className="w-4 h-4" fill="none" stroke={item.color} strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={item.svgPath} /></svg>
                </div>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => goForward(1)}
            className="w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Get Started
          </button>
        </div>
      )}

      {/* Progress indicator — hidden on intro and done screens */}
      {step > 0 && step < 7 && (
        <div className="space-y-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-label={`Step ${step} of ${TOTAL_STEPS}: ${STEP_LABELS[step - 1]}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">{STEP_LABELS[step - 1]}</span>
            <span className="text-[11px] text-[var(--text-muted)]">{step}/{TOTAL_STEPS}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#A78BFA] transition-all duration-500 ease-out"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 1: Welcome + Who is this for */}
      {step === 1 && (
        <div key={animKey} className="space-y-6" style={{ animation: `${slideDir === 'left' ? 'slideInLeft' : 'slideInRight'} 0.35s ease-out` }}>
          <div className="text-center">
            {userAvatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userAvatar}
                alt=""
                className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-[#A78BFA]/30"
                referrerPolicy="no-referrer"
              />
            )}
            <h1 ref={stepHeadingRef} tabIndex={-1} className="font-display text-3xl font-bold text-white outline-none">
              {firstName ? `Welcome, ${firstName}` : 'Welcome'}
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              Let&apos;s set up your cancer care companion
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)] font-medium">Who is this for?</p>

            <button
              type="button"
              onClick={() => setRole('patient')}
              className={`w-full text-left rounded-2xl p-5 border transition-all ${
                role === 'patient'
                  ? 'border-[#A78BFA]/50 bg-[#A78BFA]/10'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  role === 'patient' ? 'bg-[#A78BFA]/20' : 'bg-white/5'
                }`}>
                  <svg className="w-6 h-6 text-[#A78BFA]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                </div>
                <div>
                  <p className="font-semibold text-white">I&apos;m a patient</p>
                  <p className="text-sm text-[var(--text-muted)]">Managing my own cancer care</p>
                </div>
                {role === 'patient' && (
                  <svg className="w-5 h-5 text-[#A78BFA] ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole('caregiver')}
              className={`w-full text-left rounded-2xl p-5 border transition-all ${
                role === 'caregiver'
                  ? 'border-pink-400/50 bg-pink-500/10'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  role === 'caregiver' ? 'bg-pink-500/20' : 'bg-white/5'
                }`}>
                  <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                </div>
                <div>
                  <p className="font-semibold text-white">I&apos;m a caregiver</p>
                  <p className="text-sm text-[var(--text-muted)]">Helping someone I love</p>
                </div>
                {role === 'caregiver' && (
                  <svg className="w-5 h-5 text-pink-400 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </div>
            </button>
          </div>

          {/* Caregiver: patient info */}
          {role === 'caregiver' && (
            <div className="space-y-4 animate-fade-in-up bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6">
              <p className="text-sm font-medium text-[var(--text-secondary)]">Tell us about the person you&apos;re caring for</p>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1.5">Their name</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g., Mom, Dad, John"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1.5">Age</label>
                  <input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder="e.g., 65"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1.5">Relationship</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-white focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
                  >
                    <option value="">Select...</option>
                    <option value="parent">Parent</option>
                    <option value="spouse">Spouse / Partner</option>
                    <option value="child">Child</option>
                    <option value="sibling">Sibling</option>
                    <option value="grandparent">Grandparent</option>
                    <option value="friend">Friend</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => goForward(2)}
            disabled={!canProceed()}
            aria-disabled={!canProceed()}
            className="w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Continue
          </button>
          {!role && (
            <p className="text-center text-xs text-[var(--text-muted)] mt-1" aria-live="polite">
              Select who this is for to continue
            </p>
          )}
          {role === 'caregiver' && !patientName.trim() && (
            <p className="text-center text-xs text-[var(--text-muted)] mt-1" aria-live="polite">
              Enter the patient&apos;s name to continue
            </p>
          )}
          <button
            onClick={() => {
              import('next-auth/react').then(({ signOut }) => signOut({ callbackUrl: '/login' }));
            }}
            className="block w-full text-center text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
          >
            Sign out
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                await fetch('/api/records/profile', {
                  method: profileId ? 'PATCH' : 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
                  body: JSON.stringify({
                    id: profileId,
                    patient_name: firstName || 'Me',
                    relationship: 'self',
                    onboarding_completed: false,
                  }),
                });
                localStorage.setItem('onboarding_just_completed', 'true');
                router.push('/dashboard');
              } catch (err) {
                console.error('Skip setup error:', err);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="block w-full text-center text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mt-2 disabled:opacity-40"
          >
            Skip setup — take me to the app
          </button>
        </div>
      )}

      {/* Step 2: Diagnosis */}
      {step === 2 && (
        <div key={animKey} className="space-y-6" style={{ animation: `${slideDir === 'left' ? 'slideInLeft' : 'slideInRight'} 0.35s ease-out` }}>
          <div className="text-center">
            <h1 ref={stepHeadingRef} tabIndex={-1} className="font-display text-3xl font-bold text-white outline-none">
              {role === 'caregiver' ? 'About their diagnosis' : 'About the diagnosis'}
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              {role === 'caregiver'
                ? `This helps us personalize ${patientName.trim() ? `${patientName.trim()}'s` : 'their'} experience. Skip anything you're not sure about.`
                : "This helps us personalize your experience. Skip anything you're not sure about."}
            </p>
          </div>


          <div className="space-y-4">
            {/* Cancer type */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">Cancer type</label>
              <div className="grid grid-cols-2 gap-2">
                {CANCER_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCancerType(cancerType === t ? '' : t)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${
                      cancerType === t
                        ? 'border-[#A78BFA]/50 bg-[#A78BFA]/15 text-white'
                        : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Cancer tip */}
            {cancerType && CANCER_TIPS[cancerType] && (
              <div className="rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/20 p-3 text-sm text-[#A78BFA]">
                {CANCER_TIPS[cancerType]}
              </div>
            )}

            {/* Stage */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Stage (if known)</label>
              <div className="grid grid-cols-5 gap-2">
                {['I', 'II', 'III', 'IV', 'Unsure'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCancerStage(s)}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      cancerStage === s
                        ? 'border-[#A78BFA]/50 bg-[#A78BFA]/15 text-white'
                        : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-white/20'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Treatment phase */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">Current treatment phase</label>
              <div className="space-y-2">
                {TREATMENT_PHASES.map((phase) => (
                  <button
                    key={phase.value}
                    type="button"
                    onClick={() => setTreatmentPhase(phase.value)}
                    className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${
                      treatmentPhase === phase.value
                        ? 'border-[#A78BFA]/50 bg-[#A78BFA]/10'
                        : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: phase.color + '20' }}>
                        <svg className="w-4 h-4" fill="none" stroke={phase.color} strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={phase.svgPath} /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{phase.label}</p>
                        <p className="text-xs text-[var(--text-muted)]">{phase.desc}</p>
                      </div>
                      {treatmentPhase === phase.value && (
                        <svg className="w-4 h-4 text-[#A78BFA] ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => goBack(1)}
              className="flex-shrink-0 rounded-xl border border-[var(--border)] py-3.5 px-5 text-sm text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => goForward(3)}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Continue
            </button>
          </div>
          <button
            onClick={() => goForward(3)}
            className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}

      {/* Step 3: Data entry choice */}
      {step === 3 && (
        <div key={animKey} className="space-y-6" style={{ animation: `${slideDir === 'left' ? 'slideInLeft' : 'slideInRight'} 0.35s ease-out` }}>
          <div className="text-center">
            <h1 ref={stepHeadingRef} tabIndex={-1} className="font-display text-3xl font-bold text-white outline-none">
              Bring in your data
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              Choose how you&apos;d like to get started. You can always add more later.
            </p>
          </div>

          <div className="space-y-3">
            {/* Enter Manually */}
            <button
              onClick={() => handleDataChoice('manual')}
              disabled={loading}
              className="w-full text-left rounded-2xl p-5 border border-[var(--border)] bg-[var(--bg-card)] hover:border-emerald-400/30 hover:bg-emerald-500/5 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Enter Manually</p>
                  <p className="text-sm text-[var(--text-muted)]">Type in medications, doctors, and appointments</p>
                </div>
                <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>

            {/* Try Demo */}
            <button
              onClick={async () => {
                setLoading(true);
                trackEvent({ name: 'onboarding_complete', properties: { dataSource: 'demo' } });
                try {
                  await saveStepProgress(step);
                  const pid = await ensureProfileId();
                  if (!pid) return;

                  await fetch('/api/records/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
                    body: JSON.stringify({
                      id: pid,
                      onboarding_completed: true,
                    }),
                  });

                  await fetch('/api/seed-demo', { method: 'POST' });
                  localStorage.setItem('onboarding_just_completed', 'true');
                  router.push('/dashboard');
                } catch (err) {
                  console.error('Demo seed error:', err);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full text-left rounded-2xl p-5 border border-dashed border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center group-hover:bg-cyan-500/25 transition-colors">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Try with Demo Data</p>
                  <p className="text-sm text-[var(--text-muted)]">See the full app with realistic cancer care data</p>
                </div>
                <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => goBack(2)}
              className="flex-shrink-0 rounded-xl border border-[var(--border)] py-3.5 px-5 text-sm text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => handleDataChoice('skip')}
              className="flex-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-3.5"
            >
              Skip — I&apos;ll add data later
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Quick manual entry */}
      {step === 4 && (
        <div key={animKey} className="space-y-6" style={{ animation: `${slideDir === 'left' ? 'slideInLeft' : 'slideInRight'} 0.35s ease-out` }}>
          <div className="text-center">
            <h1 ref={stepHeadingRef} tabIndex={-1} className="font-display text-3xl font-bold text-white outline-none">
              Quick setup
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              Add a few basics to get started. You can always edit these later.
            </p>
          </div>

          {/* Section tabs */}
          <div className="flex gap-2">
            {([
              { key: 'meds' as const, label: 'Meds', icon: '💊', count: manualSummary.meds },
              { key: 'doctors' as const, label: 'Doctors', icon: '👨‍⚕️', count: manualSummary.docs },
              { key: 'appointments' as const, label: 'Appts', icon: '📅', count: manualSummary.appts },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setManualSection(tab.key)}
                className={`flex-1 rounded-xl py-2.5 px-3 text-xs font-medium border transition-all ${
                  manualSection === tab.key
                    ? 'border-[#A78BFA]/50 bg-[#A78BFA]/10 text-white'
                    : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-white/20'
                }`}
              >
                <span className="mr-1" aria-hidden="true">{tab.icon}</span>
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#A78BFA]/30 text-[#C4B5FD] text-[10px] font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Medications section */}
          {manualSection === 'meds' && (
            <div className="space-y-3">
              {medications.map((med, i) => (
                <div key={i} className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Medication {i + 1}</span>
                    {medications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setMedications((prev) => prev.filter((_, j) => j !== i))}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
                      <input
                        type="text"
                        value={med.name}
                        onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, name: e.target.value } : m))}
                        placeholder="e.g., Metformin"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Dose</label>
                      <input
                        type="text"
                        value={med.dose}
                        onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, dose: e.target.value } : m))}
                        placeholder="e.g., 500mg"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setMedications((prev) => [...prev, { name: '', dose: '' }])}
                className="text-sm text-[#A78BFA] hover:text-[#C4B5FD] font-medium"
              >
                + Add another medication
              </button>
            </div>
          )}

          {/* Doctors section */}
          {manualSection === 'doctors' && (
            <div className="space-y-3">
              {doctors.map((doc, i) => (
                <div key={i} className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Doctor {i + 1}</span>
                    {doctors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDoctors((prev) => prev.filter((_, j) => j !== i))}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
                      <input
                        type="text"
                        value={doc.name}
                        onChange={(e) => setDoctors((prev) => prev.map((d, j) => j === i ? { ...d, name: e.target.value } : d))}
                        placeholder="e.g., Dr. Johnson"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Specialty</label>
                      <input
                        type="text"
                        value={doc.specialty}
                        onChange={(e) => setDoctors((prev) => prev.map((d, j) => j === i ? { ...d, specialty: e.target.value } : d))}
                        placeholder="e.g., Oncologist"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDoctors((prev) => [...prev, { name: '', specialty: '' }])}
                className="text-sm text-[#A78BFA] hover:text-[#C4B5FD] font-medium"
              >
                + Add another doctor
              </button>
            </div>
          )}

          {/* Appointments section */}
          {manualSection === 'appointments' && (
            <div className="space-y-3">
              {appointments.map((appt, i) => (
                <div key={i} className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Appointment {i + 1}</span>
                    {appointments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAppointments((prev) => prev.filter((_, j) => j !== i))}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Doctor</label>
                      <input
                        type="text"
                        value={appt.doctor_name}
                        onChange={(e) => setAppointments((prev) => prev.map((a, j) => j === i ? { ...a, doctor_name: e.target.value } : a))}
                        placeholder="e.g., Dr. Smith"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Date</label>
                      <input
                        type="date"
                        value={appt.date_time}
                        onChange={(e) => setAppointments((prev) => prev.map((a, j) => j === i ? { ...a, date_time: e.target.value } : a))}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 px-3 text-sm text-white focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAppointments((prev) => [...prev, { doctor_name: '', date_time: '' }])}
                className="text-sm text-[#A78BFA] hover:text-[#C4B5FD] font-medium"
              >
                + Add another appointment
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => goBack(3)}
              className="flex-shrink-0 rounded-xl border border-[var(--border)] py-3.5 px-5 text-sm text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-all"
            >
              Back
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  await saveManualData();
                } finally {
                  setLoading(false);
                }
                goForward(5);
              }}
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </div>
          <button
            onClick={() => goForward(5)}
            className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Skip — I&apos;ll add these later
          </button>
        </div>
      )}

      {/* Step 5: Priorities */}
      {step === 5 && (
        <div key={animKey} className="space-y-6" style={{ animation: `${slideDir === 'left' ? 'slideInLeft' : 'slideInRight'} 0.35s ease-out` }}>
          <div className="text-center">
            <h1 ref={stepHeadingRef} tabIndex={-1} className="font-display text-3xl font-bold text-white outline-none">
              What matters most?
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              Pick up to 3. We&apos;ll prioritize these in your dashboard and notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {PRIORITIES.map((p) => {
              const selected = priorities.includes(p.value);
              const disabled = !selected && priorities.length >= 3;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePriority(p.value)}
                  disabled={disabled}
                  className={`w-full text-left rounded-xl px-4 py-3.5 border transition-all ${
                    selected
                      ? 'border-[#A78BFA]/50 bg-[#A78BFA]/10'
                      : disabled
                        ? 'border-[var(--border)] bg-[var(--bg-card)] opacity-40 cursor-not-allowed'
                        : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: p.color + '20' }}>
                      <svg className="w-4 h-4" fill="none" stroke={p.color} strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={p.svgPath} /></svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{p.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{p.desc}</p>
                    </div>
                    {selected && (
                      <svg className="w-4 h-4 text-[#A78BFA] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {priorities.length > 0 && (
            <p className="text-center text-xs text-[var(--text-muted)]">
              {priorities.length}/3 selected
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => goBack(dataChoice === 'manual' ? 4 : 3)}
              className="flex-shrink-0 rounded-xl border border-[var(--border)] py-3.5 px-5 text-sm text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-all"
              aria-label="Go back"
            >
              Back
            </button>
            <button
              onClick={() => goForward(6)}
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              Continue
            </button>
          </div>
          <button
            onClick={() => goForward(6)}
            className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Skip for now
          </button>

          {/* Invite caregiver/family member */}
          <div className="rounded-xl border border-dashed border-[var(--border)] p-4 mt-2">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#A78BFA]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Invite a family member</p>
                <p className="text-xs text-[var(--text-muted)]">Share care access with your support team</p>
              </div>
              <a
                href="/care-team"
                className="text-xs font-medium text-[#A78BFA] bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                Invite
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Done / Welcome screen */}
      {step === 6 && (
        <div key={animKey} className="space-y-8 py-4" style={{ animation: 'celebratePop 0.5s ease-out' }}>
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>

            <h1 className="font-display text-3xl font-bold text-white">
              You&apos;re all set!
            </h1>
            <p className="text-[var(--text-secondary)]">
              Here&apos;s a summary of what we set up for you
            </p>
          </div>

          {/* Summary cards */}
          <div className="space-y-3">
            {/* Profile */}
            <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-[#A78BFA]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={role === 'patient' ? 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' : 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z'} /></svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {role === 'patient' ? 'Managing your own care' : `Caring for ${patientName || 'a loved one'}`}
                  </p>
                </div>
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
            </div>

            {/* Diagnosis */}
            {(cancerType || treatmentPhase) && (
              <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-[#F472B6]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {cancerType ? `${cancerType} cancer` : 'Diagnosis info'}
                      {cancerStage && cancerStage !== 'Unsure' ? ` (Stage ${cancerStage})` : ''}
                    </p>
                    {treatmentPhase && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {TREATMENT_PHASES.find((p) => p.value === treatmentPhase)?.label}
                      </p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
              </div>
            )}

            {/* Data source */}
            {dataChoice === 'manual' && (
              <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-[#60A5FA]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Manual data entered</p>
                    {(manualSummary.meds > 0 || manualSummary.docs > 0 || manualSummary.appts > 0) && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {[
                          manualSummary.meds > 0 ? `${manualSummary.meds} medication${manualSummary.meds > 1 ? 's' : ''}` : null,
                          manualSummary.docs > 0 ? `${manualSummary.docs} doctor${manualSummary.docs > 1 ? 's' : ''}` : null,
                          manualSummary.appts > 0 ? `${manualSummary.appts} appointment${manualSummary.appts > 1 ? 's' : ''}` : null,
                        ].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
              </div>
            )}

            {/* Priorities */}
            {priorities.length > 0 && (
              <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-[#A78BFA]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Priorities set</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {priorities.map((p) => PRIORITIES.find((pr) => pr.value === p)?.label).filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* What's next — shown when user skipped most steps */}
          {!cancerType && !dataChoice && priorities.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-4 space-y-3">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Suggested next steps</p>
              <div className="space-y-2">
                {[
                  { icon: '💊', label: 'Add your medications', href: '/medications' },
                  { icon: '📅', label: 'Log an upcoming appointment', href: '/appointments' },
                  { icon: '👨‍⚕️', label: 'Add your care team', href: '/care-team' },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors group"
                  >
                    <span className="text-base" aria-hidden="true">{item.icon}</span>
                    <span className="text-sm text-[var(--text-secondary)] group-hover:text-white transition-colors">{item.label}</span>
                    <svg className="w-4 h-4 text-[var(--text-muted)] ml-auto group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Confetti emojis */}
          <div className="flex justify-center gap-1.5" aria-hidden="true">
            {['💜', '🩺', '💪', '🌟', '❤️'].map((e, i) => (
              <span key={i} className="text-2xl" style={{ animation: `confettiFade 0.4s ease-out ${0.3 + i * 0.1}s both` }}>{e}</span>
            ))}
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={saveAndFinish}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Setting up...
              </span>
            ) : (
              'Go to Dashboard'
            )}
          </button>

          <p className="text-center text-xs text-[var(--text-muted)]">
            You can always update your info in Settings
          </p>
        </div>
      )}

      {/* Loading overlay for demo data */}
      {loading && step === 3 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] rounded-2xl p-10 text-center space-y-5 border border-[var(--border)]" style={{ animation: 'celebratePop 0.4s ease-out' }}>
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-bold text-white">Loading demo data!</h2>
            <p className="text-sm text-[var(--text-secondary)]">Setting up your care companion...</p>
            <svg className="animate-spin h-6 w-6 text-[#A78BFA] mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
