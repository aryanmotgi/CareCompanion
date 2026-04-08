'use client'

import { useEffect } from 'react'

interface PageErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  pageName?: string
}

function getErrorInfo(error: Error) {
  const message = error.message?.toLowerCase() || ''

  if (message.includes('fetch') || message.includes('network') || message.includes('failed to load')) {
    return {
      title: 'Connection issue',
      description: 'We couldn\'t reach the server. Check your internet connection and try again.',
      icon: (
        <svg width="24" height="24" fill="none" stroke="#eab308" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M1.42 9a15.91 15.91 0 0 1 21.16 0" />
          <path d="M5 12.55a10.94 10.94 0 0 1 14 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ),
      accent: '#eab308',
    }
  }

  if (message.includes('unauthorized') || message.includes('403') || message.includes('401') || message.includes('permission')) {
    return {
      title: 'Access denied',
      description: 'You don\'t have permission to view this. Try signing in again.',
      icon: (
        <svg width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      accent: '#ef4444',
    }
  }

  if (message.includes('not found') || message.includes('404')) {
    return {
      title: 'Not found',
      description: 'The content you\'re looking for doesn\'t exist or has been moved.',
      icon: (
        <svg width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      ),
      accent: '#ef4444',
    }
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      title: 'Request timed out',
      description: 'The server took too long to respond. Please try again.',
      icon: (
        <svg width="24" height="24" fill="none" stroke="#eab308" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      accent: '#eab308',
    }
  }

  return {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
    icon: (
      <svg width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    accent: '#ef4444',
  }
}

export function PageError({ error, reset, pageName }: PageErrorProps) {
  useEffect(() => {
    console.error(`[${pageName || 'Page'} Error]`, error)
  }, [error, pageName])

  const info = getErrorInfo(error)

  return (
    <div className="flex flex-col items-center justify-center py-20 px-5 text-center">
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-8 max-w-sm w-full">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: `${info.accent}12` }}
        >
          {info.icon}
        </div>

        <h2 className="text-[#f1f5f9] text-lg font-semibold mb-1">
          {info.title}
        </h2>
        <p className="text-[#64748b] text-sm leading-relaxed mb-6">
          {info.description}
        </p>

        {error.digest && (
          <p className="text-[#475569] text-xs font-mono mb-4">
            Error ID: {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold hover:opacity-90 transition-opacity active:scale-[0.98]"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
