'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface OnboardingWizardProps {
  userName: string;
  existingProfileId: string | null;
}

const CANCER_TYPES = [
  'Breast cancer',
  'Lung cancer',
  'Colorectal cancer',
  'Prostate cancer',
  'Melanoma',
  'Lymphoma',
  'Leukemia',
  'Pancreatic cancer',
  'Ovarian cancer',
  'Bladder cancer',
  'Kidney cancer',
  'Thyroid cancer',
  'Brain cancer',
  'Liver cancer',
  'Stomach cancer',
  'Other',
];

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

export function OnboardingWizard({ userName, existingProfileId }: OnboardingWizardProps) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Who is this for
  const [role, setRole] = useState<'patient' | 'caregiver' | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [relationship, setRelationship] = useState('');

  // Step 2: Diagnosis
  const [cancerType, setCancerType] = useState('');
  const [cancerStage, setCancerStage] = useState('');
  const [treatmentPhase, setTreatmentPhase] = useState('');

  // Step 3: Data source (handled inline)

  // Step 4: Priorities
  const [priorities, setPriorities] = useState<string[]>([]);

  const togglePriority = (value: string) => {
    setPriorities((prev) =>
      prev.includes(value)
        ? prev.filter((p) => p !== value)
        : prev.length < 3
          ? [...prev, value]
          : prev
    );
  };

  const firstName = userName.split(' ')[0];

  const saveAndFinish = async (dataSource: 'connect' | 'scan' | 'manual' | 'demo' | 'skip') => {
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

      if (existingProfileId) {
        await supabase.from('care_profiles').update(profileData).eq('id', existingProfileId);
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

      // Route based on data source choice
      if (dataSource === 'demo') {
        await fetch('/api/seed-demo', { method: 'POST' });
        router.push('/dashboard');
      } else if (dataSource === 'connect') {
        router.push('/connect');
      } else if (dataSource === 'scan') {
        router.push('/scans');
      } else if (dataSource === 'manual') {
        router.push('/manual-setup');
      } else {
        router.push('/dashboard');
      }
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
    if (step === 4) return true; // Optional
    return true;
  };

  return (
    <div className="space-y-8">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
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

      {/* Step 1: Welcome + Who is this for */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="text-center">
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
            onClick={() => setStep(2)}
            disabled={!canProceed()}
            className="w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Diagnosis */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-white">
              About the diagnosis
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              This helps us personalize your experience. Skip anything you&apos;re not sure about.
            </p>
          </div>

          <div className="space-y-4">
            {/* Cancer type */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Cancer type</label>
              <select
                value={cancerType}
                onChange={(e) => setCancerType(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-3 px-4 text-white focus:outline-none focus:border-[#A78BFA]/40 transition-colors"
              >
                <option value="">Select type...</option>
                {CANCER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

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
              onClick={() => setStep(1)}
              className="flex-shrink-0 rounded-xl border border-[var(--border)] py-3.5 px-5 text-sm text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Continue
            </button>
          </div>
          <button
            onClick={() => setStep(3)}
            className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}

      {/* Step 3: Connect your data */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in-up">
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
              onClick={() => saveAndFinish('connect')}
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

            {/* Scan Documents */}
            <button
              onClick={() => saveAndFinish('scan')}
              disabled={loading}
              className="w-full text-left rounded-2xl p-5 border border-[var(--border)] bg-[var(--bg-card)] hover:border-violet-400/30 hover:bg-violet-500/5 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center text-xl group-hover:bg-violet-500/25 transition-colors">
                  📸
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Scan Documents</p>
                  <p className="text-sm text-[var(--text-muted)]">Take photos of lab reports, prescriptions, insurance cards</p>
                </div>
                <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>

            {/* Enter Manually */}
            <button
              onClick={() => saveAndFinish('manual')}
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
              onClick={() => saveAndFinish('demo')}
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
              onClick={() => setStep(2)}
              className="flex-shrink-0 rounded-xl border border-[var(--border)] py-3.5 px-5 text-sm text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-3.5"
            >
              Skip — I&apos;ll add data later
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Priorities */}
      {step === 4 && (
        <div className="space-y-6 animate-fade-in-up">
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
              onClick={() => setStep(3)}
              className="flex-shrink-0 rounded-xl border border-[var(--border)] py-3.5 px-5 text-sm text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => saveAndFinish('skip')}
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
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
                "Let's go!"
              )}
            </button>
          </div>
        </div>
      )}

      {loading && step === 3 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] rounded-2xl p-8 text-center space-y-4">
            <svg className="animate-spin h-8 w-8 text-[#A78BFA] mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-white font-medium">Setting up your account...</p>
          </div>
        </div>
      )}
    </div>
  );
}
