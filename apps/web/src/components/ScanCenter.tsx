'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentScanner } from './DocumentScanner'
import { CategoryScanner, type ScanCategory } from './CategoryScanner'
import { DocumentOrganizer } from './DocumentOrganizer'

const QUICK_SCAN_CATEGORIES: { id: ScanCategory; label: string; icon: string; color: string }[] = [
  {
    id: 'medication',
    label: 'Medication',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0',
    color: '#A78BFA',
  },
  {
    id: 'lab_report',
    label: 'Lab Report',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3',
    color: '#10b981',
  },
  {
    id: 'insurance',
    label: 'Insurance',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
    color: '#6366F1',
  },
  {
    id: 'doctor_note',
    label: 'Doctor Note',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
    color: '#eab308',
  },
]

interface ScanCenterProps {
  documents?: { id: string; type: string; description: string | null; document_date: string | null }[]
}

export function ScanCenter({ documents = [] }: ScanCenterProps) {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [scanType, setScanType] = useState<ScanCategory | null>(null)
  const [showQuickScan, setShowQuickScan] = useState(false)

  const handleSaved = () => {
    router.refresh()
  }

  // Category scanner modal
  if (scanning && scanType) {
    return (
      <CategoryScanner
        category={scanType}
        onClose={() => { setScanning(false); setScanType(null) }}
        onSaved={handleSaved}
      />
    )
  }

  // General scanner modal
  if (scanning && !scanType) {
    return <DocumentScanner onClose={() => setScanning(false)} onSaved={handleSaved} />
  }

  // Quick-scan picker overlay
  if (showQuickScan) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-[#0f172a] border-t border-white/[0.08] rounded-t-2xl p-5 pb-8 animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[#f1f5f9] font-semibold text-base">What are you scanning?</h3>
            <button
              onClick={() => setShowQuickScan(false)}
              className="text-[#64748b] hover:text-[#94a3b8] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {QUICK_SCAN_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setShowQuickScan(false)
                  setScanType(cat.id)
                  setScanning(true)
                }}
                className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4 hover:border-white/[0.16] transition-all active:scale-[0.97]"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}15` }}>
                  <svg className="w-5 h-5" style={{ color: cat.color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                  </svg>
                </div>
                <span className="text-[#f1f5f9] text-sm font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setShowQuickScan(false)
              setScanType(null)
              setScanning(true)
            }}
            className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#94a3b8] text-sm font-medium hover:bg-white/[0.08] transition-colors"
          >
            Auto-detect (scan anything)
          </button>
        </div>
      </div>
    )
  }

  return (
    <DocumentOrganizer
      documents={documents}
      onScanNew={() => setShowQuickScan(true)}
      onDocumentsChanged={handleSaved}
    />
  )
}
