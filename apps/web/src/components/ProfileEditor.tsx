'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { useCsrfToken } from '@/components/CsrfProvider';
import type { CareProfile, Medication, Doctor, Appointment } from '@/lib/types';

interface ProfileEditorProps {
  profile: CareProfile;
  medications: Medication[];
  doctors: Doctor[];
  appointments: Appointment[];
}

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[var(--bg-elevated)] transition-colors"
      >
        <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
        <svg
          className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6 border-t border-[var(--border)] pt-4">{children}</div>}
    </div>
  );
}

export function ProfileEditor({
  profile,
  medications: initialMedications,
  doctors: initialDoctors,
  appointments: initialAppointments,
}: ProfileEditorProps) {
  const csrfToken = useCsrfToken();

  // Patient info
  const [patientName, setPatientName] = useState(profile.patientName || '');
  const [patientAge, setPatientAge] = useState(profile.patientAge?.toString() || '');
  const [relationship, setRelationship] = useState(profile.relationship || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Conditions (initialized from profile)
  const [conditions, setConditions] = useState(profile.conditions || '');
  const [allergies, setAllergies] = useState(profile.allergies || '');
  const [savingConditions, setSavingConditions] = useState(false);
  const [conditionsMsg, setConditionsMsg] = useState('');

  // Medications
  const [medications, setMedications] = useState(initialMedications);
  const [savingMeds, setSavingMeds] = useState(false);
  const [medsMsg, setMedsMsg] = useState('');
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFrequency, setNewMedFrequency] = useState('');

  // Doctors
  const [doctors, setDoctors] = useState(initialDoctors);
  const [savingDocs, setSavingDocs] = useState(false);
  const [docsMsg, setDocsMsg] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocSpecialty, setNewDocSpecialty] = useState('');
  const [newDocPhone, setNewDocPhone] = useState('');

  // Appointments
  const [appointments, setAppointments] = useState(initialAppointments);
  const [savingAppts, setSavingAppts] = useState(false);
  const [apptsMsg, setApptsMsg] = useState('');
  const [newApptDoctor, setNewApptDoctor] = useState('');
  const [newApptDate, setNewApptDate] = useState('');
  const [newApptPurpose, setNewApptPurpose] = useState('');

  const savePatientInfo = async () => {
    setSavingProfile(true);
    setProfileMsg('');
    const res = await fetch('/api/records/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({
        id: profile.id,
        patient_name: patientName,
        patient_age: patientAge ? parseInt(patientAge) : null,
        relationship,
      }),
    });
    setSavingProfile(false);
    if (res.ok) {
      setProfileMsg('Saved');
      setTimeout(() => setProfileMsg(''), 2000);
    } else {
      const json = await res.json();
      setProfileMsg(json.error || 'Failed to save');
    }
  };

  const saveConditions = async () => {
    setSavingConditions(true);
    setConditionsMsg('');
    const res = await fetch('/api/records/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ id: profile.id, conditions, allergies }),
    });
    setSavingConditions(false);
    if (res.ok) {
      setConditionsMsg('Saved');
      setTimeout(() => setConditionsMsg(''), 2000);
    } else {
      const json = await res.json();
      setConditionsMsg(json.error || 'Failed to save');
    }
  };

  const addMedication = async () => {
    if (!newMedName.trim()) return;
    setSavingMeds(true);
    const res = await fetch('/api/records/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({
        care_profile_id: profile.id,
        name: newMedName,
        dose: newMedDose || null,
        frequency: newMedFrequency || null,
      }),
    });
    const json = await res.json();
    setSavingMeds(false);
    if (res.ok && json.data) {
      setMedications((prev) => [...prev, json.data]);
      setNewMedName('');
      setNewMedDose('');
      setNewMedFrequency('');
    }
    setMedsMsg(res.ok ? '' : (json.error || 'Failed to save'));
  };

  const removeMedication = async (id: string) => {
    const res = await fetch('/api/records/medications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setMedications((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const addDoctor = async () => {
    if (!newDocName.trim()) return;
    setSavingDocs(true);
    const res = await fetch('/api/records/doctors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({
        care_profile_id: profile.id,
        name: newDocName,
        specialty: newDocSpecialty || null,
        phone: newDocPhone || null,
      }),
    });
    const json = await res.json();
    setSavingDocs(false);
    if (res.ok && json.data) {
      setDoctors((prev) => [...prev, json.data]);
      setNewDocName('');
      setNewDocSpecialty('');
      setNewDocPhone('');
    }
    setDocsMsg(res.ok ? '' : (json.error || 'Failed to save'));
  };

  const removeDoctor = async (id: string) => {
    const res = await fetch('/api/records/doctors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setDoctors((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const addAppointment = async () => {
    if (!newApptDoctor.trim() && !newApptPurpose.trim()) return;
    setSavingAppts(true);
    const res = await fetch('/api/records/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({
        care_profile_id: profile.id,
        doctor_name: newApptDoctor || null,
        date_time: newApptDate || null,
        purpose: newApptPurpose || null,
      }),
    });
    const json = await res.json();
    setSavingAppts(false);
    if (res.ok && json.data) {
      setAppointments((prev) => [...prev, json.data]);
      setNewApptDoctor('');
      setNewApptDate('');
      setNewApptPurpose('');
    }
    setApptsMsg(res.ok ? '' : (json.error || 'Failed to save'));
  };

  const removeAppointment = async (id: string) => {
    const res = await fetch('/api/records/appointments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Patient Info */}
      <Section title="Patient Information" defaultOpen>
        <div className="space-y-4">
          <FormField label="Name" value={patientName} onChange={setPatientName} placeholder="Patient name" />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Age" type="number" value={patientAge} onChange={setPatientAge} />
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full rounded-xl border-2 border-[var(--border)] bg-[var(--bg-card)] py-3 px-4 text-white focus:outline-none focus:border-blue-600 transition-colors"
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
          <div className="flex items-center gap-3">
            <Button onClick={savePatientInfo} loading={savingProfile}>Save</Button>
            {profileMsg && <span className={`text-sm ${profileMsg === 'Saved' ? 'text-emerald-400' : 'text-red-400'}`}>{profileMsg}</span>}
          </div>
        </div>
      </Section>

      {/* Conditions & Allergies */}
      <Section title="Conditions & Allergies">
        <div className="space-y-4">
          <FormField label="Medical conditions" type="textarea" value={conditions} onChange={setConditions} />
          <FormField label="Allergies" type="textarea" value={allergies} onChange={setAllergies} />
          <div className="flex items-center gap-3">
            <Button onClick={saveConditions} loading={savingConditions}>Save</Button>
            {conditionsMsg && <span className={`text-sm ${conditionsMsg === 'Saved' ? 'text-emerald-400' : 'text-red-400'}`}>{conditionsMsg}</span>}
          </div>
        </div>
      </Section>

      {/* Medications */}
      <Section title="Medications">
        <div className="space-y-3">
          {medications.map((med) => (
            <div key={med.id} className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] rounded-xl">
              <div>
                <p className="font-medium text-white">{med.name}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => removeMedication(med.id)}
                className="text-sm text-red-400 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="pt-3 border-t border-[var(--border)] space-y-3">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Add medication</p>
            <FormField label="Name" value={newMedName} onChange={setNewMedName} placeholder="Medication name" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Dose" value={newMedDose} onChange={setNewMedDose} placeholder="e.g., 500mg" />
              <FormField label="Frequency" value={newMedFrequency} onChange={setNewMedFrequency} placeholder="e.g., Twice daily" />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={addMedication} loading={savingMeds} variant="secondary">Add</Button>
              {medsMsg && <span className="text-sm text-red-400">{medsMsg}</span>}
            </div>
          </div>
        </div>
      </Section>

      {/* Doctors */}
      <Section title="Doctors">
        <div className="space-y-3">
          {doctors.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] rounded-xl">
              <div>
                <p className="font-medium text-white">{doc.name}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {[doc.specialty, doc.phone].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => removeDoctor(doc.id)}
                className="text-sm text-red-400 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="pt-3 border-t border-[var(--border)] space-y-3">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Add doctor</p>
            <FormField label="Name" value={newDocName} onChange={setNewDocName} placeholder="Doctor name" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Specialty" value={newDocSpecialty} onChange={setNewDocSpecialty} placeholder="e.g., Cardiologist" />
              <FormField label="Phone" value={newDocPhone} onChange={setNewDocPhone} placeholder="(555) 123-4567" />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={addDoctor} loading={savingDocs} variant="secondary">Add</Button>
              {docsMsg && <span className="text-sm text-red-400">{docsMsg}</span>}
            </div>
          </div>
        </div>
      </Section>

      {/* Appointments */}
      <Section title="Appointments">
        <div className="space-y-3">
          {appointments.map((appt) => (
            <div key={appt.id} className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] rounded-xl">
              <div>
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
                    : ''}
                  {appt.purpose ? ` — ${appt.purpose}` : ''}
                </p>
              </div>
              <button
                onClick={() => removeAppointment(appt.id)}
                className="text-sm text-red-400 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="pt-3 border-t border-[var(--border)] space-y-3">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Add appointment</p>
            <FormField label="Doctor" value={newApptDoctor} onChange={setNewApptDoctor} placeholder="Doctor name" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Date & time" type="datetime-local" value={newApptDate} onChange={setNewApptDate} />
              <FormField label="Purpose" value={newApptPurpose} onChange={setNewApptPurpose} placeholder="e.g., Checkup" />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={addAppointment} loading={savingAppts} variant="secondary">Add</Button>
              {apptsMsg && <span className="text-sm text-red-400">{apptsMsg}</span>}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
