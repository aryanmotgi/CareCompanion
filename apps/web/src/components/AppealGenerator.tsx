'use client'

import { useState, useRef, useCallback } from 'react'
import { useToast } from '@/components/ToastProvider'
import { useCsrfToken } from '@/components/CsrfProvider'

interface ClaimInfo {
  provider_name: string
  denial_reason: string
  billed_amount: number | string
  patient_responsibility: number | string
}

interface AppealResult {
  subject_line: string
  letter_body: string
  key_arguments: string[]
  supporting_evidence_needed: string[]
  next_steps: string[]
  deadline_warning?: string
}

interface AppealGeneratorProps {
  claimId: string
  claimInfo: ClaimInfo
}

export function AppealGenerator({ claimId, claimInfo }: AppealGeneratorProps) {
  const { showToast } = useToast()
  const csrfToken = useCsrfToken()
  const [additionalContext, setAdditionalContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appeal, setAppeal] = useState<AppealResult | null>(null)
  const [copied, setCopied] = useState(false)
  const letterRef = useRef<HTMLDivElement>(null)

  const generateAppeal = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insurance/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          claim_id: claimId,
          ...(additionalContext.trim() ? { additional_context: additionalContext.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Failed to generate appeal (${res.status})`)
      }
      const json = await res.json()
      setAppeal(json.data)
      showToast('Appeal generated', 'success')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong'
      setError(errMsg)
      showToast(errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }, [claimId, additionalContext, showToast, csrfToken])

  const copyLetter = useCallback(async () => {
    if (!appeal) return
    const text = [
      `Subject: ${appeal.subject_line}`,
      '',
      appeal.letter_body,
      '',
      'Key Arguments:',
      ...appeal.key_arguments.map((a, i) => `${i + 1}. ${a}`),
      '',
      'Supporting Evidence Needed:',
      ...appeal.supporting_evidence_needed.map((e) => `- ${e}`),
      '',
      'Next Steps:',
      ...appeal.next_steps.map((s) => `- ${s}`),
      ...(appeal.deadline_warning ? ['', `DEADLINE WARNING: ${appeal.deadline_warning}`] : []),
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the letter content
      const selection = window.getSelection()
      if (letterRef.current && selection) {
        const range = document.createRange()
        range.selectNodeContents(letterRef.current)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }, [appeal])

  const printLetter = useCallback(() => {
    window.print()
  }, [])

  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val
    if (isNaN(num)) return String(val)
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1]/20 to-[#A78BFA]/20">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#A78BFA]">
              <path
                d="M3 2.5A1.5 1.5 0 014.5 1h5.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V13.5A1.5 1.5 0 0112 15H4.5A1.5 1.5 0 013 13.5v-11z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text,#f0f0f0)]">Insurance Appeal</h3>
            <p className="text-[11px] text-[var(--text-muted,#9ca3af)] mt-0.5">
              Claim {claimId}
            </p>
          </div>
        </div>

        {/* Claim summary */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted,#9ca3af)] mb-0.5">Provider</p>
            <p className="text-xs font-medium text-[var(--text,#f0f0f0)] truncate">{claimInfo.provider_name}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted,#9ca3af)] mb-0.5">Billed</p>
            <p className="text-xs font-medium text-[var(--text,#f0f0f0)]">{formatCurrency(claimInfo.billed_amount)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5 col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted,#9ca3af)] mb-0.5">Denial Reason</p>
            <p className="text-xs text-[#ef4444] font-medium">{claimInfo.denial_reason}</p>
          </div>
        </div>

        {/* Additional context */}
        {!appeal && (
          <div className="mb-4">
            <label
              htmlFor={`appeal-context-${claimId}`}
              className="block text-[11px] font-medium text-[var(--text-muted,#9ca3af)] mb-1.5"
            >
              Additional context (optional)
            </label>
            <textarea
              id={`appeal-context-${claimId}`}
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Any details that support your appeal (e.g., doctor recommendations, prior treatments tried)..."
              rows={3}
              disabled={loading}
              className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-xs text-[var(--text,#f0f0f0)] placeholder:text-[var(--text-muted,#9ca3af)]/40 focus:outline-none focus:border-[#6366F1]/40 focus:ring-1 focus:ring-[#6366F1]/20 resize-none transition-colors disabled:opacity-50"
            />
          </div>
        )}

        {/* Generate button */}
        {!appeal && !loading && (
          <button
            onClick={generateAppeal}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Generate Appeal Letter
          </button>
        )}

        {/* Loading state */}
        {loading && (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#A78BFA] animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text,#f0f0f0)] animate-pulse">
                Generating your appeal letter...
              </p>
              <p className="text-[11px] text-[var(--text-muted,#9ca3af)] mt-1">
                Analyzing claim details and building arguments
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] px-4 py-3">
            <div className="flex items-start gap-2.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#ef4444] flex-shrink-0 mt-0.5">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <div className="flex-1">
                <p className="text-xs text-[#ef4444] font-medium">{error}</p>
                <button
                  onClick={generateAppeal}
                  className="text-[11px] text-[#A78BFA] hover:text-[#c4b5fd] mt-1.5 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Appeal result */}
      {appeal && (
        <div className="border-t border-white/[0.06]" ref={letterRef}>
          {/* Deadline warning */}
          {appeal.deadline_warning && (
            <div className="mx-5 mt-4 rounded-xl bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.25)] px-4 py-3 flex items-start gap-2.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#ef4444] flex-shrink-0 mt-0.5">
                <path
                  d="M8 1.5l6.5 12H1.5L8 1.5z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path d="M8 6v3M8 11v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <div>
                <p className="text-[11px] font-semibold text-[#ef4444] uppercase tracking-wide">Deadline Warning</p>
                <p className="text-xs text-[#fca5a5] mt-0.5">{appeal.deadline_warning}</p>
              </div>
            </div>
          )}

          {/* Subject line */}
          <div className="px-5 pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted,#9ca3af)] mb-1">Subject</p>
            <h4 className="text-sm font-semibold text-[var(--text,#f0f0f0)] leading-snug">
              {appeal.subject_line}
            </h4>
          </div>

          {/* Letter body */}
          <div className="mx-5 mb-4 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-4">
            <p className="text-xs leading-relaxed text-[var(--text,#f0f0f0)] whitespace-pre-wrap">
              {appeal.letter_body}
            </p>
          </div>

          {/* Key arguments */}
          {appeal.key_arguments.length > 0 && (
            <div className="px-5 mb-4">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted,#9ca3af)] mb-2 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#6366F1]">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Key Arguments
              </p>
              <ol className="space-y-1.5">
                {appeal.key_arguments.map((arg, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--text,#f0f0f0)]">
                    <span className="flex-shrink-0 w-5 h-5 rounded-md bg-[#6366F1]/15 text-[#818CF8] text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{arg}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Supporting evidence checklist */}
          {appeal.supporting_evidence_needed.length > 0 && (
            <div className="px-5 mb-4">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted,#9ca3af)] mb-2 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#f59e0b]">
                  <rect x="1.5" y="1.5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M4 6l1.5 1.5L8 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Evidence to Gather
              </p>
              <ul className="space-y-1.5">
                {appeal.supporting_evidence_needed.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--text,#f0f0f0)]">
                    <div className="flex-shrink-0 w-4 h-4 rounded border border-white/[0.15] mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          {appeal.next_steps.length > 0 && (
            <div className="px-5 mb-4">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted,#9ca3af)] mb-2 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#10b981]">
                  <path d="M4.5 1.5l5 4.5-5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Next Steps
              </p>
              <ul className="space-y-1.5">
                {appeal.next_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--text,#f0f0f0)]">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#10b981] mt-1.5" />
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-5 pb-5 flex items-center gap-2">
            <button
              onClick={copyLetter}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3.5 7.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                    <path d="M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5" stroke="currentColor" strokeWidth="1.1" />
                  </svg>
                  Copy Letter
                </>
              )}
            </button>
            <button
              onClick={printLetter}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs font-medium text-[var(--text,#f0f0f0)] hover:bg-white/[0.08] active:scale-[0.98] transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 5V1.5h7V5M3.5 10H2a.5.5 0 01-.5-.5v-4A.5.5 0 012 5h10a.5.5 0 01.5.5v4a.5.5 0 01-.5.5h-1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="3.5" y="8.5" width="7" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
              </svg>
              Print
            </button>
            <button
              onClick={() => {
                setAppeal(null)
                setError(null)
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs font-medium text-[var(--text,#f0f0f0)] hover:bg-white/[0.08] active:scale-[0.98] transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7.5a5 5 0 019-3M11.5 6.5a5 5 0 01-9 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <path d="M11.5 2v2.5H9M2.5 12V9.5H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Redo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
