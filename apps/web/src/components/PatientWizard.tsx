'use client'

import { useState, useRef } from 'react'
import { WizardProgressBar } from './WizardProgressBar'
import { searchHospitals } from '@/lib/hospitals'

const TOTAL_STEPS = 4
const PRIORITIES = ['side_effects', 'medications', 'appointments', 'lab_results', 'insurance', 'emotional_support']
const PRIORITY_LABELS: Record<string, string> = {
  side_effects: 'Side effect tracking', medications: 'Medications', appointments: 'Appointments',
  lab_results: 'Lab results', insurance: 'Insurance', emotional_support: 'Emotional support',
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

type InnerStep = 'healthkit' | 'confirm' | 'manual' | 'priorities' | 'notifications'

const innerToProgressStep: Record<InnerStep, number> = {
  healthkit: 1, confirm: 2, manual: 2, priorities: 3, notifications: 4,
}

export function PatientWizard({
  careProfileId,
  onComplete,
}: {
  careProfileId: string
  onComplete: () => void
}) {
  const [inner, setInner] = useState<InnerStep>('healthkit')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [hospitalQuery, setHospitalQuery] = useState('')
  const stepKey = useRef(0)
  const [priorities, setPriorities] = useState<string[]>([])
  const [confirmedData, setConfirmedData] = useState<{
    cancerType: string; stage: string; medications: string[]; nextAppointment: string
  } | null>(null)
  const [manualDiagnosis, setManualDiagnosis] = useState('')
  const [manualMeds, setManualMeds] = useState(['', '', ''])
  const [manualAppt, setManualAppt] = useState('')

  const currentStep = innerToProgressStep[inner]
  const filteredHospitals = searchHospitals(hospitalQuery)

  const handleStepClick = (targetStep: number) => {
    if (targetStep >= currentStep) return
    if (targetStep === 1) setInner('healthkit')
    else if (targetStep === 2) setInner(confirmedData ? 'confirm' : 'manual')
    else if (targetStep === 3) setInner('priorities')
  }

  const bar = <WizardProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} onStepClick={handleStepClick} />
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

  const SaveButton = ({ label, onClick, disabled }: { label?: string; onClick: () => void; disabled?: boolean }) => (
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
      ) : (label ?? 'Continue →')}
    </button>
  )

  const handleNotifications = async (enable: boolean) => {
    if (enable && 'Notification' in window && Notification.permission !== 'granted') {
      await Notification.requestPermission()
    }
    await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ careProfileId }),
    }).catch(() => {})
    onComplete()
  }

  if (inner === 'healthkit') return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" key={stepKey.current} style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <div>
        <h2 className="text-lg font-bold text-white mt-2">Connect Apple Health 🍎</h2>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Connect your hospital through Apple Health and we&apos;ll automatically bring in your diagnosis, medications, and lab results — no data entry needed.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label htmlFor="pw-hospital" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Search your hospital</label>
          <input id="pw-hospital" value={hospitalQuery} onChange={e => setHospitalQuery(e.target.value)}
            placeholder="e.g. Mayo Clinic, UCSF, Mass General…"
            className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} />
        </div>
        {hospitalQuery && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', maxHeight: '160px', overflowY: 'auto' }}>
            {filteredHospitals.length > 0 ? filteredHospitals.slice(0, 6).map(h => (
              <button key={h} type="button" onClick={() => setHospitalQuery(h)}
                className="block w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.06]"
                style={{ color: 'rgba(255,255,255,0.8)' }}>
                {h}
              </button>
            )) : (
              <div className="px-4 py-3">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Your hospital may not support Health Records yet — that&apos;s okay. You can still connect Apple Health for activity, heart rate, and sleep.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <button type="button"
        onClick={async () => {
          setSaving(true)
          setSaveError('')
          try {
            const res = await fetch(`/api/care-profiles/${careProfileId}`)
            if (!res.ok) throw new Error('fetch failed')
            const profile = await res.json()
            setConfirmedData({
              cancerType: profile?.cancerType ?? '',
              stage: profile?.cancerStage ?? '',
              medications: [],
              nextAppointment: '',
            })
            stepKey.current += 1
            setInner('confirm')
          } catch {
            setSaveError("Couldn't connect to Apple Health right now. Try again or enter your info manually.")
          } finally {
            setSaving(false)
          }
        }}
        disabled={saving}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Connecting…
          </span>
        ) : 'Connect Apple Health'}
      </button>
      {SaveError}
      <button type="button" onClick={() => { stepKey.current += 1; setInner('manual') }}
        className="rounded-xl py-3 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
        Enter my info manually
      </button>
    </div>
  )

  if (inner === 'confirm' && confirmedData !== null) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" key={stepKey.current} style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <div>
        <h2 className="text-lg font-bold text-white mt-2">Does this look right?</h2>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Tap any field to edit. Your changes won&apos;t be overwritten by future syncs.</p>
      </div>
      <div className="flex flex-col gap-3">
        {[
          { label: '🏥 Diagnosis', key: 'cancerType', value: confirmedData.cancerType },
          { label: '📊 Stage', key: 'stage', value: confirmedData.stage },
          { label: '🗓 Next appointment', key: 'nextAppointment', value: confirmedData.nextAppointment },
        ].map(({ label, key, value }) => (
          <div key={key} className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>{label}</label>
            <input
              value={value}
              onChange={e => setConfirmedData(prev => prev ? { ...prev, [key]: e.target.value } : prev)}
              placeholder={value || 'Not yet available — tap to add'}
              className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }}
            />
          </div>
        ))}
      </div>
      {SaveError}
      <SaveButton label="Looks good, continue →" onClick={async () => {
        setSaving(true)
        setSaveError('')
        const overrides: Record<string, boolean> = {}
        if (confirmedData.cancerType) overrides.cancerType = true
        if (confirmedData.stage) overrides.stage = true
        const ok = await patchProfile(careProfileId, {
          cancerType: confirmedData.cancerType || null,
          cancerStage: confirmedData.stage || null,
          fieldOverrides: overrides,
        })
        setSaving(false)
        if (!ok) { setSaveError("Couldn't save — please check your connection and try again."); return }
        stepKey.current += 1
        setInner('priorities')
      }} />
    </div>
  )

  if (inner === 'manual') return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" key={stepKey.current} style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <div>
        <h2 className="text-lg font-bold text-white mt-2">Let&apos;s start with what we know</h2>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Everything here is optional — you can fill it in or update it anytime.</p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label htmlFor="pw-diagnosis" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Diagnosis</label>
          <input id="pw-diagnosis" value={manualDiagnosis} onChange={e => setManualDiagnosis(e.target.value)}
            placeholder="e.g. Breast cancer, stage II"
            className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} />
        </div>
        {manualMeds.map((med, i) => (
          <div key={i} className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <label htmlFor={`pw-med-${i}`} className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>
              {i === 0 ? 'Current medication' : `Medication ${i + 1}`}
              {i > 0 && <span className="text-white/20 ml-1">(optional)</span>}
            </label>
            <input id={`pw-med-${i}`} value={med} onChange={e => setManualMeds(prev => prev.map((m, j) => j === i ? e.target.value : m))}
              placeholder={i === 0 ? 'e.g. Tamoxifen 20mg' : 'Add another…'}
              className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} />
          </div>
        ))}
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label htmlFor="pw-appt" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Next appointment</label>
          <input id="pw-appt" type="date" value={manualAppt} onChange={e => setManualAppt(e.target.value)}
            className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} />
        </div>
      </div>
      {SaveError}
      <SaveButton onClick={async () => {
        setSaving(true)
        setSaveError('')
        const filledMeds = manualMeds.filter(m => m.trim())
        const ok = await patchProfile(careProfileId, {
          cancerType: manualDiagnosis || null,
          // Store free-text medications in the conditions text field (best effort
          // until the onboarding wizard is wired to the medications table).
          ...(filledMeds.length > 0 && { conditions: filledMeds.join(', ') }),
          fieldOverrides: {
            ...(manualDiagnosis && { cancerType: true }),
            ...(filledMeds.length > 0 && { conditions: true }),
          },
        })
        setSaving(false)
        if (!ok) { setSaveError("Couldn't save — please check your connection and try again."); return }
        stepKey.current += 1
        setInner('priorities')
      }} />
    </div>
  )

  if (inner === 'priorities') return (
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
      <SaveButton onClick={async () => {
        setSaving(true)
        setSaveError('')
        const ok = await patchProfile(careProfileId, { onboardingPriorities: priorities })
        setSaving(false)
        if (!ok) { setSaveError("Couldn't save — please check your connection and try again."); return }
        stepKey.current += 1
        setInner('notifications')
      }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto" style={stepAnim}>
      <style>{`@keyframes wizardStepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {bar}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="text-5xl">🔔</div>
        <h2 className="text-lg font-bold text-white">You&apos;re almost there</h2>
        <p className="text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          We&apos;ll reach out when something needs your attention — a reminder, a care update, or just a check-in.
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
