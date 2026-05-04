'use client'

import { useState, useRef } from 'react'
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

async function patchProfile(careProfileId: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`/api/care-profiles/${careProfileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.ok
  } catch {
    return false
  }
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
  const [saveError, setSaveError] = useState('')
  const stepKey = useRef(0)

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
    setSaveError('')
    const ok = await patchProfile(careProfileId, data)
    setSaving(false)
    if (!ok) {
      setSaveError("We couldn't save that — please check your connection and try again.")
      return
    }
    stepKey.current += 1
    setStep((s) => s + 1)
  }

  const handleNotifications = async (enable: boolean) => {
    if (enable && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        await Notification.requestPermission()
      }
    }
    await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ careProfileId }),
    }).catch(() => {})
    onComplete()
  }

  const bar = <WizardProgressBar currentStep={step} totalSteps={TOTAL_STEPS} onStepClick={handleStepClick} />

  const stepAnim: React.CSSProperties = { animation: 'wizardStepIn 0.25s ease both' }

  const SaveError = saveError ? (
    <div role="alert" className="flex items-start gap-2 rounded-lg px-3 py-2.5"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
      <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <p className="text-xs text-red-400/90">{saveError}</p>
    </div>
  ) : null

  const NextButton = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
    <button type="button" disabled={disabled || saving} onClick={onClick}
      className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed mt-2"
      style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
      {saving ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Saving…
        </span>
      ) : 'Continue →'}
    </button>
  )

  if (step === 1) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" key={stepKey.current} style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">About the person you&apos;re caring for</h2>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label htmlFor="cg-patient-name" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Their name <span aria-hidden="true">*</span></label>
          <input id="cg-patient-name" value={patientName} onChange={e => setPatientName(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} placeholder="e.g. Mom, Dad, Sarah…" autoComplete="name" />
        </div>
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label htmlFor="cg-relationship" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Your relationship <span aria-hidden="true">*</span></label>
          <select id="cg-relationship" value={relationship} onChange={e => setRelationship(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: relationship ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}>
            <option value="">How are you connected?</option>
            {RELATIONSHIPS.map(r => <option key={r} value={r.toLowerCase().replace(/ /g, '_')}>{r}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Your caregiving experience <span className="text-white/20">(optional)</span></p>
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
      {SaveError}
      <NextButton onClick={() => advance({ patientName, relationship, caregivingExperience: experience || null })} disabled={!patientName.trim() || !relationship} />
    </div>
  )

  if (step === 2) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" key={stepKey.current} style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">What&apos;s weighing on you most right now?</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>We&apos;ll personalize your AI companion around this.</p>
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
      {SaveError}
      <NextButton onClick={() => advance({ primaryConcern: concern })} disabled={!concern} />
    </div>
  )

  if (step === 3) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" key={stepKey.current} style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Connect Apple Health 🍎</h2>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Ask {patientName || 'them'} to connect their hospital through Apple Health on their phone.
        Once they do, their diagnosis, medications, and lab results will automatically appear here.
      </p>
      {careGroupId && (
        <button type="button"
          onClick={async () => {
            const res = await fetch('/api/care-group/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ careGroupId }) })
            const data = await res.json()
            if (data.url && navigator.share) await navigator.share({ title: 'Join my Care Group', url: data.url })
            else if (data.url) { await navigator.clipboard.writeText(data.url) }
          }}
          className="rounded-xl py-3 text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
          Resend invite link
        </button>
      )}
      <button type="button" onClick={() => { stepKey.current += 1; setStep(4) }}
        className="rounded-xl py-3.5 text-sm font-semibold text-white mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        Got it, continue →
      </button>
    </div>
  )

  if (step === 4) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" key={stepKey.current} style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <div>
        <h2 className="text-lg font-bold text-white mt-2">About the diagnosis</h2>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          This updates automatically once {patientName || 'they'} connect Apple Health. You can always edit it later.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label htmlFor="cg-cancer-type" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Cancer type</label>
          <select id="cg-cancer-type" value={cancerType} onChange={e => setCancerType(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: cancerType ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}>
            <option value="">Select if known</option>
            {CANCER_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
          </select>
        </div>
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label htmlFor="cg-stage" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Stage</label>
          <select id="cg-stage" value={stage} onChange={e => setStage(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: stage ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}>
            <option value="">Select if known</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label htmlFor="cg-phase" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Where are they in treatment?</label>
          <select id="cg-phase" value={phase} onChange={e => setPhase(e.target.value)} className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: phase ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}>
            <option value="">Select if known</option>
            {PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
          </select>
        </div>
      </div>
      {SaveError}
      <NextButton onClick={() => advance({ cancerType: cancerType || null, cancerStage: stage || null, treatmentPhase: phase || null })} />
      <button type="button" onClick={() => { stepKey.current += 1; setStep(5) }} className="text-xs text-center transition-colors hover:text-white/50" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Skip — I&apos;ll fill this in later
      </button>
    </div>
  )

  if (step === 5) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" key={stepKey.current} style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <div>
        <h2 className="text-lg font-bold text-white mt-2">What matters most to you?</h2>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Pick up to 3 areas — we&apos;ll focus your dashboard on these.</p>
      </div>
      <div className="flex flex-col gap-2">
        {PRIORITIES.map(p => {
          const selected = priorities.includes(p)
          const atLimit = priorities.length >= 3 && !selected
          return (
            <button key={p} type="button"
              onClick={() => setPriorities(prev => selected ? prev.filter(x => x !== p) : prev.length < 3 ? [...prev, p] : prev)}
              className="rounded-xl px-4 py-3 text-left text-sm transition-all"
              style={{
                background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                color: selected ? '#c4b5fd' : atLimit ? 'rgba(255,255,255,0.3)' : '#f1f5f9',
                opacity: atLimit ? 0.5 : 1,
              }}>
              {PRIORITY_LABELS[p]}
              {atLimit && <span className="text-[10px] ml-2" style={{ color: 'rgba(255,255,255,0.3)' }}>(limit reached)</span>}
            </button>
          )
        })}
      </div>
      {SaveError}
      <NextButton onClick={() => advance({ onboardingPriorities: priorities })} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="text-5xl">🔔</div>
        <h2 className="text-lg font-bold text-white">You&apos;re almost set up</h2>
        <p className="text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Never miss an important update — we&apos;ll reach out when something needs your attention.
        </p>
      </div>
      <button type="button" onClick={() => handleNotifications(true)}
        className="rounded-xl py-3.5 text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        Turn on notifications
      </button>
      <button type="button" onClick={() => handleNotifications(false)}
        className="rounded-xl py-3.5 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
        Maybe later
      </button>
    </div>
  )
}
