'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ToastProvider';
import { useCsrfToken } from '@/components/CsrfProvider';

export type ScanCategory = 'medication' | 'lab_report' | 'insurance' | 'eob' | 'doctor_note';

interface CategoryScannerProps {
  category: ScanCategory;
  onClose: () => void;
  onSaved?: () => void;
}

interface ScanResult {
  document_type: string;
  summary: string;
  medications: Array<{ name: string; dose?: string; frequency?: string; prescribing_doctor?: string; refill_date?: string }>;
  lab_results: Array<{ test_name: string; value?: string; unit?: string; reference_range?: string; is_abnormal?: boolean }>;
  insurance: { provider: string; member_id?: string; group_number?: string; plan_type?: string; copay?: string; phone?: string } | null;
  conditions: string[];
  appointments: Array<{ doctor_name?: string; date_time?: string; purpose?: string }>;
  claims: Array<{ service_date?: string; provider_name?: string; billed_amount?: number; paid_amount?: number; patient_responsibility?: number; status?: string }>;
  notes: string;
  date_taken?: string;
}

const CATEGORY_CONFIG: Record<ScanCategory, {
  title: string;
  subtitle: string;
  uploadHint: string;
  icon: string;
  accentColor: string;
  accentBg: string;
}> = {
  medication: {
    title: 'Scan Medication',
    subtitle: 'Pill bottles, prescription labels, pharmacy printouts',
    uploadHint: 'Take a clear photo of the medication label',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
    accentColor: 'text-[#A78BFA]',
    accentBg: 'bg-blue-500/15',
  },
  lab_report: {
    title: 'Scan Lab Report',
    subtitle: 'Blood work, test results, pathology reports',
    uploadHint: 'Capture the full results table clearly',
    icon: 'M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
  },
  insurance: {
    title: 'Scan Insurance Card',
    subtitle: 'Insurance cards, coverage documents',
    uploadHint: 'Place your card on a flat, well-lit surface',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
  },
  eob: {
    title: 'Scan EOB',
    subtitle: 'Explanation of benefits, billing statements',
    uploadHint: 'Capture the summary section of your EOB',
    icon: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
  },
  doctor_note: {
    title: 'Scan Doctor Note',
    subtitle: 'Visit summaries, referral letters, discharge papers',
    uploadHint: 'Capture the full page including doctor name and date',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
    accentColor: 'text-rose-400',
    accentBg: 'bg-rose-500/15',
  },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function CategoryScanner({ category, onClose, onSaved }: CategoryScannerProps) {
  const { showToast } = useToast();
  const csrfToken = useCsrfToken();
  const config = CATEGORY_CONFIG[category];
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 10 MB.');
      showToast('File too large (max 10 MB)', 'error');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    setSaved(false);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleScan = async () => {
    if (!file) return;
    setScanning(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    try {
      const res = await fetch('/api/scan-document', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Scan failed');
      }
      const data = await res.json();
      setResult(data);
      showToast('Document scanned', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze the document.';
      setError(msg === 'Scan failed' ? 'Failed to analyze the document. Please try a clearer photo.' : msg);
      showToast('Failed to scan document', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/save-scan-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      onSaved?.();
      showToast('Data saved', 'success');
    } catch {
      setError('Failed to save. Please try again.');
      showToast('Failed to save data', 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalItems = result ? (
    result.medications.length +
    result.lab_results.length +
    (result.insurance ? 1 : 0) +
    result.conditions.length +
    result.appointments.length +
    result.claims.length
  ) : 0;

  const hasData = totalItems > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1525] rounded-2xl shadow-2xl shadow-black/40 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[var(--border)]">
        {/* Header with category color */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${config.accentBg} flex items-center justify-center`}>
              <svg className={`w-5 h-5 ${config.accentColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">{config.title}</h2>
              <p className="text-xs text-[var(--text-muted)]">{config.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {saved ? (
            <div className="text-center py-8">
              <div className={`w-14 h-14 ${config.accentBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <svg className={`w-7 h-7 ${config.accentColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-white mb-1">Data Saved</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                {totalItems} item{totalItems !== 1 ? 's' : ''} added to your care profile.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={() => { setFile(null); setPreview(null); setResult(null); setSaved(false); }}>
                  Scan Another
                </Button>
                <Button onClick={onClose}>Done</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Upload area */}
              {!preview ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-[var(--text-muted)]/20 rounded-2xl p-10 text-center hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group"
                >
                  <div className={`w-16 h-16 rounded-2xl ${config.accentBg} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    <svg className={`w-8 h-8 ${config.accentColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-white mb-1">Take a photo or upload</p>
                  <p className="text-xs text-[var(--text-muted)]">{config.uploadHint}</p>
                </button>
              ) : (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Document preview" className="w-full rounded-xl border border-[var(--border)]" />
                  <button
                    onClick={() => { setPreview(null); setFile(null); setResult(null); }}
                    className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1.5 hover:bg-black/80 transition-colors"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Scan button */}
              {preview && !result && (
                <Button onClick={handleScan} loading={scanning} className="w-full">
                  {scanning ? 'Analyzing...' : 'Scan & Extract'}
                </Button>
              )}

              {/* Scanning animation */}
              {scanning && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-elevated)]">
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Reading your document...</p>
                    <p className="text-xs text-[var(--text-muted)]">AI is extracting information</p>
                  </div>
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-4">
                  {/* Document type badge */}
                  <div className={`flex items-center gap-3 p-4 ${config.accentBg} rounded-xl`}>
                    <svg className={`w-5 h-5 ${config.accentColor} flex-shrink-0`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
                    </svg>
                    <div>
                      <p className={`text-sm font-medium ${config.accentColor}`}>{result.summary}</p>
                    </div>
                  </div>

                  {/* Medications */}
                  {result.medications.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">Medications ({result.medications.length})</h4>
                      <div className="space-y-2">
                        {result.medications.map((med, i) => (
                          <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                            <p className="font-medium text-white">{med.name}</p>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                            </p>
                            {med.prescribing_doctor && (
                              <p className="text-xs text-[var(--text-muted)] mt-1">Dr. {med.prescribing_doctor}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lab Results */}
                  {result.lab_results.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">Lab Results ({result.lab_results.length})</h4>
                      <div className="space-y-2">
                        {result.lab_results.map((lab, i) => (
                          <div key={i} className={`p-3 rounded-xl ${lab.is_abnormal ? 'bg-red-500/10 border border-red-500/20' : 'bg-[var(--bg-elevated)]'}`}>
                            <div className="flex items-center justify-between">
                              <p className={`font-medium ${lab.is_abnormal ? 'text-red-300' : 'text-white'}`}>{lab.test_name}</p>
                              {lab.is_abnormal && (
                                <span className="text-xs font-medium text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full">Abnormal</span>
                              )}
                            </div>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {lab.value} {lab.unit} {lab.reference_range ? `(ref: ${lab.reference_range})` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Insurance */}
                  {result.insurance && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">Insurance</h4>
                      <div className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                        <p className="font-medium text-white">{result.insurance.provider}</p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {[
                            result.insurance.member_id ? `Member: ${result.insurance.member_id}` : null,
                            result.insurance.group_number ? `Group: ${result.insurance.group_number}` : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Conditions */}
                  {result.conditions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">Conditions</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.conditions.map((c, i) => (
                          <span key={i} className="px-3 py-1 bg-[var(--bg-elevated)] rounded-full text-sm text-[var(--text)]">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Appointments */}
                  {result.appointments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">Appointments</h4>
                      <div className="space-y-2">
                        {result.appointments.map((appt, i) => (
                          <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                            <p className="font-medium text-white">{appt.doctor_name || 'Appointment'}</p>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {[appt.date_time, appt.purpose].filter(Boolean).join(' — ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Claims */}
                  {result.claims.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">Claims</h4>
                      <div className="space-y-2">
                        {result.claims.map((claim, i) => (
                          <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-white">{claim.provider_name || 'Claim'}</p>
                              {claim.status && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  claim.status === 'paid' ? 'text-emerald-400 bg-emerald-500/15' :
                                  claim.status === 'denied' ? 'text-red-400 bg-red-500/15' :
                                  'text-amber-400 bg-amber-500/15'
                                }`}>{claim.status}</span>
                              )}
                            </div>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {claim.billed_amount ? `Billed: $${claim.billed_amount}` : ''}
                              {claim.patient_responsibility ? ` · You owe: $${claim.patient_responsibility}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {result.notes && (
                    <div className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                      <h4 className="text-sm font-medium text-[var(--text)] mb-1">Notes</h4>
                      <p className="text-sm text-[var(--text-secondary)]">{result.notes}</p>
                    </div>
                  )}

                  {!hasData && (
                    <p className="text-sm text-[var(--text-secondary)] text-center py-2">
                      No extractable data found. Try a clearer photo.
                    </p>
                  )}

                  {hasData && (
                    <Button onClick={handleSave} loading={saving} className="w-full">
                      Save {totalItems} Item{totalItems !== 1 ? 's' : ''} to Profile
                    </Button>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
