'use client'

import { useState } from 'react'
import { SegmentControl } from './SegmentControl'
import { ExpandableCard } from './ExpandableCard'
import { BottomSheet } from './BottomSheet'
import { useToast } from './ToastProvider'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { ConflictsView } from './ConflictsView'
import { VisitPrepSheet } from './VisitPrepSheet'
import { MedicationReminders } from './MedicationReminders'
import type { Medication, Appointment, Doctor, CareProfile, CareTeamMember, ReminderLog, LabResult, SymptomEntry } from '@/lib/types'

const LabsView = dynamic(() => import('@/app/(app)/labs/LabsView').then((m) => m.LabsView))
const SymptomJournal = dynamic(() => import('./SymptomJournal').then((m) => m.SymptomJournal))
const CareTeamView = dynamic(() => import('./CareTeamView').then((m) => m.CareTeamView))

const TAB_MAP: Record<string, number> = { meds: 0, appts: 1, labs: 2, journal: 3, team: 4 }

interface CareViewProps {
  profileId: string
  medications: Medication[]
  appointments: Appointment[]
  doctors: Doctor[]
  allProfiles?: CareProfile[]
  careTeamMembers?: CareTeamMember[]
  todayReminders?: ReminderLog[]
  labResults?: LabResult[]
  symptoms?: SymptomEntry[]
  patientName?: string
}

