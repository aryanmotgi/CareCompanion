'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { CategoryScanner } from '@/components/CategoryScanner';
import type { Appointment } from '@/lib/types';

interface AppointmentsViewProps {
  appointments: Appointment[];
  profileId: string;
}

export function AppointmentsView({ appointments: initial, profileId }: AppointmentsViewProps) {
  const [appointments, setAppointments] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [doctor, setDoctor] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const upcoming = appointments.filter((a) => a.dateTime && new Date(a.dateTime) >= new Date());
  const past = appointments.filter((a) => !a.dateTime || new Date(a.dateTime) < new Date());

  const addAppointment = async () => {
    if (!doctor.trim() && !purpose.trim()) return;
    setSaving(true);
    const res = await fetch('/api/records/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        care_profile_id: profileId,
        doctorName: doctor || null,
        dateTime: dateTime || null,
        purpose: purpose || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok && json.data) {
      setAppointments((prev) => [...prev, json.data].sort((a, b) => {
        if (!a.dateTime) return 1;
        if (!b.dateTime) return -1;
        return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
      }));
      setDoctor('');
      setDateTime('');
      setPurpose('');
      setShowAdd(false);
    }
  };

  const removeAppointment = async (id: string) => {
    const res = await fetch('/api/records/appointments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const AppointmentCard = ({ appt }: { appt: Appointment }) => {
    const isPast = appt.dateTime && new Date(appt.dateTime) < new Date();
    return (
      <div className={`flex items-center justify-between px-5 py-4 ${isPast ? 'opacity-60' : ''}`}>
        <div className="min-w-0">
          <p className="font-medium text-white">{appt.doctorName || 'Appointment'}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {appt.dateTime
              ? new Date(appt.dateTime).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'No date set'}
            {appt.purpose ? ` — ${appt.purpose}` : ''}
          </p>
        </div>
        <button
          onClick={() => removeAppointment(appt.id)}
          className="text-sm text-red-400 hover:text-red-400 flex-shrink-0 ml-4"
        >
          Remove
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Appointments</h2>
          <p className="text-sm text-[var(--text-secondary)]">{upcoming.length} upcoming</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowScanner(true)} className="!py-2 !px-4 !min-h-0 text-sm">
            Scan Note
          </Button>
          <Button onClick={() => setShowAdd(!showAdd)} className="!py-2 !px-4 !min-h-0 text-sm">
            + Add
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 space-y-3">
          <FormField label="Doctor / Location" value={doctor} onChange={setDoctor} placeholder="e.g., Dr. Patel" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date & time" type="datetime-local" value={dateTime} onChange={setDateTime} />
            <FormField label="Purpose" value={purpose} onChange={setPurpose} placeholder="e.g., Cardiology checkup" />
          </div>
          <div className="flex gap-2">
            <Button onClick={addAppointment} loading={saving}>Save</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold tracking-widest text-[var(--text-muted)] uppercase mb-2">Upcoming</h3>
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
            {upcoming.map((appt) => (
              <AppointmentCard key={appt.id} appt={appt} />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold tracking-widest text-[var(--text-muted)] uppercase mb-2">Past</h3>
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
            {past.map((appt) => (
              <AppointmentCard key={appt.id} appt={appt} />
            ))}
          </div>
        </div>
      )}

      {appointments.length === 0 && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] px-5 py-12 text-center">
          <svg className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25" />
          </svg>
          <p className="text-sm text-[var(--text-secondary)] mb-1">No appointments yet</p>
          <p className="text-xs text-[var(--text-muted)]">Add one manually or scan a doctor note</p>
        </div>
      )}

      {showScanner && (
        <CategoryScanner
          category="doctor_note"
          onClose={() => setShowScanner(false)}
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}
