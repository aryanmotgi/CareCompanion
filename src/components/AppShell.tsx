'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { BottomTabBar } from './BottomTabBar'
import { ProfileMenu } from './ProfileMenu'
import { AmbientBackground } from './AmbientBackground'
import { NotificationBell } from './NotificationBell'
import { ProfileSwitcher } from './ProfileSwitcher'
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

export function AppShell({
  children,
  patientName,
  relationship,
  userName,
  notifications,
  profiles = [],
  activeProfileId = null,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] relative">
      <AmbientBackground />

      {!isSetup && (
        <header className="fixed top-0 left-0 right-0 z-40 bg-[#0C0E1A]/90 backdrop-blur-xl border-b border-[var(--border)]">
          <div className="flex items-center justify-between px-4 sm:px-5 h-14">
            <div className="flex items-center gap-2">
              <h1 className="text-[var(--text)] text-lg font-bold">CareCompanion</h1>
              {profiles.length > 1 && (
                <>
                  <span className="text-[#334155]">·</span>
                  <ProfileSwitcher profiles={profiles} activeProfileId={activeProfileId} />
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell
                initialNotifications={notifications}
                initialCount={notifications.filter((n: { is_read: boolean }) => !n.is_read).length}
              />
              <button
                onClick={() => setMenuOpen(true)}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-sm font-semibold animate-press"
              >
                {initials}
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={`${isSetup ? '' : 'pt-14 pb-24'} relative z-10 animate-page-in min-h-screen min-h-dvh`}>
        <div className="max-w-lg lg:max-w-2xl xl:max-w-3xl mx-auto px-1 sm:px-0">
          {children}
        </div>
      </main>

      {!isSetup && <BottomTabBar />}

      {!isSetup && (
        <ProfileMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          userName={userName}
          patientName={patientName}
          relationship={relationship}
        />
      )}
    </div>
  )
}
