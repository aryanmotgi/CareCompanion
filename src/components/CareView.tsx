'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SegmentControl } from './SegmentControl'
import { BottomSheet } from './BottomSheet'
import { AnimatedNumber } from './AnimatedNumber'

interface CareViewProps {
  profileId: string
  medications: any[]
  appointments: any[]
}

export function CareView({ profileId, medications: initialMeds, appointments: initialAppts }: CareViewProps) {
  const [activeSegment, setActiveSegment] = useState(0)
  const [medications, setMedications] = useState(initialMeds)
  const [appointments, setAppointments] = useState(initialAppts)
  const [selectedMed, setSelectedMed] = useState<any>(null)
  const [selectedAppt, setSelectedAppt] = useState<any>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [medName, setMedName] = useState('')
  const [medDosage, setMedDosage] = useState('')
  const [medFrequency, setMedFrequency] = useState('')
  const [medRefillDate, setMedRefillDate] = useState('')

  const [apptDoctor, setApptDoctor] = useState('')
  const [apptSpecialty, setApptSpecialty] = useState('')
  const [apptDateTime, setApptDateTime] = useState('')
  const [apptLocation, setApptLocation] = useState('')

  const supabase = createClient()
  const now = new Date()

  const needsRefill = medications.filter((m) => {
    if (!m.refill_date) return false
    const diff = (new Date(m.refill_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 3
  })
  const activeMeds = medications.filter((m) => !needsRefill.includes(m))

  const futureAppts = appointments.filter((a) => a.date_time && new Date(a.date_time) >= now)
  const endOfWeek = new Date(now)
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
  endOfWeek.setHours(23, 59, 59, 999)
  const thisWeekAppts = futureAppts.filter((a) => new Date(a.date_time) <= endOfWeek)
  const laterAppts = futureAppts.filter((a) => new Date(a.date_time) > endOfWeek)

  const daysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    return `In ${diff} days`
  }

  const handleAddMed = async () => {
    if (!medName) return
    setSaving(true)
    const { data } = await supabase
      .from('medications')
      .insert({ care_profile_id: profileId, name: medName, dosage: medDosage, frequency: medFrequency, refill_date: medRefillDate || null })
      .select()
      .single()
    if (data) {
      setMedications([...medications, data].sort((a, b) => a.name.localeCompare(b.name)))
      setMedName(''); setMedDosage(''); setMedFrequency(''); setMedRefillDate('')
      setShowAddForm(false)
    }
    setSaving(false)
  }

  const handleAddAppt = async () => {
    if (!apptDoctor || !apptDateTime) return
    setSaving(true)
    const { data } = await supabase
      .from('appointments')
      .insert({ care_profile_id: profileId, doctor_name: apptDoctor, specialty: apptSpecialty, date_time: apptDateTime, location: apptLocation })
      .select()
      .single()
    if (data) {
      setAppointments([...appointments, data].sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()))
      setApptDoctor(''); setApptSpecialty(''); setApptDateTime(''); setApptLocation('')
      setShowAddForm(false)
    }
    setSaving(false)
  }

  const handleDeleteMed = async (id: string) => {
    await supabase.from('medications').delete().eq('id', id)
    setMedications(medications.filter((m) => m.id !== id))
    setSelectedMed(null)
  }

  const handleDeleteAppt = async (id: string) => {
    await supabase.from('appointments').delete().eq('id', id)
    setAppointments(appointments.filter((a) => a.id !== id))
    setSelectedAppt(null)
  }

  const inputClass = "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#38bdf8]/50"

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[#f1f5f9] text-xl font-bold">Care</h2>
        <button onClick={() => setShowAddForm(true)} className="w-8 h-8 rounded-full bg-[#38bdf8]/10 flex items-center justify-center animate-press">
          <svg width="16" height="16" fill="none" stroke="#38bdf8" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="mb-5">
        <SegmentControl segments={['Medications', 'Appointments']} activeIndex={activeSegment} onChange={setActiveSegment} />
      </div>

      {activeSegment === 0 && (
        <div>
          {needsRefill.length > 0 && (
            <>
              <div className="text-[10px] text-[#64748b] font-semibold tracking-wider mb-2">REFILL NEEDED</div>
              {needsRefill.map((med, i) => (
                <button
                  key={med.id}
                  onClick={() => setSelectedMed(med)}
                  className="w-full text-left gradient-border-card bg-[#1e293b] border border-red-500/20 rounded-xl p-3.5 mb-2 flex justify-between items-center card-hover-lift animate-press"
                  style={{ animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) ${i * 100}ms both, glow-pulse 2s ease-in-out infinite` }}
                >
                  <div>
                    <div className="text-[#f1f5f9] text-sm font-semibold">{med.name} {med.dosage}</div>
                    <div className="text-[#94a3b8] text-[11px] mt-0.5">{med.frequency}</div>
                    <div className="text-[#fca5a5] text-[11px] mt-0.5">Refill {daysUntil(med.refill_date).toLowerCase()}</div>
                  </div>
                  <div className="bg-red-500/10 rounded-lg px-2.5 py-1.5">
                    <span className="text-[#fca5a5] text-[11px] font-semibold">Refill</span>
                  </div>
                </button>
              ))}
            </>
          )}

          {activeMeds.length > 0 && (
            <>
              <div className="text-[10px] text-[#64748b] font-semibold tracking-wider mb-2 mt-4">ACTIVE</div>
              {activeMeds.map((med, i) => (
                <button
                  key={med.id}
                  onClick={() => setSelectedMed(med)}
                  className="w-full text-left gradient-border-card bg-[#1e293b] border border-white/[0.06] rounded-xl p-3.5 mb-2 flex justify-between items-center animate-card-in card-hover-lift animate-press"
                  style={{ animationDelay: `${(needsRefill.length + i) * 100}ms` }}
                >
                  <div>
                    <div className="text-[#f1f5f9] text-sm font-semibold">{med.name} {med.dosage}</div>
                    <div className="text-[#94a3b8] text-[11px] mt-0.5">{med.frequency}</div>
                    {med.refill_date && (
                      <div className="text-[#22c55e] text-[11px] mt-0.5">
                        Refill in <AnimatedNumber value={Math.max(0, Math.ceil((new Date(med.refill_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))} suffix=" days" />
                      </div>
                    )}
                  </div>
                  <svg width="16" height="16" fill="none" stroke="#475569" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              ))}
            </>
          )}

          {medications.length === 0 && (
            <div className="text-center py-12 text-[#64748b] text-sm">No medications yet. Tap + to add one.</div>
          )}
        </div>
      )}

      {activeSegment === 1 && (
        <div>
          {thisWeekAppts.length > 0 && (
            <>
              <div className="text-[10px] text-[#64748b] font-semibold tracking-wider mb-2">THIS WEEK</div>
              {thisWeekAppts.map((appt, i) => (
                <button key={appt.id} onClick={() => setSelectedAppt(appt)} className="w-full text-left gradient-border-card bg-[#1e293b] border border-white/[0.06] rounded-xl p-3.5 mb-2 animate-card-in card-hover-lift animate-press" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                    <span className="text-[#38bdf8] text-[10px] font-semibold">{daysUntil(appt.date_time).toUpperCase()}</span>
                  </div>
                  <div className="text-[#f1f5f9] text-sm font-semibold">{appt.doctor_name || 'Appointment'}</div>
                  {appt.specialty && <div className="text-[#94a3b8] text-[11px] mt-0.5">{appt.specialty}</div>}
                  <div className="text-[#64748b] text-[11px] mt-0.5">
                    {new Date(appt.date_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                    {new Date(appt.date_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </button>
              ))}
            </>
          )}

          {laterAppts.length > 0 && (
            <>
              <div className="text-[10px] text-[#64748b] font-semibold tracking-wider mb-2 mt-4">UPCOMING</div>
              {laterAppts.map((appt, i) => (
                <button key={appt.id} onClick={() => setSelectedAppt(appt)} className="w-full text-left gradient-border-card bg-[#1e293b] border border-white/[0.06] rounded-xl p-3.5 mb-2 animate-card-in card-hover-lift animate-press" style={{ animationDelay: `${(thisWeekAppts.length + i) * 100}ms` }}>
                  <div className="text-[#f1f5f9] text-sm font-semibold">{appt.doctor_name || 'Appointment'}</div>
                  {appt.specialty && <div className="text-[#94a3b8] text-[11px] mt-0.5">{appt.specialty}</div>}
                  <div className="text-[#64748b] text-[11px] mt-0.5">
                    {new Date(appt.date_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                    {new Date(appt.date_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </button>
              ))}
            </>
          )}

          {futureAppts.length === 0 && (
            <div className="text-center py-12 text-[#64748b] text-sm">No upcoming appointments. Tap + to add one.</div>
          )}
        </div>
      )}

      <BottomSheet isOpen={!!selectedMed} onClose={() => setSelectedMed(null)} title={selectedMed?.name}>
        {selectedMed && (
          <div className="space-y-4">
            <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">DOSAGE</div><div className="text-[#e2e8f0] text-sm mt-1">{selectedMed.dosage || 'Not specified'}</div></div>
            <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">FREQUENCY</div><div className="text-[#e2e8f0] text-sm mt-1">{selectedMed.frequency || 'Not specified'}</div></div>
            {selectedMed.refill_date && <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">REFILL DATE</div><div className="text-[#e2e8f0] text-sm mt-1">{new Date(selectedMed.refill_date).toLocaleDateString()}</div></div>}
            <button onClick={() => handleDeleteMed(selectedMed.id)} className="w-full mt-4 py-2.5 rounded-lg bg-red-500/10 text-[#ef4444] text-sm font-semibold animate-press">Remove Medication</button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet isOpen={!!selectedAppt} onClose={() => setSelectedAppt(null)} title={selectedAppt?.doctor_name || 'Appointment'}>
        {selectedAppt && (
          <div className="space-y-4">
            {selectedAppt.specialty && <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">SPECIALTY</div><div className="text-[#e2e8f0] text-sm mt-1">{selectedAppt.specialty}</div></div>}
            <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">DATE & TIME</div><div className="text-[#e2e8f0] text-sm mt-1">{new Date(selectedAppt.date_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {new Date(selectedAppt.date_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div></div>
            {selectedAppt.location && <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">LOCATION</div><div className="text-[#e2e8f0] text-sm mt-1">{selectedAppt.location}</div></div>}
            <button onClick={() => handleDeleteAppt(selectedAppt.id)} className="w-full mt-4 py-2.5 rounded-lg bg-red-500/10 text-[#ef4444] text-sm font-semibold animate-press">Cancel Appointment</button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet isOpen={showAddForm} onClose={() => setShowAddForm(false)} title={activeSegment === 0 ? 'Add Medication' : 'Add Appointment'}>
        {activeSegment === 0 ? (
          <div className="space-y-3">
            <input placeholder="Medication name" value={medName} onChange={(e) => setMedName(e.target.value)} className={inputClass} />
            <input placeholder="Dosage (e.g. 10mg)" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} className={inputClass} />
            <input placeholder="Frequency (e.g. Once daily)" value={medFrequency} onChange={(e) => setMedFrequency(e.target.value)} className={inputClass} />
            <div><label className="text-[10px] text-[#64748b] font-semibold tracking-wider">REFILL DATE</label><input type="date" value={medRefillDate} onChange={(e) => setMedRefillDate(e.target.value)} className={`mt-1 ${inputClass}`} /></div>
            <button onClick={handleAddMed} disabled={!medName || saving} className="w-full py-2.5 rounded-lg bg-[#38bdf8] text-[#0f172a] text-sm font-semibold disabled:opacity-50 animate-press">{saving ? 'Saving...' : 'Add Medication'}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <input placeholder="Doctor name" value={apptDoctor} onChange={(e) => setApptDoctor(e.target.value)} className={inputClass} />
            <input placeholder="Specialty (e.g. Cardiology)" value={apptSpecialty} onChange={(e) => setApptSpecialty(e.target.value)} className={inputClass} />
            <div><label className="text-[10px] text-[#64748b] font-semibold tracking-wider">DATE & TIME</label><input type="datetime-local" value={apptDateTime} onChange={(e) => setApptDateTime(e.target.value)} className={`mt-1 ${inputClass}`} /></div>
            <input placeholder="Location (optional)" value={apptLocation} onChange={(e) => setApptLocation(e.target.value)} className={inputClass} />
            <button onClick={handleAddAppt} disabled={!apptDoctor || !apptDateTime || saving} className="w-full py-2.5 rounded-lg bg-[#38bdf8] text-[#0f172a] text-sm font-semibold disabled:opacity-50 animate-press">{saving ? 'Saving...' : 'Add Appointment'}</button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