const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[var(--text)] text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[#A78BFA]/40 transition-colors'

export function CareView({ profileId, medications: initialMeds, appointments: initialAppts, doctors, allProfiles = [], careTeamMembers = [], todayReminders = [], labResults = [], symptoms = [], patientName = 'Patient' }: CareViewProps) {
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const [activeSegment, setActiveSegment] = useState(() => TAB_MAP[searchParams.get('tab') ?? ''] ?? 0)
  const [medications, setMedications] = useState(initialMeds)
  const [appointments, setAppointments] = useState(initialAppts)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showMedForm, setShowMedForm] = useState(false)
  const [showApptForm, setShowApptForm] = useState(false)
  const [savingMed, setSavingMed] = useState(false)
  const [savingAppt, setSavingAppt] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Confirm dialog state
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'med' | 'appt'; name: string } | null>(null)

  // Form state
  const [medName, setMedName] = useState('')
  const [medDose, setMedDose] = useState('')
  const [medFreq, setMedFreq] = useState('')
  const [apptDoctor, setApptDoctor] = useState('')
  const [apptSpecialty, setApptSpecialty] = useState('')
  const [apptDate, setApptDate] = useState('')
  const [apptLocation, setApptLocation] = useState('')
  const [apptPurpose, setApptPurpose] = useState('')

  const now = new Date()

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr)
    return Math.ceil((d.getTime() - now.getTime()) / 86400000)
  }

  const getDoctorPhone = (doctorName: string | null) => {
    if (!doctorName) return null
    const doc = doctors.find((d) => d.name.toLowerCase() === doctorName.toLowerCase())
    return doc?.phone || null
  }

  const needsRefill = medications.filter((m) => m.refillDate && daysUntil(m.refillDate) <= 3)
  const activeMeds = medications.filter((m) => !m.refillDate || daysUntil(m.refillDate) > 3)

  const thisWeekAppts = appointments.filter((a) => {
    if (!a.dateTime) return false
    const days = daysUntil(a.dateTime.toISOString())
    return days >= 0 && days <= 7
  })
  const upcomingAppts = appointments.filter((a) => a.dateTime && daysUntil(a.dateTime.toISOString()) > 7)

  const handleAddMed = async () => {
    if (!medName.trim()) return
    setSavingMed(true)
    try {
      const res = await fetch('/api/records/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          care_profile_id: profileId,
          name: medName.trim(),
          dose: medDose || null,
          frequency: medFreq || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      if (json.data) setMedications([...medications, json.data])
      setMedName(''); setMedDose(''); setMedFreq('')
      setShowMedForm(false)
      showToast('Medication added', 'success')
    } catch {
      showToast('Failed to add medication', 'error')
    } finally {
      setSavingMed(false)
    }
  }

  const handleAddAppt = async () => {
    if (!apptDoctor.trim() || !apptDate) return
    setSavingAppt(true)
    try {
      const res = await fetch('/api/records/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          care_profile_id: profileId,
          doctorName: apptDoctor.trim(),
          specialty: apptSpecialty || null,
          date_time: new Date(apptDate).toISOString(),
          location: apptLocation || null,
          purpose: apptPurpose || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      if (json.data) setAppointments([...appointments, json.data])
      setApptDoctor(''); setApptSpecialty(''); setApptDate(''); setApptLocation(''); setApptPurpose('')
      setShowApptForm(false)
      showToast('Appointment added', 'success')
    } catch {
      showToast('Failed to add appointment', 'error')
    } finally {
      setSavingAppt(false)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    const { id, type } = confirmDelete
    setDeletingId(id)
    try {
      const endpoint = type === 'med' ? '/api/records/medications' : '/api/records/appointments'
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      if (type === 'med') {
        setMedications(medications.filter((m) => m.id !== id))
      } else {
        setAppointments(appointments.filter((a) => a.id !== id))
      }
      setExpandedId(null)
      showToast(type === 'med' ? 'Medication removed' : 'Appointment removed', 'success')
    } catch {
      showToast(`Failed to remove ${type === 'med' ? 'medication' : 'appointment'}`, 'error')
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  const renderMedCard = (med: Medication, i: number) => {
    const refillSoon = med.refillDate && daysUntil(med.refillDate) <= 3
    return (
      <ExpandableCard
        key={med.id}
        expanded={expandedId === med.id}
        onToggle={() => setExpandedId(expandedId === med.id ? null : med.id)}
        className="animate-press"
        style={{ animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both`, animationDelay: `${i * 60}ms` }}
        expandedContent={
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-[#64748b]">Doctor:</span> <span className="text-[#e2e8f0]">{med.prescribingDoctor || '—'}</span></div>
              <div><span className="text-[#64748b]">Refill:</span> <span className={refillSoon ? 'text-[#ef4444]' : 'text-[#e2e8f0]'}>{med.refillDate ? new Date(med.refillDate).toLocaleDateString() : '—'}</span></div>
              <div><span className="text-[#64748b]">Frequency:</span> <span className="text-[#e2e8f0]">{med.frequency || '—'}</span></div>
              <div><span className="text-[#64748b]">Notes:</span> <span className="text-[#e2e8f0]">{med.notes || '—'}</span></div>
            </div>
            <div className="flex gap-2">
              {med.pharmacyPhone && (
                <a href={`tel:${med.pharmacyPhone}`} className="flex-1 text-center py-2 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-xs font-semibold animate-press">
                  Call Pharmacy
                </a>
              )}
              <a
                href={`/chat?prompt=${encodeURIComponent(`Update my ${med.name} medication — I need to change the details`)}`}
                className="flex-1 text-center py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold animate-press"
              >
                Edit
              </a>
              <button
                onClick={() => setConfirmDelete({ id: med.id, type: 'med', name: med.name })}
                disabled={deletingId === med.id}
                className="flex-1 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#ef4444] text-xs font-semibold animate-press disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        }
      >
        <div>
          <div className="text-[#f1f5f9] text-[15px] font-semibold">{med.name}</div>
          <div className="text-[#94a3b8] text-xs">
            {med.dose || med.frequency
              ? `${med.dose || ''}${med.dose && med.frequency ? ' · ' : ''}${med.frequency || ''}`
              : 'Tap to add details'}
          </div>
        </div>
      </ExpandableCard>
    )
  }

  const renderApptCard = (appt: Appointment, i: number) => {
    const apptDateTime = appt.dateTime ? new Date(appt.dateTime) : null
    const timeStr = apptDateTime ? apptDateTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
    const dateStr = apptDateTime ? apptDateTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date'
    const doctorPhone = getDoctorPhone(appt.doctorName)

    return (
      <ExpandableCard
        key={appt.id}
        expanded={expandedId === appt.id}
        onToggle={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
        className="animate-press"
        style={{ animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both`, animationDelay: `${i * 60}ms` }}
        expandedContent={
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-[#64748b]">Location:</span> <span className="text-[#e2e8f0]">{appt.location || '—'}</span></div>
              <div><span className="text-[#64748b]">Purpose:</span> <span className="text-[#e2e8f0]">{appt.purpose || '—'}</span></div>
            </div>
            <VisitPrepSheet
              appointmentId={appt.id}
              doctorName={appt.doctorName || 'Doctor'}
              dateTime={appt.dateTime ? appt.dateTime.toISOString() : null}
              existingPrep={null}
            />
            <div className="flex gap-2 mt-2">
              {doctorPhone && (
                <a href={`tel:${doctorPhone}`} className="flex-1 text-center py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold animate-press">
                  Call Office
                </a>
              )}
              {appt.location && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(appt.location)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold animate-press">
                  Directions
                </a>
              )}
              <button
                onClick={() => setConfirmDelete({ id: appt.id, type: 'appt', name: appt.doctorName || 'this appointment' })}
                disabled={deletingId === appt.id}
                className="flex-1 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#ef4444] text-xs font-semibold animate-press disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        }
      >
        <div>
          <div className="text-[#f1f5f9] text-[15px] font-semibold">{appt.doctorName}</div>
          <div className="text-[#94a3b8] text-xs">{appt.specialty} · {dateStr} at {timeStr}</div>
        </div>
      </ExpandableCard>
    )
  }

  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      <SegmentControl
        segments={['Meds', 'Appts', 'Labs', 'Journal', 'Team']}
        activeIndex={activeSegment}
        onChange={(idx) => { setActiveSegment(idx); setExpandedId(null) }}
      />

      {activeSegment === 0 && (
        <div className="mt-5 space-y-5">
          {needsRefill.length > 0 && (
            <div>
              <div className="text-[#ef4444] text-[11px] uppercase tracking-wider font-semibold mb-2">Needs Refill</div>
              <div className="space-y-2">{needsRefill.map((m, i) => renderMedCard(m, i))}</div>
            </div>
          )}
          <div>
            <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Active Medications</div>
            {activeMeds.length === 0 && needsRefill.length === 0 ? (
              <div className="text-center py-8 text-[#64748b] text-sm">No medications added yet</div>
            ) : (
              <div className="space-y-2">{activeMeds.map((m, i) => renderMedCard(m, i + needsRefill.length))}</div>
            )}
          </div>
          <button
            onClick={() => setShowMedForm(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold animate-press shimmer-btn relative overflow-hidden"
          >
            + Add Medication
          </button>
          <MedicationReminders reminders={todayReminders} />
        </div>
      )}

      {activeSegment === 1 && (
        <div className="mt-5 space-y-5">
          {thisWeekAppts.length > 0 && (
            <div>
              <div className="text-[#A78BFA] text-[11px] uppercase tracking-wider font-semibold mb-2">This Week</div>
              <div className="space-y-2">{thisWeekAppts.map((a, i) => renderApptCard(a, i))}</div>
            </div>
          )}
          <div>
            <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Upcoming</div>
            {upcomingAppts.length === 0 && thisWeekAppts.length === 0 ? (
              <div className="text-center py-8 text-[#64748b] text-sm">No appointments scheduled</div>
            ) : (
              <div className="space-y-2">{upcomingAppts.map((a, i) => renderApptCard(a, i + thisWeekAppts.length))}</div>
            )}
          </div>
          <button
            onClick={() => setShowApptForm(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold animate-press shimmer-btn relative overflow-hidden"
          >
            + Add Appointment
          </button>
        </div>
      )}

      {activeSegment === 2 && (
        <div className="mt-5">
          <LabsView labResults={labResults} />
        </div>
      )}

      {activeSegment === 3 && (
        <div className="mt-5">
          <SymptomJournal patientName={patientName} initialEntries={symptoms} />
        </div>
      )}

      {activeSegment === 4 && (
        <div className="mt-5">
          <CareTeamView />
          <div className="mt-6">
            <ConflictsView
              profiles={allProfiles}
              currentProfileId={profileId}
              careTeamMembers={careTeamMembers}
            />
          </div>
        </div>
      )}

      {/* Add Medication Form */}
      <BottomSheet isOpen={showMedForm} onClose={() => setShowMedForm(false)} title="Add Medication">
        <div className="space-y-3">
          <div>
            <label className="text-[#94a3b8] text-xs mb-1 block">Medication name <span className="text-[#ef4444]">*</span></label>
            <input className={inputClass} placeholder="e.g., Metformin" value={medName} onChange={(e) => setMedName(e.target.value)} />
          </div>
          <div>
            <label className="text-[#94a3b8] text-xs mb-1 block">Dose</label>
            <input className={inputClass} placeholder="e.g., 10mg" value={medDose} onChange={(e) => setMedDose(e.target.value)} />
          </div>
          <div>
            <label className="text-[#94a3b8] text-xs mb-1 block">Frequency</label>
            <input className={inputClass} placeholder="e.g., Once daily" value={medFreq} onChange={(e) => setMedFreq(e.target.value)} />
          </div>
          <button
            onClick={handleAddMed}
            disabled={!medName.trim() || savingMed}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {savingMed && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {savingMed ? 'Saving...' : 'Save'}
          </button>
        </div>
      </BottomSheet>

      {/* Add Appointment Form */}
      <BottomSheet isOpen={showApptForm} onClose={() => setShowApptForm(false)} title="Add Appointment">
        <div className="space-y-3">
          <div>
            <label className="text-[#94a3b8] text-xs mb-1 block">Doctor name <span className="text-[#ef4444]">*</span></label>
            <input className={inputClass} placeholder="e.g., Dr. Smith" value={apptDoctor} onChange={(e) => setApptDoctor(e.target.value)} />
          </div>
          <div>
            <label className="text-[#94a3b8] text-xs mb-1 block">Specialty</label>
            <input className={inputClass} placeholder="e.g., Cardiology" value={apptSpecialty} onChange={(e) => setApptSpecialty(e.target.value)} />
          </div>
          <div>
            <label className="text-[#94a3b8] text-xs mb-1 block">Date & time <span className="text-[#ef4444]">*</span></label>
            <input className={inputClass} type="datetime-local" value={apptDate} onChange={(e) => setApptDate(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
          </div>
          <div>
            <label className="text-[#94a3b8] text-xs mb-1 block">Location</label>
            <input className={inputClass} placeholder="e.g., 123 Medical Dr" value={apptLocation} onChange={(e) => setApptLocation(e.target.value)} />
          </div>
          <div>
            <label className="text-[#94a3b8] text-xs mb-1 block">Purpose</label>
            <input className={inputClass} placeholder="e.g., Annual checkup" value={apptPurpose} onChange={(e) => setApptPurpose(e.target.value)} />
          </div>
          <button
            onClick={handleAddAppt}
            disabled={!apptDoctor.trim() || !apptDate || savingAppt}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {savingAppt && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {savingAppt ? 'Saving...' : 'Save'}
          </button>
        </div>
      </BottomSheet>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'med' ? 'Delete Medication' : 'Delete Appointment'}
        description={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={!!deletingId}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(null)}
      />

    </div>
  )
}
