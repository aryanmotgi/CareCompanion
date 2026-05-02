'use client'

import { useState, useMemo, useCallback } from 'react'
import { useCsrfToken } from '@/components/CsrfProvider'
import { useToast } from '@/components/ToastProvider'

// ---------- Types ----------
type DocCategory = 'all' | 'medical' | 'insurance' | 'lab' | 'prescriptions' | 'other'
type SortOption = 'date-newest' | 'date-oldest' | 'category' | 'name'
type ViewMode = 'grid' | 'list'

interface OrganizableDocument {
  id: string
  type: string
  description: string | null
  document_date: string | null
}

interface DocumentOrganizerProps {
  documents: OrganizableDocument[]
  onScanNew: () => void
  onDocumentsChanged?: () => void
}

// ---------- Category config ----------
const CATEGORY_MAP: Record<string, DocCategory> = {
  doctor_note: 'medical',
  visit_summary: 'medical',
  insurance_card: 'insurance',
  eob_bill: 'insurance',
  eob: 'insurance',
  lab_report: 'lab',
  medication: 'prescriptions',
  prescription: 'prescriptions',
}

const CATEGORY_CONFIG: Record<Exclude<DocCategory, 'all'>, { label: string; color: string; bg: string; border: string; icon: string }> = {
  medical: {
    label: 'Medical Records',
    color: '#6366F1',
    bg: 'bg-[#6366F1]/10',
    border: 'border-[#6366F1]/20',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
  insurance: {
    label: 'Insurance',
    color: '#A78BFA',
    bg: 'bg-[#A78BFA]/10',
    border: 'border-[#A78BFA]/20',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
  },
  lab: {
    label: 'Lab Reports',
    color: '#10b981',
    bg: 'bg-[#10b981]/10',
    border: 'border-[#10b981]/20',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
  },
  prescriptions: {
    label: 'Prescriptions',
    color: '#eab308',
    bg: 'bg-[#eab308]/10',
    border: 'border-[#eab308]/20',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
  other: {
    label: 'Other',
    color: '#64748b',
    bg: 'bg-[#64748b]/10',
    border: 'border-[#64748b]/20',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
}

const TABS: { id: DocCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'medical', label: 'Medical' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'lab', label: 'Lab Reports' },
  { id: 'prescriptions', label: 'Rx' },
  { id: 'other', label: 'Other' },
]

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'date-newest', label: 'Newest First' },
  { id: 'date-oldest', label: 'Oldest First' },
  { id: 'category', label: 'Category' },
  { id: 'name', label: 'Name A-Z' },
]

// ---------- Helpers ----------
function resolveCategory(type: string): Exclude<DocCategory, 'all'> {
  return (CATEGORY_MAP[type] ?? 'other') as Exclude<DocCategory, 'all'>
}

