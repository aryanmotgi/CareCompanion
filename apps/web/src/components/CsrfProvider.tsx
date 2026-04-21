'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const CsrfContext = createContext<string>('')

export function useCsrfToken() {
  return useContext(CsrfContext)
}

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? match[2] : ''
}

export function CsrfProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState('')

  useEffect(() => {
    // Read token from cookie
    const t = getCookie('cc-csrf-token')
    if (t) setToken(t)

    // If no token, fetch one by hitting any page (the middleware will set it)
    if (!t) {
      fetch('/api/health').then(() => {
        setToken(getCookie('cc-csrf-token'))
      })
    }
  }, [])

  return (
    <CsrfContext.Provider value={token}>
      {children}
    </CsrfContext.Provider>
  )
}
