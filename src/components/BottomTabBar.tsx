'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

const ACTIVE_COLOR = '#A78BFA'
const INACTIVE_COLOR = '#5B6785'

const TABS = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      </svg>
    ),
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    label: 'Care',
    href: '/care',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ),
  },
  {
    label: 'Scan',
    href: '/scans',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke={active ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="3" x2="9" y2="9" />
      </svg>
    ),
  },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const [bouncingTab, setBouncingTab] = useState<string | null>(null)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const handleClick = (href: string) => {
    setBouncingTab(href)
    setTimeout(() => setBouncingTab(null), 400)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0C0E1A]/90 backdrop-blur-xl border-t border-[var(--border)]">
      <div className="flex justify-around items-center px-2 pt-3 pb-5">
        {TABS.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => handleClick(tab.href)}
              className="flex flex-col items-center gap-1 relative"
            >
              <div className={`${bouncingTab === tab.href ? 'animate-tab-bounce' : ''} ${active ? 'animate-tab-glow rounded-full' : ''}`}>
                {tab.icon(active)}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-[#A78BFA] font-semibold' : 'text-[#5B6785]'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