function docName(doc: OrganizableDocument): string {
  return doc.description || doc.type.replace(/_/g, ' ')
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown date'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------- Component ----------
export function DocumentOrganizer({ documents, onScanNew, onDocumentsChanged }: DocumentOrganizerProps) {
  const csrfToken = useCsrfToken()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<DocCategory>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('date-newest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('scans-view') as ViewMode) || 'list'
    }
    return 'list'
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [showRecategorize, setShowRecategorize] = useState(false)

  // Memoized filtered + sorted docs
  const filteredDocs = useMemo(() => {
    let docs = [...documents]

    // Category filter
    if (activeTab !== 'all') {
      docs = docs.filter((d) => resolveCategory(d.type) === activeTab)
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      docs = docs.filter((d) => {
        const name = docName(d).toLowerCase()
        const type = d.type.toLowerCase()
        return name.includes(q) || type.includes(q)
      })
    }

    // Sort
    docs.sort((a, b) => {
      switch (sort) {
        case 'date-newest':
          return (b.document_date ?? '').localeCompare(a.document_date ?? '')
        case 'date-oldest':
          return (a.document_date ?? '').localeCompare(b.document_date ?? '')
        case 'category':
          return resolveCategory(a.type).localeCompare(resolveCategory(b.type))
        case 'name':
          return docName(a).localeCompare(docName(b))
        default:
          return 0
      }
    })

    return docs
  }, [documents, activeTab, search, sort])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: documents.length }
    for (const doc of documents) {
      const cat = resolveCategory(doc.type)
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [documents])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (selected.size === filteredDocs.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredDocs.map((d) => d.id)))
    }
  }, [filteredDocs, selected.size])

  const exitBulkMode = useCallback(() => {
    setBulkMode(false)
    setSelected(new Set())
    setShowRecategorize(false)
  }, [])

  const handleViewChange = useCallback((newView: ViewMode) => {
    setViewMode(newView)
    localStorage.setItem('scans-view', newView)
  }, [])

  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[#f1f5f9] text-xl font-bold">Documents</h2>
        <div className="flex items-center gap-2">
          {bulkMode ? (
            <button onClick={exitBulkMode} className="text-xs text-[#94a3b8] hover:text-[#f1f5f9] transition-colors px-2 py-1">
              Cancel
            </button>
          ) : (
            documents.length > 0 && (
              <button
                onClick={() => setBulkMode(true)}
                className="text-xs text-[#94a3b8] hover:text-[#f1f5f9] transition-colors px-2 py-1"
              >
                Select
              </button>
            )
          )}
        </div>
      </div>
      <p className="text-[#94a3b8] text-sm mb-5">Organize and manage your medical documents</p>

      {/* Search bar */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]"
          fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search by filename or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#f1f5f9] placeholder:text-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#6366F1]/40 focus:border-[#6366F1]/40 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#94a3b8]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-4 px-4 sm:-mx-5 sm:px-5 flex-nowrap" role="tablist" aria-label="Filter documents by category">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          const count = categoryCounts[tab.id] || 0
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 min-h-[44px] flex items-center rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/20'
                  : 'bg-white/[0.04] text-[#94a3b8] border border-white/[0.08] hover:bg-white/[0.08]'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 ${isActive ? 'text-white/70' : 'text-[#64748b]'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Toolbar: sort + view toggle */}
      <div className="flex items-center justify-between mb-4">
        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            aria-expanded={showSortMenu}
            aria-haspopup="true"
            className="flex items-center gap-1.5 text-xs text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
            {SORT_OPTIONS.find((s) => s.id === sort)?.label}
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 bg-[#1e293b] border border-white/[0.08] rounded-xl shadow-xl shadow-black/40 py-1 min-w-[150px]">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setSort(opt.id); setShowSortMenu(false) }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                      sort === opt.id ? 'text-[#6366F1] bg-[#6366F1]/10' : 'text-[#94a3b8] hover:bg-white/[0.04]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
          <button
            onClick={() => handleViewChange('list')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-[#6366F1] text-white' : 'text-[#64748b] hover:text-[#94a3b8]'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <button
            onClick={() => handleViewChange('grid')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-[#6366F1] text-white' : 'text-[#64748b] hover:text-[#94a3b8]'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {bulkMode && selected.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20">
          <button
            onClick={selectAll}
            className="text-xs text-[#6366F1] font-medium hover:underline"
          >
            {selected.size === filteredDocs.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs text-[#94a3b8] mx-1">
            {selected.size} selected
          </span>
          <div className="flex-1" />
          <div className="relative">
            <button
              onClick={() => setShowRecategorize(!showRecategorize)}
              aria-expanded={showRecategorize}
              aria-haspopup="true"
              className="flex items-center gap-1 text-xs font-medium text-[#A78BFA] bg-[#A78BFA]/10 px-3 py-1.5 rounded-lg hover:bg-[#A78BFA]/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
              </svg>
              Re-categorize
            </button>
            {showRecategorize && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowRecategorize(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-[#1e293b] border border-white/[0.08] rounded-xl shadow-xl shadow-black/40 py-1 min-w-[160px]">
                  {(Object.keys(CATEGORY_CONFIG) as Array<Exclude<DocCategory, 'all'>>).map((catId) => {
                    const cfg = CATEGORY_CONFIG[catId]
                    return (
                      <button
                        key={catId}
                        onClick={() => {
                          // In a real app this would call an API to update document categories
                          setShowRecategorize(false)
                          exitBulkMode()
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs text-[#94a3b8] hover:bg-white/[0.04] transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          <button
            onClick={async () => {
              if (!window.confirm(`Delete ${selected.size} document${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
              const ids = [...selected]
              const results = await Promise.allSettled(
                ids.map((id) =>
                  fetch(`/api/documents/${id}`, {
                    method: 'DELETE',
                    headers: { 'x-csrf-token': csrfToken },
                  })
                )
              )
              const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
              if (failed > 0) {
                showToast(`Failed to delete ${failed} document${failed !== 1 ? 's' : ''}`, 'error')
              } else {
                showToast(`Deleted ${ids.length} document${ids.length !== 1 ? 's' : ''}`, 'success')
              }
              exitBulkMode()
              onDocumentsChanged?.()
            }}
            className="flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      )}

      {/* Document list/grid */}
      {filteredDocs.length === 0 ? (
        <EmptyState category={activeTab} search={search} onScanNew={onScanNew} />
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {filteredDocs.map((doc, i) => (
            <DocumentListCard
              key={doc.id}
              doc={doc}
              index={i}
              bulkMode={bulkMode}
              isSelected={selected.has(doc.id)}
              onToggleSelect={() => toggleSelect(doc.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredDocs.map((doc, i) => (
            <DocumentGridCard
              key={doc.id}
              doc={doc}
              index={i}
              bulkMode={bulkMode}
              isSelected={selected.has(doc.id)}
              onToggleSelect={() => toggleSelect(doc.id)}
            />
          ))}
        </div>
      )}

    </div>
  )
}

// ---------- Sub-components ----------

function DocumentListCard({
  doc,
  index,
  bulkMode,
  isSelected,
  onToggleSelect,
}: {
  doc: OrganizableDocument
  index: number
  bulkMode: boolean
  isSelected: boolean
  onToggleSelect: () => void
}) {
  const cat = resolveCategory(doc.type)
  const cfg = CATEGORY_CONFIG[cat]

  return (
    <div
      onClick={bulkMode ? onToggleSelect : undefined}
      onKeyDown={bulkMode ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSelect(); } } : undefined}
      role={bulkMode ? 'checkbox' : undefined}
      aria-checked={bulkMode ? isSelected : undefined}
      tabIndex={bulkMode ? 0 : undefined}
      className={`flex items-center gap-3 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border p-3.5 transition-all ${
        isSelected ? 'border-[#6366F1]/40 bg-[#6366F1]/5' : 'border-white/[0.08]'
      } ${bulkMode ? 'cursor-pointer' : ''}`}
      style={{
        animation: `card-stagger-in 0.35s cubic-bezier(0.4,0,0.2,1) both`,
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* Checkbox in bulk mode */}
      {bulkMode && (
        <div
          aria-hidden="true"
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isSelected ? 'bg-[#6366F1] border-[#6366F1]' : 'border-[#64748b]/40'
          }`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </div>
      )}

      {/* Type icon */}
      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <svg className="w-5 h-5" style={{ color: cfg.color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-[#f1f5f9] text-sm font-semibold truncate">{docName(doc)}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="text-[#64748b] text-xs">{formatDate(doc.document_date)}</span>
        </div>
      </div>

      {/* Chevron (not in bulk mode) */}
      {!bulkMode && (
        <svg className="w-4 h-4 text-[#64748b] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </div>
  )
}

function DocumentGridCard({
  doc,
  index,
  bulkMode,
  isSelected,
  onToggleSelect,
}: {
  doc: OrganizableDocument
  index: number
  bulkMode: boolean
  isSelected: boolean
  onToggleSelect: () => void
}) {
  const cat = resolveCategory(doc.type)
  const cfg = CATEGORY_CONFIG[cat]

  return (
    <div
      onClick={bulkMode ? onToggleSelect : undefined}
      onKeyDown={bulkMode ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSelect(); } } : undefined}
      role={bulkMode ? 'checkbox' : undefined}
      aria-checked={bulkMode ? isSelected : undefined}
      tabIndex={bulkMode ? 0 : undefined}
      className={`relative rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border p-4 transition-all ${
        isSelected ? 'border-[#6366F1]/40 bg-[#6366F1]/5' : 'border-white/[0.08]'
      } ${bulkMode ? 'cursor-pointer' : ''}`}
      style={{
        animation: `card-stagger-in 0.35s cubic-bezier(0.4,0,0.2,1) both`,
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* Checkbox overlay */}
      {bulkMode && (
        <div
          aria-hidden="true"
          className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
            isSelected ? 'bg-[#6366F1] border-[#6366F1]' : 'border-[#64748b]/40 bg-black/20'
          }`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </div>
      )}

      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl ${cfg.bg} flex items-center justify-center mb-3`}>
        <svg className="w-5 h-5" style={{ color: cfg.color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
        </svg>
      </div>

      {/* Name */}
      <div className="text-[#f1f5f9] text-sm font-semibold truncate mb-1.5">{docName(doc)}</div>

      {/* Category badge */}
      <span
        className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-1.5"
        style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
      >
        {cfg.label}
      </span>

      {/* Date + source */}
      <div className="text-[#64748b] text-xs">{formatDate(doc.document_date)}</div>
      <div className="text-[#475569] text-[10px] mt-0.5">Scanned</div>
    </div>
  )
}

function EmptyState({
  category,
  search,
  onScanNew,
}: {
  category: DocCategory
  search: string
  onScanNew: () => void
}) {
  if (search) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#64748b]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <p className="text-[#f1f5f9] font-semibold text-sm mb-1">No results found</p>
        <p className="text-[#64748b] text-xs">No documents match &ldquo;{search}&rdquo;</p>
      </div>
    )
  }

  const catConfig = category !== 'all' ? CATEGORY_CONFIG[category] : null

  return (
    <div className="text-center py-12">
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
          catConfig ? catConfig.bg : 'bg-white/[0.04]'
        } border ${catConfig ? catConfig.border : 'border-white/[0.08]'}`}
      >
        <svg
          className="w-6 h-6"
          style={{ color: catConfig?.color ?? '#64748b' }}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={catConfig?.icon ?? 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'}
          />
        </svg>
      </div>
      <p className="text-[#f1f5f9] font-semibold text-sm mb-1">
        {catConfig ? `No ${catConfig.label.toLowerCase()} documents yet` : 'No documents yet'}
      </p>
      <p className="text-[#64748b] text-xs mb-5">
        {catConfig
          ? `Scan or upload a document to add it to ${catConfig.label.toLowerCase()}`
          : 'Scan your first medical document to get started'}
      </p>
      <button
        onClick={onScanNew}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 text-sm font-medium text-[#6366F1] hover:bg-[#6366F1]/20 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Scan Document
      </button>
    </div>
  )
}
