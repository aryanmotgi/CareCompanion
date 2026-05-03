'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { InfoTooltip } from './InfoTooltip'

const QR_EXPIRY_SECONDS = 10 * 60  // 10 minutes

export function QRCodePanel({
  initialUrl,
  userRole,
  onRegenerate,
}: {
  careGroupId: string
  initialUrl: string
  userRole?: 'caregiver' | 'patient' | 'self'
  onRegenerate: () => Promise<string>  // returns new URL
}) {
  const [url, setUrl] = useState(initialUrl)
  const [secondsLeft, setSecondsLeft] = useState(QR_EXPIRY_SECONDS)
  const [expired, setExpired] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  // Computed once — Web Share API availability doesn't change after mount.
  const [canShare] = useState(() => typeof window !== 'undefined' && typeof navigator.share === 'function')

  useEffect(() => {
    setSecondsLeft(QR_EXPIRY_SECONDS)
    setExpired(false)
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setExpired(true)
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [url])  // reset timer when url changes

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      const newUrl = await onRegenerate()
      setUrl(newUrl)
    } finally {
      setRegenerating(false)
    }
  }, [onRegenerate])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — silently ignore
    }
  }, [url])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timerColor = secondsLeft <= 60 ? '#ef4444' : 'rgba(255,255,255,0.4)'

  // Role-aware share prompt
  const sharePrompt = userRole === 'patient'
    ? 'Share with your caregiver'
    : 'Share with your patient'

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="p-4">
        <p className="text-xs font-medium mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {sharePrompt}
        </p>

        {/* QR code area */}
        <div className="relative flex justify-center mb-3">
          <div
            className="rounded-lg overflow-hidden p-3 bg-white"
            style={{ filter: expired ? 'blur(4px)' : 'none', transition: 'filter 300ms' }}
          >
            <QRCodeSVG value={url} size={120} level="M" />
          </div>

          {/* Expired overlay */}
          {expired && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-lg"
              style={{ background: 'rgba(0,0,0,0.7)' }}
            >
              <span className="text-white text-sm font-semibold mb-1">
                {regenerating ? 'Generating…' : 'Code expired'}
              </span>
              {!regenerating && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Tap to get a new one
                </span>
              )}
            </button>
          )}
        </div>

        {/* Countdown */}
        {!expired && (
          <p className="text-xs text-center mb-3" style={{ color: timerColor }}>
            Expires in {minutes}:{String(seconds).padStart(2, '0')}
          </p>
        )}

        {/* Share buttons — Share only shown when Web Share API is available (mobile/supported browsers) */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Share invite</span>
          <InfoTooltip content="Invited members can view updates and help coordinate care. They won't be able to edit medical information unless you give them permission." />
        </div>
        <div className={`grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canShare && (
            <button
              type="button"
              onClick={() => {
                navigator.share({ title: 'Join my Care Group', url }).catch(() => {
                  // User cancelled or share failed — not an error
                })
              }}
              className="rounded-lg py-2 text-xs font-medium transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
            >
              Share
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg py-2 text-xs font-medium transition-colors"
            style={{
              background: copied ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.06)',
              border: copied ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.1)',
              color: copied ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.7)',
              transition: 'all 200ms ease',
            }}
            aria-label={copied ? 'Link copied' : 'Copy invite link'}
          >
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  )
}
