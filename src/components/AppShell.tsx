'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { BottomTabBar } from './BottomTabBar'
import { AmbientBackground } from './AmbientBackground'
import { NotificationBell } from './NotificationBell'
import { ProfileSwitcher } from './ProfileSwitcher'
import { createClient } from '@/lib/supabase/client'
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
}

const MENU_ITEMS = [
  { label: 'Emergency Card', href: '/emergency', icon: '🚨' },
  { label: 'Care Profile', href: '/profile', icon: '👤' },
  { label: 'Treatment Timeline', href: '/timeline', icon: '📈' },
  { label: 'Visit Prep', href: '/visit-prep', icon: '📝' },
  { label: 'Lab Results', href: '/labs', icon: '🔬' },
  { label: 'Treatment Journal', href: '/journal', icon: '📓' },
  { label: 'Health Summary', href: '/health-summary', icon: '📋' },
  { label: 'Calendar', href: '/calendar', icon: '📅' },
  { label: 'Analytics', href: '/analytics', icon: '📊' },
  { label: 'Connected Accounts', href: '/connect', icon: '🔗' },
  { label: 'Settings', href: '/settings', icon: '⚙️' },
  { label: 'Care Team', href: '/care-team', icon: '👥' },
]

export function AppShell({
  children,
  patientName,
  userName,
  notifications,
  profiles = [],
  activeProfileId = null,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const pathname = usePathname()

  const openMenu = () => {
    setMenuOpen(true)
    requestAnimationFrame(() => setMenuVisible(true))
  }

  const closeMenu = () => {
    setMenuVisible(false)
    setTimeout(() => setMenuOpen(false), 300)
  }

  // Hide nav on setup/onboarding pages
  const setupRoutes = ['/connect', '/manual-setup', '/setup']
  const isSetup = setupRoutes.some((r) => pathname.startsWith(r))

  const initials = (userName || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <AmbientBackground />

      {!isSetup && (
        <header
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'rgba(12, 14, 26, 0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href="/dashboard" className="text-[var(--text)] text-lg font-bold">CareCompanion</Link>
              {profiles.length > 1 && (
                <>
                  <span className="text-[#334155]">·</span>
                  <ProfileSwitcher profiles={profiles} activeProfileId={activeProfileId} />
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NotificationBell
                initialNotifications={notifications}
                initialCount={notifications.filter((n: { is_read: boolean }) => !n.is_read).length}
              />
              <button
                type="button"
                onClick={openMenu}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366F1, #A78BFA)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {initials}
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={`${isSetup ? '' : 'pt-14 pb-24'} min-h-screen min-h-dvh`}>
        <div className="max-w-lg lg:max-w-2xl xl:max-w-3xl mx-auto px-1 sm:px-0">
          {children}
        </div>
      </main>

      {!isSetup && <BottomTabBar />}

      {/* Profile Menu - inline with smooth transitions */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              opacity: menuVisible ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
            onClick={closeMenu}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 280,
              background: '#1a1d2e',
              display: 'flex',
              flexDirection: 'column',
              transform: menuVisible ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {/* User info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 600 }}>
                {initials}
              </div>
              <div>
                <div className="text-[var(--text)] text-[15px] font-semibold">{userName || 'User'}</div>
                <div className="text-[var(--text-muted)] text-xs">Caring for {patientName}</div>
              </div>
            </div>

            {/* Menu items */}
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.06] transition-colors"
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-[var(--text)] text-sm flex-1">{item.label}</span>
                  <svg width="14" height="14" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              ))}
            </div>

            {/* Sign out */}
            <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  window.location.href = '/login'
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-red-500/10 transition-colors w-full"
              >
                <span className="text-lg">🚪</span>
                <span className="text-[#ef4444] text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
