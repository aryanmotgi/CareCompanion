'use client'

import { useEffect, useCallback } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel()
    },
    [onCancel, loading]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  if (!open) return null

  const confirmClass =
    variant === 'danger'
      ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
      : 'bg-gradient-to-r from-indigo-500 to-cyan-400 text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="bg-[#1e293b] rounded-xl p-6 mx-5 max-w-sm w-full animate-slide-up">
        <h3 id="confirm-dialog-title" className="text-[#f1f5f9] text-lg font-bold mb-2">{title}</h3>
        <p className="text-[#94a3b8] text-sm mb-5">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-white/[0.06] text-[#e2e8f0] text-sm font-semibold hover:bg-white/[0.1] transition-colors disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2 ${confirmClass}`}
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
