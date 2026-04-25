'use client'

import { useState } from 'react'
import { WizardProgressBar } from './WizardProgressBar'
import { searchHospitals } from '@/lib/hospitals'

const TOTAL_STEPS = 4
const PRIORITIES = ['side_effects', 'medications', 'appointments', 'lab_results', 'insurance', 'emotional_support']
const PRIORITY_LABELS: Record<string, string> = {
  side_effects: 'Side effect tracking', medications: 'Medications', appointments: 'Appointments',
  lab_results: 'Lab results', insurance: 'Insurance', emotional_support: 'Emotional support',
}

async function patchProfile(careProfileId: string, data: Record<string, unknown>) {
  await fetch(`/api/care-profiles/${careProfileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
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
  const [hospitalQuery, setHospitalQuery] = useState('')
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

  const handleNotifications = async (enable: boolean) => {
    if (enable && 'Notification' in window && Notification.permission !== 'granted') {
      await Notification.requestPermission()
    }
    onComplete()
  }

  if (inner === 'healthkit') return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Connect Apple Health 🍎</h2>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Connect your hospital through Apple Health — we&apos;ll automatically pull in your diagnosis, medications, and lab results.
      </p>
      <div className="flex flex-col gap-2">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Search your hospital</label>
          <input value={hospitalQuery} onChange={e => setHospitalQuery(e.target.value)}
            placeholder="e.g. Mayo Clinic, UCSF..."
            className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} />
        </div>
        {hospitalQuery && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', maxHeight: '160px', overflowY: 'auto' }}>
            {filteredHospitals.length > 0 ? filteredHospitals.slice(0, 6).map(h => (
              <button key={h} type="button" onClick={() => setHospitalQuery(h)}
                className="block w-full text-left px-4 py-2 text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.8)' }}>
                {h}
              </button>
            )) : (
              <div className="px-4 py-3">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Your hospital may not support Health Records yet. You can still connect Apple Health for activity, heart rate, and sleep data.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <button type="button"
        onClick={async () => {
          setSaving(true)
          try {
            const res = await fetch(`/api/care-profiles/${careProfileId}`)
            const profile = await res.json()
            setConfirmedData({
              cancerType: profile?.cancerType ?? '',
              stage: profile?.cancerStage ?? '',
              medications: [],
              nextAppointment: '',
            })
            setInner('confirm')
          } finally {
            setSaving(false)
          }
        }}
        disabled={saving}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Connecting...' : 'Connect Apple Health'}
      </button>
      <button type="button" onClick={() => setInner('manual')}
        className="rounded-xl py-3 text-sm font-medium"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
        Skip for now — enter manually
      </button>
    </div>
  )

  if (inner === 'confirm' && confirmedData !== null) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Does this look right?</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Tap any item to edit. Your edits won&apos;t be overwritten by future syncs.</p>
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
      <button type="button" disabled={saving}
        onClick={async () => {
          setSaving(true)
          const overrides: Record<string, boolean> = {}
          if (confirmedData.cancerType) overrides.cancerType = true
          if (confirmedData.stage) overrides.stage = true
          await patchProfile(careProfileId, {
            cancerType: confirmedData.cancerType || null,
            cancerStage: confirmedData.stage || null,
            fieldOverrides: overrides,
          })
          setSaving(false)
          setInner('priorities')
        }}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Looks good →'}
      </button>
    </div>
  )

  if (inner === 'manual') return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Let&apos;s start with what we know</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>You can update this anytime from your profile.</p>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Diagnosis</label>
          <input value={manualDiagnosis} onChange={e => setManualDiagnosis(e.target.value)}
            placeholder="e.g. Breast cancer, stage II"
            className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} />
        </div>
        {manualMeds.map((med, i) => (
          <div key={i} className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Medication {i + 1}</label>
            <input value={med} onChange={e => setManualMeds(prev => prev.map((m, j) => j === i ? e.target.value : m))}
              placeholder={i === 0 ? 'e.g. Tamoxifen 20mg' : 'Optional'}
              className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} />
          </div>
        ))}
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Next appointment date</label>
          <input type="date" value={manualAppt} onChange={e => setManualAppt(e.target.value)}
            className="block w-full bg-transparent text-sm focus:outline-none" style={{ color: 'rgba(255,255,255,0.9)' }} />
        </div>
      </div>
      <button type="button" disabled={saving}
        onClick={async () => {
          setSaving(true)
          await patchProfile(careProfileId, {
            cancerType: manualDiagnosis || null,
            fieldOverrides: manualDiagnosis ? { cancerType: true } : {},
          })
          setSaving(false)
          setInner('priorities')
        }}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Continue →'}
      </button>
    </div>
  )

  if (inner === 'priorities') return (
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
        onClick={async () => {
          setSaving(true)
          await patchProfile(careProfileId, { onboardingPriorities: priorities })
          setSaving(false)
          setInner('notifications')
        }}
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
        <h2 className="text-lg font-bold text-white">Stay on top of your care</h2>
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
