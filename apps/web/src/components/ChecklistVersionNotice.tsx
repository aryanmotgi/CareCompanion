'use client'

import { useState, useEffect } from 'react'

const CURRENT_VERSION = 'v1'

export function ChecklistVersionNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TEST_MODE !== 'true') return
    const seen = localStorage.getItem('qa-checklist-version')
    if (seen !== CURRENT_VERSION) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: '#3b82f6', color: '#fff',
      padding: '8px 16px', borderRadius: 8, fontSize: 13,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <span>New QA checklist ({CURRENT_VERSION}) available</span>
      <button
        onClick={() => {
          localStorage.setItem('qa-checklist-version', CURRENT_VERSION)
          setShow(false)
        }}
        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
      >
        Dismiss
      </button>
    </div>
  )
}
