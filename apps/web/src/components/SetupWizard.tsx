'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { CareProfile, Medication, Doctor, Appointment, MedicationForm, DoctorForm, AppointmentForm } from '@/lib/types';

interface SetupWizardProps {
  initialStep: number;
  existingProfile: CareProfile | null;
  existingMedications: Medication[];
  existingDoctors: Doctor[];
  existingAppointments: Appointment[];
}

const STEP_LABELS = ['Patient', 'Conditions', 'Medications', 'Doctors', 'Appointments'];

const emptyMedication = (): MedicationForm => ({
  name: '', dose: '', frequency: '', prescribing_doctor: '', refill_date: '',
});

const emptyDoctor = (): DoctorForm => ({
  name: '', specialty: '', phone: '',
});

const emptyAppointment = (): AppointmentForm => ({
  doctor_name: '', date_time: '', purpose: '',
});

export function SetupWizard({
  initialStep,
  existingProfile,
  existingMedications,
  existingDoctors,
  existingAppointments,
}: SetupWizardProps) {
  const router = useRouter();

  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(existingProfile?.id || null);

  // Step 1: Patient info
  const [patientName, setPatientName] = useState(existingProfile?.patientName || '');
  const [patientAge, setPatientAge] = useState(existingProfile?.patientAge?.toString() || '');
  const [relationship, setRelationship] = useState(existingProfile?.relationship || '');

  // Step 2: Conditions & allergies
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');

  // Step 3: Medications
  const [medications, setMedications] = useState<MedicationForm[]>(
    existingMedications.length > 0
      ? existingMedications.map((m) => ({
          name: m.name,
          dose: m.dose || '',
          frequency: m.frequency || '',
          prescribing_doctor: m.prescribingDoctor || '',
          refill_date: m.refillDate || '',
        }))
      : [emptyMedication()]
  );

  // Step 4: Doctors
  const [doctors, setDoctors] = useState<DoctorForm[]>(
    existingDoctors.length > 0
      ? existingDoctors.map((d) => ({
          name: d.name,
          specialty: d.specialty || '',
          phone: d.phone || '',
        }))
      : [emptyDoctor()]
  );

  // Step 5: Appointments
  const [appointments, setAppointments] = useState<AppointmentForm[]>(
    existingAppointments.length > 0
      ? existingAppointments.map((a) => ({
          doctor_name: a.doctorName || '',
          date_time: a.dateTime ? a.dateTime.toISOString() : '',
          purpose: a.purpose || '',
        }))
      : [emptyAppointment()]
  );

  const updateMedication = (index: number, field: keyof MedicationForm, value: string) => {
    setMedications((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const updateDoctor = (index: number, field: keyof DoctorForm, value: string) => {
    setDoctors((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const updateAppointment = (index: number, field: keyof AppointmentForm, value: string) => {
    setAppointments((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const saveStep = async () => {
    setLoading(true);
    setError(null);

    try {
      if (step === 1) {
        const res = await fetch('/api/records/profile', {
          method: profileId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: profileId,
            patient_name: patientName,
            patient_age: patientAge ? parseInt(patientAge) : null,
            relationship,
          }),
        });
        if (!res.ok) throw new Error('Failed to save profile');
        if (!profileId) {
          const data = await res.json();
          setProfileId(data.id);
        }
      } else if (step === 2) {
        if (!profileId) throw new Error('Profile not created yet');
        const res = await fetch('/api/records/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: profileId, conditions, allergies }),
        });
        if (!res.ok) throw new Error('Failed to save conditions');
      } else if (step === 3) {
        if (!profileId) throw new Error('Profile not created yet');
        const validMeds = medications.filter((m) => m.name.trim());
        const res = await fetch('/api/records/medications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, medications: validMeds }),
        });
        if (!res.ok) throw new Error('Failed to save medications');
      } else if (step === 4) {
        if (!profileId) throw new Error('Profile not created yet');
        const validDocs = doctors.filter((d) => d.name.trim());
        const res = await fetch('/api/records/doctors', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, doctors: validDocs }),
        });
        if (!res.ok) throw new Error('Failed to save doctors');
      } else if (step === 5) {
        if (!profileId) throw new Error('Profile not created yet');
        const validAppts = appointments.filter((a) => a.doctor_name.trim() || a.purpose.trim());
        const res = await fetch('/api/records/appointments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, appointments: validAppts }),
        });
        if (!res.ok) throw new Error('Failed to save appointments');
      }

      if (step < 5) {
        setStep(step + 1);
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message)
        : 'Something went wrong';
      console.error('Setup error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div>
      <ProgressBar currentStep={step} totalSteps={5} labels={STEP_LABELS} />

      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8">
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              Who are you caring for?
            </h2>
            <FormField
              label="Their name"
              value={patientName}
              onChange={setPatientName}
              placeholder="e.g., Mom, Dad, John"
              required
            />
            <FormField
              label="Their age"
              type="number"
              value={patientAge}
              onChange={setPatientAge}
              placeholder="e.g., 75"
            />
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Your relationship to them
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
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
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              Cancer Diagnosis & Conditions
            </h2>
            <FormField
              label="Cancer type, stage, and other conditions"
              type="textarea"
              value={conditions}
              onChange={setConditions}
              placeholder="e.g., Stage III breast cancer (HER2+), diagnosed Jan 2025, also has high blood pressure..."
            />
            <FormField
              label="Allergies"
              type="textarea"
              value={allergies}
              onChange={setAllergies}
              placeholder="e.g., Penicillin, shellfish, latex..."
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              Medications
            </h2>
            {medications.map((med, i) => (
              <div key={i} className="p-4 bg-[var(--bg-elevated)] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Medication {i + 1}</span>
                  {medications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMedications((prev) => prev.filter((_, j) => j !== i))}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <FormField label="Name" value={med.name} onChange={(v) => updateMedication(i, 'name', v)} placeholder="e.g., Metformin" />
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Dose" value={med.dose} onChange={(v) => updateMedication(i, 'dose', v)} placeholder="e.g., 500mg" />
                  <FormField label="Frequency" value={med.frequency} onChange={(v) => updateMedication(i, 'frequency', v)} placeholder="e.g., Twice daily" />
                </div>
                <FormField label="Prescribing doctor" value={med.prescribing_doctor} onChange={(v) => updateMedication(i, 'prescribing_doctor', v)} placeholder="e.g., Dr. Smith" />
                <FormField label="Refill date" type="date" value={med.refill_date} onChange={(v) => updateMedication(i, 'refill_date', v)} />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMedications((prev) => [...prev, emptyMedication()])}
              className="text-sm text-[#A78BFA] hover:text-[#C4B5FD] font-medium"
            >
              + Add another medication
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              Doctors
            </h2>
            {doctors.map((doc, i) => (
              <div key={i} className="p-4 bg-[var(--bg-elevated)] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Doctor {i + 1}</span>
                  {doctors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDoctors((prev) => prev.filter((_, j) => j !== i))}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <FormField label="Name" value={doc.name} onChange={(v) => updateDoctor(i, 'name', v)} placeholder="e.g., Dr. Johnson" />
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Specialty" value={doc.specialty} onChange={(v) => updateDoctor(i, 'specialty', v)} placeholder="e.g., Cardiologist" />
                  <FormField label="Phone" value={doc.phone} onChange={(v) => updateDoctor(i, 'phone', v)} placeholder="e.g., (555) 123-4567" />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDoctors((prev) => [...prev, emptyDoctor()])}
              className="text-sm text-[#A78BFA] hover:text-[#C4B5FD] font-medium"
            >
              + Add another doctor
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              Upcoming Appointments
            </h2>
            {appointments.map((appt, i) => (
              <div key={i} className="p-4 bg-[var(--bg-elevated)] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Appointment {i + 1}</span>
                  {appointments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAppointments((prev) => prev.filter((_, j) => j !== i))}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <FormField label="Doctor name" value={appt.doctor_name} onChange={(v) => updateAppointment(i, 'doctor_name', v)} placeholder="e.g., Dr. Johnson" />
                <FormField label="Date & time" type="datetime-local" value={appt.date_time} onChange={(v) => updateAppointment(i, 'date_time', v)} />
                <FormField label="Purpose" value={appt.purpose} onChange={(v) => updateAppointment(i, 'purpose', v)} placeholder="e.g., Annual checkup" />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAppointments((prev) => [...prev, emptyAppointment()])}
              className="text-sm text-[#A78BFA] hover:text-[#C4B5FD] font-medium"
            >
              + Add another appointment
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--border)]">
          {step > 1 ? (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            {step >= 3 && step < 5 && (
              <Button variant="secondary" onClick={handleSkip}>
                Skip
              </Button>
            )}
            <Button onClick={saveStep} loading={loading}>
              {step === 5 ? 'Complete Setup' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
