'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { AppealGenerator } from './AppealGenerator'
import type { Claim } from '@/lib/types'

type FilterTab = 'all' | 'pending' | 'paid' | 'denied' | 'in_review'

interface InsuranceViewProps {
  claims: Claim[]
  insuranceProvider: string | null
  memberId: string | null
  deductibleLimit: number | null
  deductibleUsed: number
  oopLimit: number | null
  oopUsed: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: 'Approved', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  pending: { label: 'Pending', color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  denied: { label: 'Denied', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  in_review: { label: 'In Review', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
  { key: 'in_review', label: 'In Review' },
]

function formatCurrency(val: number | string | null | undefined): string {
  if (val == null) return '$0.00'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function InsuranceView({
  claims,
  insuranceProvider,
  memberId,
  deductibleLimit,
  deductibleUsed,
  oopLimit,
  oopUsed,
}: InsuranceViewProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  // Summary stats
  const stats = useMemo(() => {
    const totalClaims = claims.length
    const approvedAmount = claims
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + parseFloat(c.paidAmount || '0'), 0)
    const pendingCount = claims.filter((c) => c.status === 'pending').length
    const deniedCount = claims.filter((c) => c.status === 'denied').length
    return { totalClaims, approvedAmount, pendingCount, deniedCount }
  }, [claims])

  // Filtered claims
  const filteredClaims = useMemo(() => {
    if (activeTab === 'all') return claims
    return claims.filter((c) => c.status === activeTab)
  }, [claims, activeTab])

  const deductiblePercent =
    deductibleLimit && deductibleLimit > 0
      ? Math.min((deductibleUsed / deductibleLimit) * 100, 100)
      : 0

  const oopPercent =
    oopLimit && oopLimit > 0 ? Math.min((oopUsed / oopLimit) * 100, 100) : 0

  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#f1f5f9]">Insurance & Claims</h1>
          {insuranceProvider && (
            <p className="text-xs text-[#94a3b8] mt-0.5">
              {insuranceProvider}
              {memberId && <span className="ml-1.5 text-[#64748b]">#{memberId}</span>}
            </p>
          )}
        </div>
        {!insuranceProvider && (
          <Link
            href={`/chat?prompt=${encodeURIComponent('Add my insurance — provider name, member ID, and group number')}`}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
            style={{ background: 'linear-gradient(to right, #6366F1, #A78BFA)' }}
          >
            + Add Insurance
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1">Total Claims</p>
          <p className="text-xl font-bold text-[#f1f5f9]">{stats.totalClaims}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1">Approved</p>
          <p className="text-xl font-bold text-[#10b981]">{formatCurrency(stats.approvedAmount)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1">Pending</p>
          <p className="text-xl font-bold text-[#eab308]">{stats.pendingCount}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1">Denied</p>
          <p className="text-xl font-bold text-[#ef4444]">{stats.deniedCount}</p>
        </div>
      </div>

      {/* Deductible & OOP progress (if insurance data exists) */}
      {(deductibleLimit || oopLimit) && (
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4 mb-5 space-y-3">
          {deductibleLimit != null && deductibleLimit > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[#94a3b8]">Deductible</span>
                <span className="text-xs text-[#f1f5f9] font-medium">
                  {formatCurrency(deductibleUsed)} / {formatCurrency(deductibleLimit)}
                </span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden" role="progressbar" aria-valuenow={deductibleUsed} aria-valuemin={0} aria-valuemax={deductibleLimit ?? 0} aria-label="Deductible progress">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#A78BFA] transition-all duration-500"
                  style={{ width: `${deductiblePercent}%` }}
                />
              </div>
            </div>
          )}
          {oopLimit != null && oopLimit > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[#94a3b8]">Out-of-Pocket Max</span>
                <span className="text-xs text-[#f1f5f9] font-medium">
                  {formatCurrency(oopUsed)} / {formatCurrency(oopLimit)}
                </span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden" role="progressbar" aria-valuenow={oopUsed} aria-valuemin={0} aria-valuemax={oopLimit ?? 0} aria-label="Out-of-pocket progress">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#10b981] transition-all duration-500"
                  style={{ width: `${oopPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide flex-nowrap -mx-4 px-4 sm:-mx-5 sm:px-5" role="tablist" aria-label="Filter claims by status">
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-1.5 min-h-[44px] flex items-center rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white'
                  : 'bg-white/[0.04] border border-white/[0.08] text-[#94a3b8] hover:bg-white/[0.08]'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Claims list */}
      {filteredClaims.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mb-3">
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M9 12h6M9 16h6M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9l-6-6z"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13 3v6h6"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm text-[#94a3b8]">
            {activeTab === 'all'
              ? 'No claims found'
              : `No ${FILTER_TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} claims`}
          </p>
          <p className="text-xs text-[#64748b] mt-1">
            {activeTab === 'all'
              ? 'Claims from your insurance will appear here once synced.'
              : `No ${FILTER_TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} claims right now.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClaims.map((claim) => {
            const status = STATUS_CONFIG[claim.status ?? ''] || STATUS_CONFIG.pending
            const isExpanded = expandedId === claim.id

            return (
              <div
                key={claim.id}
                className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden transition-all"
              >
                {/* Collapsed row */}
                <button
                  type="button"
                  onClick={() => toggleExpand(claim.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left px-4 py-3.5 min-h-[44px] flex items-center gap-3"
                >
                  {/* Status indicator dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: status.color }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-[#f1f5f9] truncate">
                        {claim.providerName || 'Unknown Provider'}
                      </p>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          color: status.color,
                          backgroundColor: status.bg,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                      <span>{formatDate(claim.serviceDate)}</span>
                      <span className="text-[#334155]">|</span>
                      <span className="text-[#f1f5f9] font-medium">
                        {formatCurrency(claim.billedAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className={`text-[#64748b] flex-shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/[0.06]">
                    <div className="grid grid-cols-2 gap-2 pt-3 mb-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] mb-0.5">
                          Billed
                        </p>
                        <p className="text-xs font-medium text-[#f1f5f9]">
                          {formatCurrency(claim.billedAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] mb-0.5">
                          Insurance Paid
                        </p>
                        <p className="text-xs font-medium text-[#10b981]">
                          {formatCurrency(claim.paidAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] mb-0.5">
                          Your Responsibility
                        </p>
                        <p className="text-xs font-medium text-[#eab308]">
                          {formatCurrency(claim.patientResponsibility)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] mb-0.5">
                          Service Date
                        </p>
                        <p className="text-xs font-medium text-[#f1f5f9]">
                          {formatDate(claim.serviceDate)}
                        </p>
                      </div>
                    </div>

                    {/* Denial reason */}
                    {claim.status === 'denied' && claim.denialReason && (
                      <div className="rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] px-3 py-2.5 mb-3">
                        <p className="text-[10px] uppercase tracking-wider text-[#ef4444] font-semibold mb-0.5">
                          Denial Reason
                        </p>
                        <p className="text-xs text-[#fca5a5]">{claim.denialReason}</p>
                      </div>
                    )}

                    {/* EOB link */}
                    {claim.eobUrl && (
                      <a
                        href={claim.eobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-[#A78BFA] hover:text-[#c4b5fd] mb-3 transition-colors"
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        View Explanation of Benefits
                      </a>
                    )}

                    {/* Appeal generator for denied claims */}
                    {claim.status === 'denied' && (
                      <AppealGenerator
                        claimId={claim.id}
                        claimInfo={{
                          provider_name: claim.providerName || 'Unknown',
                          denial_reason: claim.denialReason || 'Not specified',
                          billed_amount: claim.billedAmount || 0,
                          patient_responsibility: claim.patientResponsibility || 0,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
