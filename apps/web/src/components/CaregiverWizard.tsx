'use client'

import { useState } from 'react'
import { WizardProgressBar } from './WizardProgressBar'

const TOTAL_STEPS = 6

const RELATIONSHIPS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Professional caregiver', 'Other']
const EXPERIENCE_LEVELS = [
  { value: 'first_time', label: 'First time caregiver' },
  { value: 'some_experience', label: 'Some experience' },
  { value: 'experienced', label: 'Experienced caregiver' },
]
const CONCERNS = [
  { value: 'medications', emoji: '💊', label: 'Managing medications', desc: 'Tracking doses, schedules, and refills' },
  { value: 'lab_results', emoji: '🧪', label: 'Understanding lab results', desc: 'Tests and appointments' },
  { value: 'coordinating_care', emoji: '🏥', label: 'Coordinating care', desc: 'Specialists and referrals' },
  { value: 'emotional_support', emoji: '💙', label: 'Emotional support', desc: 'Coping and guidance' },
]
const PRIORITIES = ['side_effects', 'medications', 'appointments', 'lab_results', 'insurance', 'emotional_support']
const PRIORITY_LABELS: Record<string, string> = {
  side_effects: 'Side effect tracking', medications: 'Medications', appointments: 'Appointments',
  lab_results: 'Lab results', insurance: 'Insurance', emotional_support: 'Emotional support',
}
const CANCER_TYPES = ['Breast', 'Lung', 'Colorectal', 'Prostate', 'Lymphoma', 'Leukemia', 'Melanoma', 'Ovarian', 'Pancreatic', 'Thyroid', 'Bladder', 'Brain', 'Other']
const STAGES = ['I', 'II', 'III', 'IV', 'Unsure']
const PHASES = ['just_diagnosed', 'active_treatment', 'between_treatments', 'remission', 'unsure']
const PHASE_LABELS: Record<string, string> = {
  just_diagnosed: 'Just diagnosed', active_treatment: 'Active treatment',
  between_treatments: 'Between treatments', remission: 'Remission', unsure: 'Unsure',
}

