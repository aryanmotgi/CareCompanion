'use client'

import { useState, useMemo } from 'react'
import { useToast } from '@/components/ToastProvider'
import type { Medication, Appointment, LabResult, Document } from '@/lib/types'

/* ─── Types ─── */

type Category = 'all' | 'medications' | 'labs' | 'appointments' | 'documents' | 'conditions'

interface UnifiedRecord {
  id: string
  type: 'medication' | 'lab' | 'appointment' | 'document' | 'condition'
  title: string
  date: string | null
  source: string | null
  summary: string
  raw: Medication | Appointment | LabResult | Document | { name: string }
}

interface RecordsViewProps {
  medications: Medication[]
  appointments: Appointment[]
  labResults: LabResult[]
  documents: Document[]
  conditions: string | null
  allergies: string | null
}

/* ─── Icons (inline SVGs) ─── */

function MedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5A2.25 2.25 0 0 0 8.25 22.5h7.5A2.25 2.25 0 0 0 18 20.25V3.75A2.25 2.25 0 0 0 15.75 1.5H13.5" />
      <rect x="9" y="0" width="6" height="3" rx="1" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  )
}

function LabIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3h6v6l4 8a2 2 0 0 1-1.8 2.9H6.8A2 2 0 0 1 5 17l4-8V3z" />
      <line x1="9" y1="3" x2="15" y2="3" />
      <path d="M8 15h8" />
    </svg>
  )
}

function ApptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function ConditionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#94a3b8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

/* ─── Helpers ─── */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No date'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

function getRecordIcon(type: UnifiedRecord['type']) {
  switch (type) {
    case 'medication':
      return <MedIcon />
    case 'lab':
      return <LabIcon />
    case 'appointment':
      return <ApptIcon />
    case 'document':
      return <DocIcon />
    case 'condition':
      return <ConditionIcon />
  }
}

function getTypeBadgeColor(type: UnifiedRecord['type']): string {
  switch (type) {
    case 'medication':
      return 'bg-[#A78BFA]/15 text-[#A78BFA]'
    case 'lab':
      return 'bg-[#6366F1]/15 text-[#6366F1]'
    case 'appointment':
      return 'bg-[#10b981]/15 text-[#10b981]'
    case 'document':
      return 'bg-[#eab308]/15 text-[#eab308]'
    case 'condition':
      return 'bg-[#f472b6]/15 text-[#f472b6]'
  }
}

function getTypeLabel(type: UnifiedRecord['type']): string {
  switch (type) {
    case 'medication':
      return 'Medication'
    case 'lab':
      return 'Lab Result'
    case 'appointment':
      return 'Appointment'
    case 'document':
      return 'Document'
    case 'condition':
      return 'Condition'
  }
}

/* ─── Subcomponents ─── */

