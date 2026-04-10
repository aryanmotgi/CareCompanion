'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ToastProvider';

interface CvsImportModalProps {
  onClose: () => void;
}

interface ExtractedMedication {
  name: string;
  dose: string;
  frequency: string;
}

export function CvsImportModal({ onClose }: CvsImportModalProps) {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedMedication[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setExtracted(null);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/extract-medications', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to extract medications');
      const data = await res.json();
      setExtracted(data.medications);
      showToast('Data extracted', 'success');
    } catch {
      setError('Failed to extract medications from the image. Please try a clearer screenshot.');
      showToast('Failed to extract medications', 'error');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extracted || extracted.length === 0) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/import-medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medications: extracted, source: 'cvs_import' }),
      });
      if (!res.ok) throw new Error('Failed to save medications');
      setSaved(true);
      showToast('Import saved', 'success');
    } catch {
      setError('Failed to save medications. Please try again.');
      showToast('Failed to save medications', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-display text-lg font-semibold text-slate-900">Import from CVS</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {saved ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-slate-900 mb-1">Medications Imported</h3>
              <p className="text-sm text-slate-500 mb-4">
                {extracted?.length} medication{extracted?.length !== 1 ? 's' : ''} saved to your profile.
              </p>
              <Button onClick={onClose}>Done</Button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm text-slate-600 mb-4">
                  Take a screenshot of your CVS prescription list and upload it here. Our AI will automatically extract all medication details.
                </p>

                {!preview ? (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                  >
                    <svg className="w-10 h-10 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm font-medium text-slate-600">Upload screenshot</p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, or HEIC</p>
                  </button>
                ) : (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="CVS screenshot" className="w-full rounded-xl border border-slate-200" />
                    <button
                      onClick={() => { setPreview(null); setFile(null); setExtracted(null); }}
                      className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow-sm hover:bg-white"
                    >
                      <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {preview && !extracted && (
                <Button onClick={handleExtract} loading={extracting} className="w-full">
                  {extracting ? 'Analyzing screenshot...' : 'Extract Medications'}
                </Button>
              )}

              {extracted && extracted.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">
                    Found {extracted.length} medication{extracted.length !== 1 ? 's' : ''}:
                  </h3>
                  <div className="space-y-2">
                    {extracted.map((med, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div>
                          <p className="font-medium text-slate-800">{med.name}</p>
                          <p className="text-sm text-slate-500">
                            {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleSave} loading={saving} className="w-full mt-4">
                    Save All Medications
                  </Button>
                </div>
              )}

              {extracted && extracted.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  No medications found in the image. Try uploading a clearer screenshot.
                </p>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
