'use client'

import { useState, useEffect } from 'react'

export function TestModeBanner() {
  const [visible, setVisible] = useState(false)

  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

  useEffect(() => {
    if (!isTestMode) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(timer)
  }, [isTestMode])

  if (!isTestMode || !visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 9999,
        background: '#f59e0b',
        color: '#000',
        padding: '6px 14px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: 'none',
      }}
    >
      Staging Mode
    </div>
  )
}
