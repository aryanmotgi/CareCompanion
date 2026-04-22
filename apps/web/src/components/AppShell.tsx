'use client'

import { useState, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BottomTabBar } from './BottomTabBar'
import { AmbientBackground } from './AmbientBackground'
import { NotificationBell } from './NotificationBell'
import { GlobalSearch } from './GlobalSearch'

import { ProfileSwitcher } from './ProfileSwitcher'
import { DemoBanner } from './DemoBanner'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import type { CareProfile } from '@/lib/types'

interface AppShellProps {
  children: React.ReactNode
  patientName: string
  patientAge?: number | null
  relationship?: string
  userName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notifications: any[]
  profiles?: CareProfile[]
  activeProfileId?: string | null
  isDemo?: boolean
}

const MENU_ITEMS = [
  {
    label: 'Emergency Card',
    href: '/emergency',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    color: '#f87171',
  },
  {
    label: 'Health Summary',
    href: '/health-summary',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    color: '#818CF8',
  },
  {
    label: 'Insurance & Claims',
    href: '/insurance',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    color: '#34D399',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: '#A78BFA',
  },
]

export function AppShell({
  children,
  patientName,
  userName,
  notifications,
  profiles = [],
  activeProfileId = null,
  isDemo = false,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const pathname = usePathname()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const { data: session } = useSession()

  const openMenu = () => {
    setMenuOpen(true)
    requestAnimationFrame(() => setMenuVisible(true))
  }

  const closeMenu = useCallback(() => {
    setMenuVisible(false)
    setTimeout(() => {
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }, 300)
  }, [])

  const setupRoutes = ['/connect', '/manual-setup', '/setup']
  const isSetup = setupRoutes.some((r) => pathname.startsWith(r))

  const liveDisplayName = (session?.user as { displayName?: string } | undefined)?.displayName || session?.user?.name || userName || '?'
  const initials = liveDisplayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] page-grid">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[99999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--accent)] focus:text-white focus:text-sm focus:font-medium">
        Skip to content
      </a>
      <AmbientBackground />

      {!isSetup && (
        <header
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'color-mix(in srgb, var(--bg-warm) 92%, transparent)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {isDemo && <DemoBanner />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56 }}>
            {/* Logo + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #7C3AED, #6366F1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
              </div>
              <Link href="/" className="font-display font-bold text-[var(--text)] text-base tracking-tight">CareCompanion</Link>
              {profiles.length > 1 && (
                <>
                  <span style={{ color: '#334155', fontSize: 14 }}>·</span>
                  <ProfileSwitcher profiles={profiles} activeProfileId={activeProfileId} />
                </>
              )}
            </div>

            {/* Right actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GlobalSearch />
              <NotificationBell
                initialNotifications={notifications}
                initialCount={notifications.filter((n: { is_read: boolean }) => !n.is_read).length}
              />
              <button
                ref={menuButtonRef}
                type="button"
                onClick={openMenu}
                aria-label="Open menu"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7C3AED, #6366F1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  boxShadow: '0 2px 12px rgba(124,58,237,0.35)',
                }}
              >
                {initials}
              </button>
            </div>
          </div>
        </header>
      )}

      <main id="main-content" className={`${isSetup ? '' : (isDemo ? 'pt-[104px] pb-24' : 'pt-14 pb-24')} min-h-screen min-h-dvh`}>
        <div className="max-w-lg lg:max-w-2xl xl:max-w-3xl mx-auto px-1 sm:px-0">
          {children}
        </div>
      </main>

      {!isSetup && <BottomTabBar />}

      {/* Slide-out menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
          {/* Backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(2px)',
              opacity: menuVisible ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
            onClick={closeMenu}
          />

          {/* Drawer */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 288,
              background: 'linear-gradient(180deg, #13111f 0%, #0f0e1a 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              flexDirection: 'column',
              transform: menuVisible ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 20px 20px', borderBottom: '1px solid rgba(139,92,246,0.12)', background: 'linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg, #A78BFA, #6366F1)', boxShadow: '0 0 8px rgba(139,92,246,0.8)' }} />
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.7)' }}>Account</span>
                </div>
                <button
                  onClick={closeMenu}
                  style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                  aria-label="Close menu"
                  className="hover:bg-white/[0.1]"
                >
                  <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7C3AED, #6366F1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 17,
                  fontWeight: 800,
                  boxShadow: '0 0 0 2px rgba(139,92,246,0.3), 0 4px 20px rgba(124,58,237,0.5)',
                  flexShrink: 0,
                  letterSpacing: '0.03em',
                }}>
                  {initials}
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.95)', fontSize: 16, fontWeight: 700, letterSpacing: '0.01em' }}>{userName || 'User'}</div>
                  <div style={{ color: 'rgba(167,139,250,0.6)', fontSize: 12, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="11" height="11" fill="rgba(167,139,250,0.6)" viewBox="0 0 24 24">
                      <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                    Caring for {patientName}
                  </div>
                </div>
              </div>
            </div>

            {/* Nav items */}
            <nav role="navigation" aria-label="Main menu" style={{ flex: 1, padding: '14px 14px', overflowY: 'auto' }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.5)', padding: '4px 10px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(139,92,246,0.3), transparent)' }} />
                Navigation
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, rgba(139,92,246,0.3), transparent)' }} />
              </div>
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={closeMenu}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '13px 12px',
                    borderRadius: 14,
                    marginBottom: 4,
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  className="hover:bg-white/[0.07] hover:border-white/[0.08] group"
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${item.color}22, ${item.color}0d)`,
                    border: `1px solid ${item.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.color,
                    flexShrink: 0,
                    boxShadow: `0 4px 12px ${item.color}18`,
                    transition: 'all 0.2s ease',
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: 600, letterSpacing: '0.01em' }}>{item.label}</div>
                  </div>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" viewBox="0 0 24 24">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </Link>
              ))}
            </nav>

            {/* Sign out */}
            <div style={{ padding: '10px 14px 28px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => signOut({ callbackUrl: '/api/auth/cognito-logout' })}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-red-500/10 transition-colors w-full"
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.08))',
                  border: '1px solid rgba(239,68,68,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(239,68,68,0.15)',
                }}>
                  <svg width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="1.75" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </div>
                <span style={{ color: '#f87171', fontSize: 14, fontWeight: 600 }}>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