function RecordCard({ record }: { record: UnifiedRecord }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      aria-expanded={expanded}
      className="w-full text-left rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] px-4 py-3.5 transition-colors hover:border-white/[0.14]"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">{getRecordIcon(record.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-[#f1f5f9] truncate">
              {record.title}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getTypeBadgeColor(record.type)}`}
            >
              {getTypeLabel(record.type)}
            </span>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1 line-clamp-1">
            {record.summary}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-[#64748b]">
            <span>{formatDate(record.date)}</span>
            {record.source && (
              <>
                <span className="text-white/10">|</span>
                <span>{record.source}</span>
              </>
            )}
          </div>
        </div>
        <div className="mt-1 flex-shrink-0">
          <ChevronIcon open={expanded} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <RecordDetails record={record} />
        </div>
      )}
    </button>
  )
}

function RecordDetails({ record }: { record: UnifiedRecord }) {
  switch (record.type) {
    case 'medication': {
      const med = record.raw as Medication
      return (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {med.dose && (
            <div>
              <span className="text-[#64748b]">Dose</span>
              <p className="text-[#f1f5f9] mt-0.5">{med.dose}</p>
            </div>
          )}
          {med.frequency && (
            <div>
              <span className="text-[#64748b]">Frequency</span>
              <p className="text-[#f1f5f9] mt-0.5">{med.frequency}</p>
            </div>
          )}
          {med.prescribingDoctor && (
            <div>
              <span className="text-[#64748b]">Prescribed by</span>
              <p className="text-[#f1f5f9] mt-0.5">{med.prescribingDoctor}</p>
            </div>
          )}
          {med.refillDate && (
            <div>
              <span className="text-[#64748b]">Next refill</span>
              <p className="text-[#f1f5f9] mt-0.5">{formatDate(med.refillDate)}</p>
            </div>
          )}
          {med.notes && (
            <div className="col-span-2">
              <span className="text-[#64748b]">Notes</span>
              <p className="text-[#f1f5f9] mt-0.5">{med.notes}</p>
            </div>
          )}
        </div>
      )
    }
    case 'lab': {
      const lab = record.raw as LabResult
      return (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {lab.value && (
            <div>
              <span className="text-[#64748b]">Value</span>
              <p className={`mt-0.5 ${lab.isAbnormal ? 'text-[#ef4444] font-medium' : 'text-[#f1f5f9]'}`}>
                {lab.value} {lab.unit || ''}
              </p>
            </div>
          )}
          {lab.referenceRange && (
            <div>
              <span className="text-[#64748b]">Reference range</span>
              <p className="text-[#f1f5f9] mt-0.5">{lab.referenceRange}</p>
            </div>
          )}
          {lab.isAbnormal && (
            <div className="col-span-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#ef4444]/10 text-[#ef4444] text-[11px] font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Abnormal result — discuss with your care team
              </span>
            </div>
          )}
        </div>
      )
    }
    case 'appointment': {
      const appt = record.raw as Appointment
      return (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {appt.doctorName && (
            <div>
              <span className="text-[#64748b]">Provider</span>
              <p className="text-[#f1f5f9] mt-0.5">{appt.doctorName}</p>
            </div>
          )}
          {appt.specialty && (
            <div>
              <span className="text-[#64748b]">Specialty</span>
              <p className="text-[#f1f5f9] mt-0.5">{appt.specialty}</p>
            </div>
          )}
          {appt.location && (
            <div>
              <span className="text-[#64748b]">Location</span>
              <p className="text-[#f1f5f9] mt-0.5">{appt.location}</p>
            </div>
          )}
          {appt.purpose && (
            <div>
              <span className="text-[#64748b]">Purpose</span>
              <p className="text-[#f1f5f9] mt-0.5">{appt.purpose}</p>
            </div>
          )}
        </div>
      )
    }
    case 'document': {
      const doc = record.raw as Document
      return (
        <div className="space-y-2 text-xs">
          {doc.type && (
            <div>
              <span className="text-[#64748b]">Type</span>
              <p className="text-[#f1f5f9] mt-0.5">{doc.type}</p>
            </div>
          )}
          {doc.description && (
            <div>
              <span className="text-[#64748b]">Description</span>
              <p className="text-[#f1f5f9] mt-0.5">{doc.description}</p>
            </div>
          )}
        </div>
      )
    }
    case 'condition': {
      return (
        <div className="text-xs text-[#94a3b8]">
          Condition recorded in your care profile. Discuss any changes with your care team.
        </div>
      )
    }
  }
}

function EmptyState({ category }: { category: Category }) {
  const messages: Record<Category, { title: string; desc: string }> = {
    all: {
      title: 'No health records yet',
      desc: 'Connect a health system to import your records, or they will appear here as you use CareCompanion.',
    },
    medications: {
      title: 'No medications recorded',
      desc: 'Medications will appear here once added through chat or synced from a connected health system.',
    },
    labs: {
      title: 'No lab results',
      desc: 'Lab results will show up here after syncing with your health provider.',
    },
    appointments: {
      title: 'No appointments',
      desc: 'Appointments will appear here once added or synced from a connected system.',
    },
    documents: {
      title: 'No documents',
      desc: 'Scanned or uploaded documents will be listed here.',
    },
    conditions: {
      title: 'No conditions recorded',
      desc: 'Conditions and allergies from your care profile will appear here.',
    },
  }

  const msg = messages[category]

  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mb-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <p className="text-sm text-[#94a3b8]">{msg.title}</p>
      <p className="text-xs text-[#64748b] mt-1 max-w-[260px]">{msg.desc}</p>
    </div>
  )
}

/* ─── Main Component ─── */

export function RecordsView({
  medications,
  appointments,
  labResults,
  documents,
  conditions,
  allergies,
}: RecordsViewProps) {
  const { showToast } = useToast()
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')

  // Build unified records
  const allRecords = useMemo<UnifiedRecord[]>(() => {
    const records: UnifiedRecord[] = []

    // Medications
    for (const med of medications) {
      records.push({
        id: `med-${med.id}`,
        type: 'medication',
        title: med.name,
        date: med.createdAt ? med.createdAt.toISOString() : null,
        source: med.notes?.startsWith('Synced from') ? med.notes.replace('Synced from ', '') : null,
        summary: [med.dose, med.frequency].filter(Boolean).join(' — ') || 'No details',
        raw: med,
      })
    }

    // Lab results
    for (const lab of labResults) {
      records.push({
        id: `lab-${lab.id}`,
        type: 'lab',
        title: lab.testName,
        date: lab.dateTaken || (lab.createdAt ? lab.createdAt.toISOString() : null),
        source: lab.source,
        summary: `${lab.value ?? '—'} ${lab.unit ?? ''} ${lab.isAbnormal ? '(abnormal)' : ''}`.trim(),
        raw: lab,
      })
    }

    // Appointments
    for (const appt of appointments) {
      records.push({
        id: `appt-${appt.id}`,
        type: 'appointment',
        title: appt.purpose || `${appt.specialty || 'Appointment'}${appt.doctorName ? ` with ${appt.doctorName}` : ''}`,
        date: appt.dateTime ? appt.dateTime.toISOString() : (appt.createdAt ? appt.createdAt.toISOString() : null),
        source: null,
        summary: [appt.doctorName, appt.specialty, appt.location].filter(Boolean).join(' — ') || 'No details',
        raw: appt,
      })
    }

    // Documents
    for (const doc of documents) {
      records.push({
        id: `doc-${doc.id}`,
        type: 'document',
        title: doc.description || doc.type || 'Document',
        date: doc.documentDate || (doc.createdAt ? doc.createdAt.toISOString() : null),
        source: null,
        summary: doc.type || 'Uploaded document',
        raw: doc,
      })
    }

    // Conditions
    if (conditions) {
      const condList = conditions
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean)
      for (let i = 0; i < condList.length; i++) {
        records.push({
          id: `cond-${i}`,
          type: 'condition',
          title: condList[i],
          date: null,
          source: null,
          summary: 'Active condition',
          raw: { name: condList[i] },
        })
      }
    }

    // Allergies as conditions
    if (allergies) {
      const allergyList = allergies
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean)
      for (let i = 0; i < allergyList.length; i++) {
        records.push({
          id: `allergy-${i}`,
          type: 'condition',
          title: `Allergy: ${allergyList[i]}`,
          date: null,
          source: null,
          summary: 'Allergy',
          raw: { name: allergyList[i] },
        })
      }
    }

    // Sort by date descending, null dates last
    records.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return records
  }, [medications, labResults, appointments, documents, conditions, allergies])

  // Filter records
  const filteredRecords = useMemo(() => {
    let filtered = allRecords

    if (activeCategory !== 'all') {
      const typeMap: Record<Category, UnifiedRecord['type'] | undefined> = {
        all: undefined,
        medications: 'medication',
        labs: 'lab',
        appointments: 'appointment',
        documents: 'document',
        conditions: 'condition',
      }
      const type = typeMap[activeCategory]
      if (type) {
        filtered = filtered.filter((r) => r.type === type)
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          (r.source && r.source.toLowerCase().includes(q))
      )
    }

    return filtered
  }, [allRecords, activeCategory, search])

  const categories: { key: Category; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: allRecords.length },
    { key: 'medications', label: 'Medications', count: allRecords.filter((r) => r.type === 'medication').length },
    { key: 'labs', label: 'Lab Results', count: allRecords.filter((r) => r.type === 'lab').length },
    { key: 'appointments', label: 'Appointments', count: allRecords.filter((r) => r.type === 'appointment').length },
    { key: 'documents', label: 'Documents', count: allRecords.filter((r) => r.type === 'document').length },
    { key: 'conditions', label: 'Conditions', count: allRecords.filter((r) => r.type === 'condition').length },
  ]

  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Health Records</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          All your health data in one place
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
        <input
          type="text"
          placeholder="Search records..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[#f1f5f9] placeholder:text-[#64748b] focus:outline-none focus:border-[#6366F1]/40 transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute inset-y-0 right-3 flex items-center text-[#64748b] hover:text-[#94a3b8]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-5 sm:px-5 scrollbar-none flex-nowrap" role="tablist" aria-label="Filter records by category">
        {categories.map((cat) => (
          <button
            key={cat.key}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 min-h-[44px] rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.key
                ? 'bg-[#6366F1] text-white'
                : 'bg-white/[0.06] text-[#94a3b8] hover:bg-white/[0.10]'
            }`}
          >
            {cat.label}
            {cat.count > 0 && (
              <span
                className={`text-[10px] ${
                  activeCategory === cat.key
                    ? 'text-white/70'
                    : 'text-[#64748b]'
                }`}
              >
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Records List */}
      {filteredRecords.length > 0 ? (
        <div className="space-y-2.5">
          {filteredRecords.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <EmptyState category={activeCategory} />
      )}
    </div>
  )
}
