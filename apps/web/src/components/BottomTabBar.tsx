'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

const ACTIVE_GRADIENT = 'linear-gradient(135deg, #7C3AED, #6366F1)'

const TABS = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: (active: boolean) => (
      <svg width="24" height="24" fill={active ? 'url(#homeGrad)' : 'none'} stroke={active ? 'none' : '#4B5568'} strokeWidth="1.75" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="homeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: (active: boolean) => (
      <svg width="24" height="24" fill={active ? 'url(#chatGrad)' : 'none'} stroke={active ? 'none' : '#4B5568'} strokeWidth="1.75" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="chatGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    label: 'Care',
    href: '/care-hub',
    icon: (active: boolean) => (
      <svg width="24" height="24" fill={active ? 'url(#careGrad)' : 'none'} stroke={active ? 'none' : '#4B5568'} strokeWidth="1.75" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="careGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    label: 'Trials',
    href: '/trials',
    icon: (active: boolean) => (
      <svg width="24" height="24" fill="none" stroke={active ? 'url(#trialsStroke)' : '#4B5568'} strokeWidth="1.75" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="trialsStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 01.45 2.795l-1.2 1.8A2.25 2.25 0 0117.175 21H6.075a2.25 2.25 0 01-1.875-.905l-1.2-1.8A2.25 2.25 0 013 15h16.8z" />
      </svg>
    ),
  },
  {
    label: 'Scan',
    href: '/scans',
    icon: (active: boolean) => (
      <svg width="24" height="24" fill="none" stroke={active ? 'url(#scanStroke)' : '#4B5568'} strokeWidth="1.75" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="scanStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 14.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-2.25zM18.375 14.625h.008v.008h-.008v-.008zM18.375 18.375h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke={active ? 'url(#settingsStroke)' : '#4B5568'} strokeWidth="1.75" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="settingsStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const [pressed, setPressed] = useState<string | null>(null)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/care-hub') return pathname.startsWith('/care-hub') || pathname.startsWith('/care')
    return pathname.startsWith(href)
  }

  const handlePress = (href: string) => {
    setPressed(href)
    setTimeout(() => setPressed(null), 300)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      aria-label="Main navigation"
      data-tour="tab-nav"
      style={{
        background: 'linear-gradient(to top, rgba(10,8,20,0.98) 70%, rgba(10,8,20,0.85) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(139,92,246,0.12)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex justify-around items-center px-4 pt-2 pb-6">
        {TABS.map((tab) => {
          const active = isActive(tab.href)
          const isPressed = pressed === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => handlePress(tab.href)}
              aria-current={active ? 'page' : undefined}
              {...(tab.label === 'Care' ? { 'data-tour': 'tab-care' } : {})}
              {...(tab.label === 'Scan' ? { 'data-tour': 'tab-scan' } : {})}
              {...(tab.label === 'Settings' ? { 'data-tour': 'tab-settings' } : {})}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                padding: '8px 16px',
                borderRadius: 16,
                textDecoration: 'none',
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isPressed ? 'scale(0.88)' : active ? 'scale(1.05)' : 'scale(1)',
                background: active
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(99,102,241,0.12) 100%)'
                  : 'transparent',
                boxShadow: active
                  ? '0 0 20px rgba(139,92,246,0.2), inset 0 1px 0 rgba(167,139,250,0.15)'
                  : 'none',
                border: active
                  ? '1px solid rgba(139,92,246,0.25)'
                  : '1px solid transparent',
                minWidth: 56,
              }}
            >
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
              }}>
                {active && (
                  <div style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
                    filter: 'blur(6px)',
                  }} />
                )}
                {tab.icon(active)}
              </div>
              <span className="text-[9px] xs:text-[10px] truncate max-w-[60px]" style={{
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                letterSpacing: active ? '0.04em' : '0.02em',
                background: active ? ACTIVE_GRADIENT : 'none',
                WebkitBackgroundClip: active ? 'text' : 'unset',
                WebkitTextFillColor: active ? 'transparent' : '#4B5568',
                backgroundClip: active ? 'text' : 'unset',
                transition: 'all 0.2s ease',
              }}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
