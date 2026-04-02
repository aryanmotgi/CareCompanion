'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SegmentControl } from './SegmentControl'
import { ExpandableCard } from './ExpandableCard'
import { BottomSheet } from './BottomSheet'
import { useToast } from './ToastProvider'
import type { Medication, Appointment, Doctor } from '@/lib/types'

interface CareViewProps {
  profileId: string
  medications: Medication[]
  appointments: Appointment[]
  doctors: Doctor[]
}

export function CareView({ profileId, medications: initialMeds, appointments: initialAppts, doctors }: CareViewProps) {
  const { showToast } = useToast()
  const [activeSegment, setActiveSegment] = useState(0)
  const [medications, setMedications] = useState(initialMeds)
  const [appointments, setAppointments] = useState(initialAppts)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showMedForm, setShowMedForm] = useState(false)
  const [showApptForm, setShowApptForm] = useState(false)

  // Form state for adding
  const [medName, setMedName] = useState('')
  const [medDose, setMedDose] = useState('')
  const [medFreq, setMedFreq] = useState('')
  const [apptDoctor, setApptDoctor] = useState('')
  const [apptSpecialty, setApptSpecialty] = useState('')
  const [apptDate, setApptDate] = useState('')
  const [apptLocation, setApptLocation] = useState('')
  const [apptPurpose, setApptPurpose] = useState('')

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[#e2e8f0] text-sm outline-none placeholder:text-[#64748b] mb-3'

  const now = new Date()

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr)
    return Math.ceil((d.getTime() - now.getTime()) / 86400000)
  }

  // Lookup doctor phone by name
  const getDoctorPhone = (doctorName: string | null) => {
    if (!doctorName) return null
    const doc = doctors.find((d) => d.name.toLowerCase() === doctorName.toLowerCase())
    return doc?.phone || null
  }

  const needsRefill = medications.filter((m) => m.refill_date && daysUntil(m.refill_date) <= 3)
  const activeMeds = medications.filter((m) => !m.refill_date || daysUntil(m.refill_date) > 3)

  const thisWeekAppts = appointments.filter((a) => {
    if (!a.date_time) return false
    const days = daysUntil(a.date_time)
    return days >= 0 && days <= 7
  })
  const upcomingAppts = appointments.filter((a) => a.date_time && daysUntil(a.date_time) > 7)

  const handleAddMed = async () => {
    if (!medName) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('medications').insert({
        care_profile_id: profileId,
        name: medName,
        dose: medDose,
        frequency: medFreq,
      }).select().single()
      if (error) throw error
      if (data) setMedications([...medications, data])
      setMedName(''); setMedDose(''); setMedFreq('')
      setShowMedForm(false)
      showToast('Medication added', 'success')
    } catch (err) {
      console.error('[CareView] Failed to add medication:', err)
      showToast('Failed to add medication', 'error')
    }
  }

  const handleAddAppt = async () => {
    if (!apptDoctor || !apptDate) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('appointments').insert({
        care_profile_id: profileId,
        doctor_name: apptDoctor,
        specialty: apptSpecialty,
        date_time: new Date(apptDate).toISOString(),
        location: apptLocation,
        purpose: apptPurpose,
      }).select().single()
      if (error) throw error
      if (data) setAppointments([...appointments, data])
      setApptDoctor(''); setApptSpecialty(''); setApptDate(''); setApptLocation(''); setApptPurpose('')
      setShowApptForm(false)
      showToast('Appointment added', 'success')
    } catch (err) {
      console.error('[CareView] Failed to add appointment:', err)
      showToast('Failed to add appointment', 'error')
    }
  }

  const handleDeleteMed = async (id: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('medications').delete().eq('id', id)
      if (error) throw error
      setMedications(medications.filter((m) => m.id !== id))
      setExpandedId(null)
      showToast('Medication removed', 'success')
    } catch (err) {
      console.error('[CareView] Failed to delete medication:', err)
      showToast('Failed to remove medication', 'error')
    }
  }

  const handleDeleteAppt = async (id: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('appointments').delete().eq('id', id)
      if (error) throw error
      setAppointments(appointments.filter((a) => a.id !== id))
      setExpandedId(null)
      showToast('Appointment removed', 'success')
    } catch (err) {
      console.error('[CareView] Failed to delete appointment:', err)
      showToast('Failed to remove appointment', 'error')
    }
  }

  const renderMedCard = (med: Medication, i: number) => {
    const refillSoon = med.refill_date && daysUntil(med.refill_date) <= 3
    const lowQty = (med.quantity_remaining ?? 999) <= 5
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
              <div><span className="text-[#64748b]">Doctor:</span> <span className="text-[#e2e8f0]">{med.prescribing_doctor || '—'}</span></div>
              <div><span className="text-[#64748b]">Refill:</span> <span className={refillSoon ? 'text-[#ef4444]' : 'text-[#e2e8f0]'}>{med.refill_date ? new Date(med.refill_date).toLocaleDateString() : '—'}</span></div>
              <div><span className="text-[#64748b]">Remaining:</span> <span className={lowQty ? 'text-[#fbbf24]' : 'text-[#e2e8f0]'}>{med.quantity_remaining ?? '—'}</span></div>
              <div><span className="text-[#64748b]">Frequency:</span> <span className="text-[#e2e8f0]">{med.frequency || '—'}</span></div>
            </div>
            <div className="flex gap-2">
              {med.pharmacy_phone && (
                <a href={`tel:${med.pharmacy_phone}`} className="flex-1 text-center py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-xs font-semibold animate-press">
                  Call Pharmacy
                </a>
              )}
              <button
                onClick={() => handleDeleteMed(med.id)}
                className="flex-1 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold animate-press"
              >
                Delete
              </button>
            </div>
          </div>
        }
      >
        <div>
          <div className="text-[#f1f5f9] text-[15px] font-semibold">{med.name}</div>
          <div className="text-[#94a3b8] text-xs">{med.dose}{med.frequency ? ` • ${med.frequency}` : ''}</div>
        </div>
      </ExpandableCard>
    )
  }

  const renderApptCard = (appt: Appointment, i: number) => {
    const apptDateTime = new Date(appt.date_time ?? '')
    const timeStr = apptDateTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const dateStr = apptDateTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    const doctorPhone = getDoctorPhone(appt.doctor_name)

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
            <div className="flex gap-2">
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
              <a href={`/chat?prompt=${encodeURIComponent(`Help me prepare for my ${appt.specialty} appointment with ${appt.doctor_name}`)}`} className="flex-1 text-center py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-xs font-semibold animate-press">
                Prepare
              </a>
              <button
                onClick={() => handleDeleteAppt(appt.id)}
                className="flex-1 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold animate-press"
              >
                Delete
              </button>
            </div>
          </div>
        }
      >
        <div>
          <div className="text-[#f1f5f9] text-[15px] font-semibold">{appt.doctor_name}</div>
          <div className="text-[#94a3b8] text-xs">{appt.specialty} • {dateStr} at {timeStr}</div>
        </div>
      </ExpandableCard>
    )
  }

  return (
    <div className="px-5 py-6">
      <SegmentControl
        segments={['Medications', 'Appointments']}
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold animate-press"
          >
            + Add Medication
          </button>
        </div>
      )}

      {activeSegment === 1 && (
        <div className="mt-5 space-y-5">
          {thisWeekAppts.length > 0 && (
            <div>
              <div className="text-[#22d3ee] text-[11px] uppercase tracking-wider font-semibold mb-2">This Week</div>
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold animate-press"
          >
            + Add Appointment
          </button>
        </div>
      )}

      {/* Add Medication Form */}
      <BottomSheet isOpen={showMedForm} onClose={() => setShowMedForm(false)} title="Add Medication">
        <input className={inputClass} placeholder="Medication name" value={medName} onChange={(e) => setMedName(e.target.value)} />
        <input className={inputClass} placeholder="Dose (e.g., 10mg)" value={medDose} onChange={(e) => setMedDose(e.target.value)} />
        <input className={inputClass} placeholder="Frequency (e.g., Once daily)" value={medFreq} onChange={(e) => setMedFreq(e.target.value)} />
        <button onClick={handleAddMed} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold">Save</button>
      </BottomSheet>

      {/* Add Appointment Form */}
      <BottomSheet isOpen={showApptForm} onClose={() => setShowApptForm(false)} title="Add Appointment">
        <input className={inputClass} placeholder="Doctor name" value={apptDoctor} onChange={(e) => setApptDoctor(e.target.value)} />
        <input className={inputClass} placeholder="Specialty" value={apptSpecialty} onChange={(e) => setApptSpecialty(e.target.value)} />
        <input className={inputClass} type="datetime-local" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
        <input className={inputClass} placeholder="Location" value={apptLocation} onChange={(e) => setApptLocation(e.target.value)} />
        <input className={inputClass} placeholder="Purpose" value={apptPurpose} onChange={(e) => setApptPurpose(e.target.value)} />
        <button onClick={handleAddAppt} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold">Save</button>
      </BottomSheet>
    </div>
  )
}
