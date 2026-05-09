'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { CategoryScanner } from '@/components/CategoryScanner';
import { SectionEmptyState } from '@/components/SectionEmptyState';
import type { Appointment } from '@/lib/types';

interface AppointmentsViewProps {
  appointments: Appointment[];
  profileId: string;
  patientName?: string;
}

export function AppointmentsView({ appointments: initial, profileId, patientName = 'your loved one' }: AppointmentsViewProps) {
  const [appointments, setAppointments] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [doctor, setDoctor] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const upcoming = appointments.filter((a) => a.dateTime && new Date(a.dateTime) >= new Date());
  const past = appointments.filter((a) => !a.dateTime || new Date(a.dateTime) < new Date());

  const addAppointment = async () => {
    if (!doctor.trim() && !purpose.trim()) return;
    setSaving(true);
    setAddError(null);
    try {
      const res = await fetch('/api/records/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          care_profile_id: profileId,
          doctor_name: doctor || null,
          date_time: dateTime || null,
          purpose: purpose || null,
        }),
      });
      const json = await res.json();
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
      } else {
        setAddError(json.error || 'Failed to save appointment. Please try again.');
      }
    } catch {
      setAddError('Network error. Please try again.');
    } finally {
      setSaving(false);
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
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <div className="flex gap-2">
            <Button onClick={addAppointment} loading={saving}>Save</Button>
            <Button variant="secondary" onClick={() => { setShowAdd(false); setAddError(null); }}>Cancel</Button>
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
        <SectionEmptyState
          patientName={patientName}
          icon={
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          }
          heading="Keep [patient name]'s appointments in one place"
          body="Add an upcoming visit or connect your health system to sync them automatically."
          actionLabel="Add Appointment"
          onAction={() => setShowAdd(true)}
        />
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
