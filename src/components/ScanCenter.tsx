'use client'

import { useState } from 'react'
import { DocumentScanner } from './DocumentScanner'
import { CategoryScanner, type ScanCategory } from './CategoryScanner'

const CATEGORIES = [
  { id: 'lab', label: 'Lab Reports', emoji: '🧪', color: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)', types: ['lab_report'] },
  { id: 'prescription', label: 'Prescriptions', emoji: '💊', color: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.2)', types: ['medication'] },
  { id: 'insurance', label: 'Insurance/EOBs', emoji: '🏥', color: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.2)', types: ['insurance_card', 'eob_bill'] },
  { id: 'medical', label: 'Medical Records', emoji: '📋', color: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)', types: ['doctor_note'] },
]

interface ScanCenterProps {
  documents?: { id: string; type: string; description: string | null; document_date: string | null }[]
}

export function ScanCenter({ documents = [] }: ScanCenterProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanType, setScanType] = useState<string | null>(null)

  const filteredDocs = activeCategory
    ? documents.filter((d) => {
        const cat = CATEGORIES.find((c) => c.id === activeCategory)
        return cat?.types.includes(d.type)
      })
    : documents

  const getCategoryCount = (catId: string) => {
    const cat = CATEGORIES.find((c) => c.id === catId)
    return documents.filter((d) => cat?.types.includes(d.type)).length
  }

  if (scanning && scanType) {
    return <CategoryScanner category={scanType as ScanCategory} onClose={() => { setScanning(false); setScanType(null) }} />
  }

  if (scanning) {
    return <DocumentScanner onClose={() => setScanning(false)} />
  }

  return (
    <div className="px-5 py-6">
      <h2 className="text-[#f1f5f9] text-xl font-bold mb-1">Scan Center</h2>
      <p className="text-[#64748b] text-sm mb-5">Upload and manage your medical documents</p>

      {/* Category grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className={`rounded-xl p-4 text-center transition-all duration-200 animate-press border ${
              activeCategory === cat.id ? 'border-[rgba(34,211,238,0.3)] ring-1 ring-[rgba(34,211,238,0.1)]' : ''
            }`}
            style={{
              background: cat.color,
              borderColor: activeCategory === cat.id ? 'rgba(34,211,238,0.3)' : cat.borderColor,
              animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both`,
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div className="text-2xl mb-1">{cat.emoji}</div>
            <div className="text-[#f1f5f9] text-sm font-semibold">{cat.label}</div>
            <div className="text-[#64748b] text-xs">{getCategoryCount(cat.id)} documents</div>
          </button>
        ))}
      </div>

      {/* Recent scans */}
      <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-3">
        {activeCategory ? CATEGORIES.find((c) => c.id === activeCategory)?.label : 'Recent Scans'}
      </div>

      {filteredDocs.length === 0 ? (
        <div className="text-center py-8 text-[#64748b] text-sm">
          {activeCategory ? 'No documents in this category' : 'No documents scanned yet'}
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {filteredDocs.slice(0, 10).map((doc) => {
            const cat = CATEGORIES.find((c) => c.types.includes(doc.type))
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl p-3"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{ background: cat?.color || 'rgba(255,255,255,0.04)' }}
                >
                  {cat?.emoji || '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[#f1f5f9] text-sm font-semibold truncate">
                    {doc.description || doc.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[#64748b] text-xs">
                    {doc.document_date ? new Date(doc.document_date).toLocaleDateString() : 'Unknown date'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Scan button */}
      <button
        onClick={() => setScanning(true)}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold tracking-wide animate-press"
      >
        + Scan New Document
      </button>
    </div>
  )
}
