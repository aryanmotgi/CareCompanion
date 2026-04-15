'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#080A14]/95 backdrop-blur-xl border-b border-white/[0.07]' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </div>
          <span className="font-display font-bold text-white text-lg tracking-tight group-hover:text-white/90 transition-colors">CareCompanion</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-7">
          <Link href="/about" className="text-sm text-white/50 hover:text-white transition-colors">About</Link>
          <Link href="/privacy" className="text-sm text-white/50 hover:text-white transition-colors">Privacy</Link>
          <Link href="/terms" className="text-sm text-white/50 hover:text-white transition-colors">Terms</Link>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">Log In</Link>
          <Link href="/login" className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-600/20">Sign Up</Link>
        </div>
      </div>
    </nav>
  )
}
