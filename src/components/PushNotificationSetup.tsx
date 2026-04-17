'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const bytes = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

async function subscribeAndSave(): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  if (existing) await existing.unsubscribe()

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    ),
  })

  const { endpoint, keys } = subscription.toJSON() as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
  })
}

const DISMISSED_KEY = 'push_prompt_dismissed'
const PUSH_SUPPORTED =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export function PushNotificationSetup() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!PUSH_SUPPORTED) return

    const permission = Notification.permission

    if (permission === 'granted') {
      // Subscribe silently — no UI needed
      subscribeAndSave().catch(() => {})
      return
    }

    if (permission === 'default') {
      const dismissed = localStorage.getItem(DISMISSED_KEY)
      if (!dismissed) {
        setShowBanner(true)
      }
    }
    // If 'denied', show nothing
  }, [])

  async function handleEnable() {
    setShowBanner(false)
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      subscribeAndSave().catch(() => {})
    }
  }

  function handleDismiss() {
    setShowBanner(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  if (!showBanner) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        maxWidth: 'calc(100vw - 2rem)',
        width: '480px',
      }}
    >
      {/* Bell icon */}
      <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>🔔</span>

      {/* Text */}
      <p
        style={{
          flex: 1,
          margin: 0,
          fontSize: '0.8125rem',
          lineHeight: '1.4',
          color: 'var(--text-secondary, #a0a0b0)',
        }}
      >
        Get notified about medication refills, appointments, and lab results
      </p>

      {/* Enable button */}
      <button
        onClick={handleEnable}
        style={{
          flexShrink: 0,
          padding: '0.375rem 0.875rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: '#fff',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Enable notifications
      </button>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification prompt"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.5rem',
          height: '1.5rem',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-secondary, #a0a0b0)',
          fontSize: '0.875rem',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
