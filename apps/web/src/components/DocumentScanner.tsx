'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ToastProvider';
import { useCsrfToken } from '@/components/CsrfProvider';

interface DocumentScannerProps {
  onClose: () => void;
  onSaved?: () => void;
}

interface ScanResult {
  document_type: string;
  summary: string;
  medications: Array<{ name: string; dose?: string; frequency?: string; prescribing_doctor?: string; refill_date?: string }>;
  lab_results: Array<{ test_name: string; value?: string; unit?: string; reference_range?: string; is_abnormal?: boolean }>;
  insurance: { provider: string; member_id?: string; group_number?: string } | null;
  conditions: string[];
  appointments: Array<{ doctor_name?: string; date_time?: string; purpose?: string }>;
  claims: Array<{ service_date?: string; provider_name?: string; billed_amount?: number; paid_amount?: number; patient_responsibility?: number; status?: string }>;
  notes: string;
  date_taken?: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  PILL_BOTTLE: 'Pill Bottle',
  PRESCRIPTION: 'Prescription',
  LAB_REPORT: 'Lab Report',
  INSURANCE_CARD: 'Insurance Card',
  DOCTOR_NOTE: 'Doctor Note',
  VISIT_SUMMARY: 'Visit Summary',
  EOB: 'Explanation of Benefits',
  OTHER: 'Document',
};

const DOC_TYPE_ICONS: Record<string, string> = {
  PILL_BOTTLE: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0',
  PRESCRIPTION: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  LAB_REPORT: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3',
  INSURANCE_CARD: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
  DOCTOR_NOTE: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  VISIT_SUMMARY: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z',
  EOB: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z',
  OTHER: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function DocumentScanner({ onClose, onSaved }: DocumentScannerProps) {
  const { showToast } = useToast();
  const csrfToken = useCsrfToken();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Warn user before leaving page during active scan/save
  const isProcessing = scanning || saving;

  useEffect(() => {
    if (!isProcessing) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessing]);

  const handleClose = useCallback(() => {
    if (scanning || saving) {
      if (!window.confirm('Are you sure? Your scan is still in progress.')) return;
    }
    onClose();
  }, [scanning, saving, onClose]);

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
      showToast('Document saved', 'success');
    } catch {
      setError('Failed to save. Please try again.');
      showToast('Failed to save document', 'error');
    } finally {
      setSaving(false);
    }
  };

  const hasData = result && (
    result.medications.length > 0 ||
    result.lab_results.length > 0 ||
    result.insurance !== null ||
    result.conditions.length > 0 ||
    result.appointments.length > 0 ||
    result.claims.length > 0
  );

  const totalItems = result ? (
    result.medications.length +
    result.lab_results.length +
    (result.insurance ? 1 : 0) +
    result.conditions.length +
    result.appointments.length +
    result.claims.length
  ) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl shadow-black/40 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="font-display text-lg font-semibold text-white">Scan Document</h2>
          <button
            onClick={handleClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {saved ? (
            /* Success state */
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Upload a photo of any medical document — pill bottles, lab reports, insurance cards, prescriptions, doctor notes, or bills. Our AI will extract all the information automatically.
                </p>

                {!preview ? (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-[var(--text-muted)]/30 rounded-xl p-8 text-center hover:border-blue-500/50 hover:bg-blue-500/10 transition-colors"
                  >
                    <svg className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                    </svg>
                    <p className="text-sm font-medium text-[var(--text)]">Take a photo or upload</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Pill bottles, lab reports, insurance cards, prescriptions...</p>
                  </button>
                ) : (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Document preview" className="w-full rounded-xl border border-[var(--border)]" />
                    <button
                      onClick={() => { setPreview(null); setFile(null); setResult(null); }}
                      className="absolute top-2 right-2 bg-[var(--bg-card)]/90 rounded-full p-1.5 shadow-sm hover:bg-[var(--bg-card)] transition-colors"
                    >
                      <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
              </div>

              {/* Scan button */}
              {preview && !result && (
                <Button onClick={handleScan} loading={scanning} className="w-full">
                  {scanning ? 'Analyzing document...' : 'Scan & Extract'}
                </Button>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-4">
                  {/* Document type badge */}
                  <div className="flex items-center gap-3 p-4 bg-blue-500/15 rounded-xl">
                    <svg className="w-5 h-5 text-[#A78BFA] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={DOC_TYPE_ICONS[result.document_type] || DOC_TYPE_ICONS.OTHER} />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-blue-200">
                        {DOC_TYPE_LABELS[result.document_type] || 'Document'} detected
                      </p>
                      <p className="text-xs text-[#A78BFA]">{result.summary}</p>
                    </div>
                  </div>

                  {/* Medications */}
                  {result.medications.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">
                        Medications ({result.medications.length})
                      </h4>
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
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">
                        Lab Results ({result.lab_results.length})
                      </h4>
                      <div className="space-y-2">
                        {result.lab_results.map((lab, i) => (
                          <div key={i} className={`p-3 rounded-xl ${lab.is_abnormal ? 'bg-red-500/10' : 'bg-[var(--bg-elevated)]'}`}>
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
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">Conditions ({result.conditions.length})</h4>
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
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">Appointments ({result.appointments.length})</h4>
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
                      <h4 className="text-sm font-medium text-[var(--text)] mb-2">Claims ({result.claims.length})</h4>
                      <div className="space-y-2">
                        {result.claims.map((claim, i) => (
                          <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                            <p className="font-medium text-white">{claim.provider_name || 'Claim'}</p>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {claim.billed_amount ? `$${claim.billed_amount}` : ''} {claim.status ? `· ${claim.status}` : ''}
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

                  {/* No data found */}
                  {!hasData && (
                    <p className="text-sm text-[var(--text-secondary)] text-center py-2">
                      No extractable medical data found. Try a clearer photo.
                    </p>
                  )}

                  {/* Save button */}
                  {hasData && (
                    <Button onClick={handleSave} loading={saving} className="w-full">
                      Save {totalItems} Item{totalItems !== 1 ? 's' : ''} to Profile
                    </Button>
                  )}
                </div>
              )}

              {/* Error */}
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
