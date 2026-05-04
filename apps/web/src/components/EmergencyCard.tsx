'use client';

import { useState } from 'react';
import Link from 'next/link';
import { InfoTooltip } from './InfoTooltip';

interface EmergencyCardProps {
  patient: {
    name: string;
    age: number | null;
    conditions: string | null;
    allergies: string | null;
    emergencyContactName: string | null | undefined;
    emergencyContactPhone: string | null | undefined;
    updatedAt?: Date | string | null;
  };
  medications: Array<{
    name: string;
    dose: string;
    frequency: string;
  }>;
  doctors: Array<{
    name: string;
    specialty: string;
    phone: string;
  }>;
  insurance: {
    provider: string;
    memberId: string;
    groupNumber: string;
  } | null;
}

export function EmergencyCard({ patient, medications, doctors, insurance }: EmergencyCardProps) {
  const [copied, setCopied] = useState(false)

  const isEmpty =
    !patient.allergies &&
    medications.length === 0 &&
    !patient.emergencyContactName;

  const primaryDoctor = doctors.find((d) =>
    d.specialty?.toLowerCase().includes('primary') ||
    d.specialty?.toLowerCase().includes('family') ||
    d.specialty?.toLowerCase().includes('internal')
  ) || doctors[0];

  const handleShare = async () => {
    const text = buildPlainText();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Emergency Info — ${patient.name}`, text });
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          await navigator.clipboard.writeText(text).catch(() => null);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard API not available (HTTP context); no-op — user can screenshot
      }
    }
  };

  function buildPlainText() {
    const lines = [
      `EMERGENCY INFORMATION — ${patient.name}`,
      `Age: ${patient.age || 'Unknown'}`,
      '',
      `CONDITIONS: ${patient.conditions || 'None listed'}`,
      `ALLERGIES: ${patient.allergies || 'NKDA'}`,
      '',
      'CURRENT MEDICATIONS:',
      ...medications.map((m) => `  - ${m.name} ${m.dose} ${m.frequency}`),
      '',
    ];
    if (primaryDoctor) {
      lines.push(`PRIMARY DOCTOR: ${primaryDoctor.name} (${primaryDoctor.specialty}) ${primaryDoctor.phone}`);
    }
    if (insurance) {
      lines.push(`INSURANCE: ${insurance.provider} | Member: ${insurance.memberId} | Group: ${insurance.groupNumber}`);
    }
    if (patient.emergencyContactName) {
      lines.push(`EMERGENCY CONTACT: ${patient.emergencyContactName} ${patient.emergencyContactPhone || ''}`);
    }
    return lines.join('\n');
  }

  return (
    <div className="px-5 py-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Emergency Card</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShare}
            className="px-3 py-2 rounded-lg bg-white/[0.06] text-[var(--text-secondary)] hover:text-white transition-colors text-xs font-medium min-w-[64px]"
            title="Share or copy"
          >
            {copied ? 'Copied!' : (
              <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935-2.186Z" />
              </svg>
            )}
          </button>
          <InfoTooltip content="This link works without a login — safe to share with family or save to your phone." />
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-5">
        Show this to a paramedic, ER nurse, or first responder in an emergency.
      </p>

      {/* The card */}
      <div className="bg-[#1e293b] border-2 border-red-500/30 rounded-2xl overflow-hidden">
        {/* Red emergency header */}
        <div className="bg-red-600 px-5 py-3 flex items-center gap-3">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <h3 className="text-white font-bold text-lg">EMERGENCY INFO</h3>
            <p className="text-red-100 text-xs">Medical Information Card</p>
          </div>
        </div>

        {/* Patient info */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-baseline justify-between">
            <h4 className="text-white text-xl font-bold">{patient.name}</h4>
            {patient.age && <span className="text-[var(--text-secondary)] text-sm">Age {patient.age}</span>}
          </div>
        </div>

        {/* Allergies — highlighted prominently */}
        <div className="px-5 py-3 bg-red-500/10 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Allergies</span>
          </div>
          <p className="text-white font-semibold text-sm">
            {patient.allergies || 'NKDA (No Known Drug Allergies)'}
          </p>
        </div>

        {/* Conditions */}
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">Conditions</p>
          <p className="text-white text-sm">{patient.conditions || 'None listed'}</p>
        </div>

        {/* Medications */}
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-2">Current Medications</p>
          {medications.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-sm">None listed</p>
          ) : (
            <div className="space-y-1.5">
              {medications.map((med, i) => (
                <div key={i} className="flex items-baseline justify-between">
                  <span className="text-white text-sm font-medium">{med.name}</span>
                  <span className="text-[var(--text-secondary)] text-xs">{med.dose} {med.frequency}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Insurance */}
        {insurance && (
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">Insurance</p>
            <p className="text-white text-sm font-medium">{insurance.provider}</p>
            <div className="flex gap-4 mt-1">
              <span className="text-[var(--text-secondary)] text-xs">ID: {insurance.memberId}</span>
              <span className="text-[var(--text-secondary)] text-xs">Group: {insurance.groupNumber}</span>
            </div>
          </div>
        )}

        {/* Primary Doctor */}
        {primaryDoctor && (
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">Primary Doctor</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{primaryDoctor.name}</p>
                <p className="text-[var(--text-secondary)] text-xs">{primaryDoctor.specialty}</p>
              </div>
              {primaryDoctor.phone && (
                <a
                  href={`tel:${primaryDoctor.phone}`}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-[#A78BFA] text-xs font-medium"
                >
                  Call
                </a>
              )}
            </div>
          </div>
        )}

        {/* Emergency Contact */}
        <div className="px-5 py-3">
          <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">Emergency Contact</p>
          {patient.emergencyContactName ? (
            <div className="flex items-center justify-between">
              <p className="text-white text-sm font-medium">{patient.emergencyContactName}</p>
              {patient.emergencyContactPhone && (
                <a
                  href={`tel:${patient.emergencyContactPhone}`}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium"
                >
                  Call
                </a>
              )}
            </div>
          ) : (
            <p className="text-amber-400 text-sm">Not set — add one in your Care Profile</p>
          )}
        </div>
      </div>

      {/* Quick call buttons */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <a
          href="tel:911"
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-600 text-white font-bold text-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          </svg>
          Call 911
        </a>
        <a
          href="tel:988"
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white font-medium text-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
          988 Crisis Line
        </a>
      </div>

      {/* Last updated timestamp */}
      <p className="text-xs text-[var(--text-secondary)] mt-4 text-center">
        Last updated: {patient.updatedAt
          ? new Date(patient.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Never'}
      </p>

      {/* Empty state guidance */}
      {isEmpty && (
        <div className="mt-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-5 py-5 text-center">
          <svg className="w-10 h-10 text-amber-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <h3 className="text-white font-semibold mb-1">Set up your emergency card</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Add your emergency contact, medications, and allergies so first responders can help you quickly.
          </p>
          <Link href="/profile" className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold">
            Complete your profile
          </Link>
        </div>
      )}

      {/* Tip */}
      <p className="text-center text-[var(--text-muted)] text-xs mt-5">
        Tip: Bookmark this page for instant access, or add it to your home screen.
      </p>
    </div>
  );
}
