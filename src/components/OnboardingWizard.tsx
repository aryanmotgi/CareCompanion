'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { trackEvent } from '@/lib/analytics';

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
  { value: 'just_diagnosed', label: 'Just diagnosed', icon: '🔍', desc: 'Learning about options' },
  { value: 'active_treatment', label: 'Active treatment', icon: '💉', desc: 'Chemo, radiation, or surgery' },
  { value: 'between_treatments', label: 'Between treatments', icon: '⏸️', desc: 'Resting between cycles' },
  { value: 'remission', label: 'In remission', icon: '🌟', desc: 'Monitoring and follow-ups' },
  { value: 'unsure', label: 'Not sure yet', icon: '❓', desc: 'Still figuring things out' },
];

const PRIORITIES = [
  { value: 'side_effects', label: 'Tracking side effects', icon: '📋', desc: 'Log symptoms and side effects daily' },
  { value: 'medications', label: 'Managing medications', icon: '💊', desc: 'Track meds, refills, and schedules' },
  { value: 'appointments', label: 'Preparing for appointments', icon: '📅', desc: 'Questions, notes, and reminders' },
  { value: 'lab_results', label: 'Understanding lab results', icon: '🔬', desc: 'CBC, tumor markers, and more' },
  { value: 'insurance', label: 'Insurance & billing help', icon: '💰', desc: 'Claims, prior auths, and costs' },
  { value: 'emotional', label: 'Emotional support', icon: '💜', desc: 'Resources and coping strategies' },
];