async function patchProfile(careProfileId: string, data: Record<string, unknown>) {
  await fetch(`/api/care-profiles/${careProfileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function CaregiverWizard({
  careProfileId,
  careGroupId,
  onComplete,
}: {
  careProfileId: string
  careGroupId?: string
  onComplete: () => void
}) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [patientName, setPatientName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [experience, setExperience] = useState('')
  const [concern, setConcern] = useState('')
  const [cancerType, setCancerType] = useState('')
  const [stage, setStage] = useState('')
  const [phase, setPhase] = useState('')
  const [priorities, setPriorities] = useState<string[]>([])

  const handleStepClick = (targetStep: number) => {
    if (targetStep < step) setStep(targetStep)
  }

  const advance = async (data: Record<string, unknown>) => {
    setSaving(true)
    try { await patchProfile(careProfileId, data) } finally { setSaving(false) }
    setStep((s) => s + 1)
  }

  const handleNotifications = async (enable: boolean) => {
    if (enable && 'Notification' in window) {
      if (Notification.permission === 'granted') { onComplete(); return }
      await Notification.requestPermission()
    }
    onComplete()
  }

  const bar = <WizardProgressBar currentStep={step} totalSteps={TOTAL_STEPS} onStepClick={handleStepClick} />

  if (step === 1) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">About your patient</h2>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Patient name *</label>
          <input value={patientName} onChange={e => setPatientName(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} placeholder="Their name" />
        </div>
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Your relationship *</label>
          <select value={relationship} onChange={e => setRelationship(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }}>
            <option value="">Select...</option>
            {RELATIONSHIPS.map(r => <option key={r} value={r.toLowerCase().replace(/ /g, '_')}>{r}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Your caregiving experience</p>
          <div className="flex flex-col gap-2">
            {EXPERIENCE_LEVELS.map(e => (
              <button key={e.value} type="button" onClick={() => setExperience(e.value)}
                className="rounded-xl px-4 py-3 text-left text-sm transition-all"
                style={{ background: experience === e.value ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', border: experience === e.value ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)', color: experience === e.value ? '#c4b5fd' : '#f1f5f9' }}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button type="button" disabled={!patientName.trim() || !relationship || saving}
        onClick={() => advance({ patientName, relationship, caregivingExperience: experience || null })}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Next →'}
      </button>
    </div>
  )

  if (step === 2) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">What&apos;s your biggest challenge right now?</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>This helps personalize your AI companion.</p>
      <div className="grid grid-cols-2 gap-3">
        {CONCERNS.map(c => (
          <button key={c.value} type="button" onClick={() => setConcern(c.value)}
            className="rounded-xl p-3 text-left transition-all"
            style={{ background: concern === c.value ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', border: concern === c.value ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-2xl mb-2">{c.emoji}</div>
            <div className="text-xs font-semibold" style={{ color: concern === c.value ? '#c4b5fd' : '#f1f5f9' }}>{c.label}</div>
            <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.desc}</div>
          </button>
        ))}
      </div>
      <button type="button" disabled={!concern || saving}
        onClick={() => advance({ primaryConcern: concern })}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Next →'}
      </button>
    </div>
  )

  if (step === 3) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Apple Health 🍎</h2>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Ask your patient to connect their hospital through Apple Health on their phone.
        Once they do, their diagnosis, medications, and lab results will automatically appear here.
      </p>
      {careGroupId && (
        <button type="button"
          onClick={async () => {
            const res = await fetch('/api/care-group/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ careGroupId }) })
            const data = await res.json()
            if (data.url && navigator.share) await navigator.share({ title: 'Join my Care Group', url: data.url })
            else if (data.url) navigator.clipboard.writeText(data.url)
          }}
          className="rounded-xl py-3 text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
          Resend invite link
        </button>
      )}
      <button type="button" onClick={() => setStep(4)}
        className="rounded-xl py-3.5 text-sm font-semibold text-white mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        Got it →
      </button>
    </div>
  )

  if (step === 4) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">About the diagnosis</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        This will be updated automatically once your patient connects Apple Health.
      </p>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Cancer type</label>
          <select value={cancerType} onChange={e => setCancerType(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }}>
            <option value="">Select...</option>
            {CANCER_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
          </select>
        </div>
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Stage</label>
          <select value={stage} onChange={e => setStage(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }}>
            <option value="">Select...</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Treatment phase</label>
          <select value={phase} onChange={e => setPhase(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }}>
            <option value="">Select...</option>
            {PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
          </select>
        </div>
      </div>
      <button type="button" disabled={saving}
        onClick={() => advance({ cancerType: cancerType || null, cancerStage: stage || null, treatmentPhase: phase || null })}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Next →'}
      </button>
      <button type="button" onClick={() => setStep(5)} className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Skip for now
      </button>
    </div>
  )

  if (step === 5) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Your priorities</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Pick up to 3 focus areas.</p>
      <div className="flex flex-col gap-2">
        {PRIORITIES.map(p => {
          const selected = priorities.includes(p)
          return (
            <button key={p} type="button"
              onClick={() => setPriorities(prev => selected ? prev.filter(x => x !== p) : prev.length < 3 ? [...prev, p] : prev)}
              className="rounded-xl px-4 py-3 text-left text-sm transition-all"
              style={{ background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)', color: selected ? '#c4b5fd' : '#f1f5f9' }}>
              {PRIORITY_LABELS[p]}
            </button>
          )
        })}
      </div>
      <button type="button" disabled={saving}
        onClick={() => advance({ onboardingPriorities: priorities })}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Next →'}
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="text-4xl">🔔</div>
        <h2 className="text-lg font-bold text-white">Stay informed</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Stay on top of medications, appointments, and care updates.
        </p>
      </div>
      <button type="button" onClick={() => handleNotifications(true)}
        className="rounded-xl py-3.5 text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        Enable notifications
      </button>
      <button type="button" onClick={() => handleNotifications(false)}
        className="rounded-xl py-3.5 text-sm font-semibold"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
        Maybe later
      </button>
    </div>
  )
}
