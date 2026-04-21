'use client'

import { useEffect, useState } from 'react'
import { flushQueue, getQueuedCount } from '@/lib/offline-queue'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [showBackOnline, setShowBackOnline] = useState(false)
  const [queueCount, setQueueCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    setQueueCount(getQueuedCount())

    const handleOffline = () => {
      setShowBackOnline(false)
      setIsOffline(true)
    }

    const handleOnline = async () => {
      setIsOffline(false)
      const count = getQueuedCount()
      if (count > 0) {
        setSyncing(true)
        const result = await flushQueue()
        setSyncing(false)
        setQueueCount(getQueuedCount())
        if (result.succeeded > 0) {
          setShowBackOnline(true)
          setTimeout(() => setShowBackOnline(false), 4000)
        }
      } else {
        setShowBackOnline(true)
        setTimeout(() => setShowBackOnline(false), 3000)
      }
    }

    const handleQueueChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setQueueCount(detail?.count ?? getQueuedCount())
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline-queue-change', handleQueueChange)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline-queue-change', handleQueueChange)
    }
  }, [])

  if (!isOffline && !showBackOnline && !syncing) return null

  return (
    <div
      className={`sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 ${
        syncing
          ? 'bg-[#6366F1]/10 text-[#A78BFA] border-b border-[#6366F1]/20'
          : isOffline
          ? 'bg-[#eab308]/10 text-[#eab308] border-b border-[#eab308]/20'
          : 'bg-[#10b981]/10 text-[#10b981] border-b border-[#10b981]/20'
      }`}
    >
      {syncing ? (
        <>
          <svg className="animate-spin" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Syncing {queueCount} pending changes...
        </>
      ) : isOffline ? (
        <>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          You&apos;re offline{queueCount > 0 ? ` \u2014 ${queueCount} change${queueCount > 1 ? 's' : ''} queued` : ' \u2014 some features may be unavailable'}
        </>
      ) : (
        <>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Back online \u2014 all changes synced
        </>
      )}
    </div>
  )
}