const STEP_LABELS = ['Who', 'Diagnosis', 'Data', 'Details', 'Priorities', 'Done'];
const TOTAL_STEPS = 6;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function OnboardingWizard({ userName, userEmail, userAvatar, existingProfileId, existingProfile }: OnboardingWizardProps) {
  const router = useRouter();
  const supabase = createClient();

  // Resume from step 5 if user went through FHIR connect flow
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
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  const [animKey, setAnimKey] = useState(0);

  const firstName = userName.split(' ')[0];

  // Track the profile ID we're working with (may get set during save)
  const [profileId, setProfileId] = useState<string | null>(existingProfileId);

  // Step 3 sub-state: which data path was chosen
  const [dataChoice, setDataChoice] = useState<'connect' | 'manual' | 'skip' | null>(null);

  // Step 3 inline connect state
  const [connectStarted, setConnectStarted] = useState(false);

  // Step 4: simplified manual entry
  const [medications, setMedications] = useState<SimpleMed[]>([{ name: '', dose: '' }]);
  const [doctors, setDoctors] = useState<SimpleDoc[]>([{ name: '', specialty: '' }]);
  const [appointments, setAppointments] = useState<SimpleAppt[]>([{ doctor_name: '', date_time: '' }]);
  const [manualSection, setManualSection] = useState<'meds' | 'doctors' | 'appointments'>('meds');

  const ensureProfileId = async (): Promise<string | null> => {
    if (profileId) return profileId;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: existing } = await supabase
        .from('care_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        setProfileId(existing.id);
        return existing.id;
      }

      // Create a minimal profile
      const { data: created } = await supabase
        .from('care_profiles')
        .insert({
          user_id: user.id,
          patient_name: role === 'patient' ? (firstName || 'Me') : patientName.trim() || 'My loved one',
          relationship: role === 'patient' ? 'self' : relationship || null,
        })
        .select('id')
        .single();

      if (created) {
        setProfileId(created.id);
        return created.id;
      }
    } catch (err) {
      console.error('Failed to ensure profile:', err);
    }
    return null;
  };

  const saveStepProgress = async (currentStep: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let stepData: Record<string, unknown> = { user_id: user.id };

      if (currentStep === 1) {
        stepData = {
          ...stepData,
          patient_name: role === 'patient' ? (firstName || 'Me') : patientName.trim(),
          patient_age: patientAge ? parseInt(patientAge) : null,
          relationship: role === 'patient' ? 'self' : relationship || null,
        };
      } else if (currentStep === 2) {
        stepData = {
          ...stepData,
          cancer_type: cancerType || null,
          cancer_stage: cancerStage || null,
          treatment_phase: treatmentPhase || null,
        };
      }

      if (profileId) {
        await supabase.from('care_profiles').update(stepData).eq('id', profileId);
      } else {
        const { data: existing } = await supabase
          .from('care_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (existing) {
          setProfileId(existing.id);
          await supabase.from('care_profiles').update(stepData).eq('id', existing.id);
        } else {
          const { data: created } = await supabase.from('care_profiles').insert(stepData).select('id').single();
          if (created) setProfileId(created.id);
        }
      }
    } catch (err) {
      console.error('Failed to save step progress:', err);
    }
  };

  const goForward = (nextStep: number) => {
    trackEvent({ name: 'onboarding_step', properties: { from: step, to: nextStep } });
    saveStepProgress(step);
    setSlideDir('left');
    setAnimKey((k) => k + 1);
    setStep(nextStep);
  };

  const goBack = (prevStep: number) => {
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

  // Save manual entry data to Supabase
  const saveManualData = async () => {
    const pid = await ensureProfileId();
    if (!pid) return;

    try {
      // Save medications
      const validMeds = medications.filter((m) => m.name.trim());
      if (validMeds.length > 0) {
        await supabase.from('medications').insert(
          validMeds.map((m) => ({
            care_profile_id: pid,
            name: m.name.trim(),
            dose: m.dose.trim() || null,
            frequency: null,
            prescribing_doctor: null,
            refill_date: null,
          }))
        );
      }

      // Save doctors
      const validDocs = doctors.filter((d) => d.name.trim());
      if (validDocs.length > 0) {
        await supabase.from('doctors').insert(
          validDocs.map((d) => ({
            care_profile_id: pid,
            name: d.name.trim(),
            specialty: d.specialty.trim() || null,
            phone: null,
          }))
        );
      }

      // Save appointments
      const validAppts = appointments.filter((a) => a.doctor_name.trim());
      if (validAppts.length > 0) {
        await supabase.from('appointments').insert(
          validAppts.map((a) => ({
            care_profile_id: pid,
            doctor_name: a.doctor_name.trim(),
            date_time: a.date_time || null,
            purpose: null,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to save manual data:', err);
    }
  };

  // Handle step 3 data choice
  const handleDataChoice = async (choice: 'connect' | 'manual' | 'skip') => {
    setDataChoice(choice);

    if (choice === 'connect') {
      // Show inline connect UI
      setConnectStarted(true);
    } else if (choice === 'manual') {
      // Go to step 4 (manual entry)
      goForward(4);
    } else {
      // Skip — jump to step 5 (priorities)
      goForward(5);
    }
  };

  // Handle connect flow — redirect to FHIR authorize
  const handleStartConnect = () => {
    // Save step so we can resume at step 5 after returning from external flows
    localStorage.setItem('onboarding_step', '5');
    saveStepProgress(step);
    window.location.href = '/api/fhir/authorize?provider=epic';
  };

  const saveAndFinish = async () => {
    trackEvent({ name: 'onboarding_complete', properties: { dataChoice: dataChoice || 'skip' } });
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profileData = {
        user_id: user.id,
        patient_name: role === 'patient' ? (firstName || 'Me') : patientName.trim(),
        patient_age: patientAge ? parseInt(patientAge) : null,
        relationship: role === 'patient' ? 'self' : relationship || null,
        cancer_type: cancerType || null,
        cancer_stage: cancerStage || null,
        treatment_phase: treatmentPhase || null,
        onboarding_priorities: priorities.length > 0 ? priorities : null,
        onboarding_completed: true,
      };

      if (profileId) {
        await supabase.from('care_profiles').update(profileData).eq('id', profileId);
      } else {
        // Check if profile already exists (from OAuth creating one)
        const { data: existing } = await supabase
          .from('care_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (existing) {
          await supabase.from('care_profiles').update(profileData).eq('id', existing.id);
        } else {
          await supabase.from('care_profiles').insert(profileData);
        }
      }

      // Trigger welcome email (fire and forget)
      fetch('/api/welcome-email', { method: 'POST' }).catch(() => {});

      // Flag for guided tour on first dashboard visit
      localStorage.setItem('onboarding_just_completed', 'true');

      router.push('/dashboard');
    } catch (err) {
      console.error('Onboarding error:', err);
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
          </div>

          <div className="space-y-4 max-w-xs mx-auto text-left">
            {[
              { icon: '💊', text: 'Track medications and side effects' },
              { icon: '🤖', text: 'AI that understands your treatment' },
              { icon: '📊', text: 'Monitor labs and appointments' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-white/80"
                style={{ animation: `confettiFade 0.4s ease-out ${0.3 + i * 0.15}s both` }}
              >
                <span className="text-xl">{item.icon}</span>
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
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-gradient-to-r from-[#6366F1] to-[#A78BFA]'
                    : s < step
                      ? 'w-2 bg-[#A78BFA]'
                      : 'w-2 bg-white/10'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)]">
              Step {step} of {TOTAL_STEPS}: {STEP_LABELS[step - 1]}
            </span>
          </div>
        </div>
      )}

      {/* Step 1: Welcome + Who is this for */}
      {step === 1 && (
        <div key={animKey} className="space-y-6" style={{ animation: `${slideDir === 'left' ? 'slideInLeft' : 'slideInRight'} 0.35s ease-out` }}>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {userAvatar && (
              <img
                src={userAvatar}
                alt=""
                className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-[#A78BFA]/30"
                referrerPolicy="no-referrer"
              />
            )}
            <h1 className="font-display text-3xl font-bold text-white">
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
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                  role === 'patient' ? 'bg-[#A78BFA]/20' : 'bg-white/5'
                }`}>
                  👤
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
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                  role === 'caregiver' ? 'bg-pink-500/20' : 'bg-white/5'
                }`}>
                  💜
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
            className="w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Continue
          </button>
          <a href="/login" className="block text-center text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mt-3">
            Back to login
          </a>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const minimalProfile = {
                  user_id: user.id,
                  patient_name: firstName || 'Me',
                  relationship: 'self',
                  onboarding_completed: true,
                };
                if (profileId) {
                  await supabase.from('care_profiles').update(minimalProfile).eq('id', profileId);
                } else {
                  const { data: existing } = await supabase.from('care_profiles').select('id').eq('user_id', user.id).single();
                  if (existing) {
                    await supabase.from('care_profiles').update(minimalProfile).eq('id', existing.id);
                  } else {
                    await supabase.from('care_profiles').insert(minimalProfile);
                  }
                }
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
            <h1 className="font-display text-3xl font-bold text-white">
              About the diagnosis
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              This helps us personalize your experience. Skip anything you&apos;re not sure about.
            </p>
          </div>

          {/* Quick connect CTA — skip manual entry */}
          <a
            href="/api/fhir/authorize?provider=1uphealth"
            onClick={() => {
              localStorage.setItem('onboarding_step', '5');
              saveStepProgress(2);
            }}
            className="block rounded-2xl p-4 border border-[#6366F1]/30 transition-all hover:border-[#6366F1]/50"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(167,139,250,0.08))' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.2)' }}>
                <svg className="w-5 h-5 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Skip this — connect your health records</p>
                <p className="text-xs text-[#94a3b8] mt-0.5">Import diagnosis, meds, labs, and more from 300+ health systems via 1upHealth. Saves time and avoids errors.</p>
              </div>
              <svg className="w-5 h-5 text-[#A78BFA] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </a>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-xs text-[#64748b] font-medium">or enter manually</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
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
                      <span className="text-lg">{phase.icon}</span>
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

      {/* Step 3: Data connection choice */}
      {step === 3 && !connectStarted && (
        <div key={animKey} className="space-y-6" style={{ animation: `${slideDir === 'left' ? 'slideInLeft' : 'slideInRight'} 0.35s ease-out` }}>
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-white">
              Bring in your data
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              Choose how you&apos;d like to get started. You can always add more later.
            </p>
          </div>

          <div className="space-y-3">
            {/* Connect Health Records */}
            <button
              onClick={() => handleDataChoice('connect')}
              disabled={loading}
              className="w-full text-left rounded-2xl p-5 border border-[var(--border)] bg-[var(--bg-card)] hover:border-[#A78BFA]/30 hover:bg-[#A78BFA]/5 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center text-xl group-hover:bg-blue-500/25 transition-colors">
                  🏥
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Connect Health Records</p>
                  <p className="text-sm text-[var(--text-muted)]">MyChart, Epic, Kaiser, and 300+ providers</p>
                </div>
                <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>

            {/* Enter Manually */}
            <button
              onClick={() => handleDataChoice('manual')}
              disabled={loading}
              className="w-full text-left rounded-2xl p-5 border border-[var(--border)] bg-[var(--bg-card)] hover:border-emerald-400/30 hover:bg-emerald-500/5 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center text-xl group-hover:bg-emerald-500/25 transition-colors">
                  ✏️
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

                  await supabase.from('care_profiles').update({
                    onboarding_completed: true,
                    onboarding_priorities: priorities.length > 0 ? priorities : null,
                  }).eq('id', pid);

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
                <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center text-xl group-hover:bg-cyan-500/25 transition-colors">
                  ⚡
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

      {/* Step 3: Inline connect health records UI */}
      {step === 3 && connectStarted && (
        <div key={`connect-${animKey}`} className="space-y-6" style={{ animation: 'slideInLeft 0.35s ease-out' }}>
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-white">
              Connect Health Records
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              Securely link your health data through your provider
            </p>
          </div>

          {/* 1upHealth connection card */}
          <div className="rounded-2xl border border-[#A78BFA]/30 bg-[#A78BFA]/5 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white text-lg">Health Records via 1upHealth</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Connect to MyChart, Kaiser, Sutter Health, Aetna, UnitedHealthcare, Medicare, and 300+ more
                </p>
              </div>
            </div>

            {/* Data type pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'medications', color: 'bg-blue-500/20 text-blue-300' },
                { label: 'lab results', color: 'bg-cyan-500/20 text-cyan-300' },
                { label: 'conditions', color: 'bg-violet-500/20 text-violet-300' },
                { label: 'allergies', color: 'bg-amber-500/20 text-amber-300' },
                { label: 'appointments', color: 'bg-emerald-500/20 text-emerald-300' },
                { label: 'doctors', color: 'bg-pink-500/20 text-pink-300' },
              ].map((pill) => (
                <span
                  key={pill.label}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${pill.color}`}
                >
                  {pill.label}
                </span>
              ))}
            </div>

            <button
              onClick={handleStartConnect}
              className="w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
              Connect Health Records
            </button>

            <p className="text-xs text-[var(--text-muted)] text-center">
              You&apos;ll be redirected to securely sign in with your provider. Your data stays private.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setConnectStarted(false)}
              className="flex-shrink-0 rounded-xl border border-[var(--border)] py-3.5 px-5 text-sm text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => {
                setConnectStarted(false);
                goForward(5);
              }}
              className="flex-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-3.5"
            >
              Skip — I&apos;ll connect later
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Quick manual entry */}
      {step === 4 && (
        <div key={animKey} className="space-y-6" style={{ animation: `${slideDir === 'left' ? 'slideInLeft' : 'slideInRight'} 0.35s ease-out` }}>
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-white">
              Quick setup
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              Add a few basics to get started. You can always edit these later.
            </p>
          </div>

          {/* Section tabs */}
          <div className="flex gap-2">
            {([
              { key: 'meds' as const, label: 'Medications', icon: '💊' },
              { key: 'doctors' as const, label: 'Doctors', icon: '👨‍⚕️' },
              { key: 'appointments' as const, label: 'Appointments', icon: '📅' },
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
                <span className="mr-1">{tab.icon}</span> {tab.label}
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
            <h1 className="font-display text-3xl font-bold text-white">
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
                    <span className="text-xl">{p.icon}</span>
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
              <span className="text-xl">👥</span>
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
                <span className="text-lg">{role === 'patient' ? '👤' : '💜'}</span>
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
                  <span className="text-lg">🎗️</span>
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
            {dataChoice && dataChoice !== 'skip' && (
              <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{dataChoice === 'connect' ? '🏥' : '✏️'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {dataChoice === 'connect' ? 'Health records connected' : 'Manual data entered'}
                    </p>
                    {dataChoice === 'manual' && (manualSummary.meds > 0 || manualSummary.docs > 0 || manualSummary.appts > 0) && (
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
                  <span className="text-lg">🎯</span>
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

          {/* Confetti emojis */}
          <div className="flex justify-center gap-1.5">
            {['💜', '🩺', '💪', '🌟', '❤️'].map((e, i) => (
              <span key={i} className="text-2xl" style={{ animation: `confettiFade 0.4s ease-out ${0.3 + i * 0.1}s both` }}>{e}</span>
            ))}
          </div>

          <button
            onClick={saveAndFinish}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
