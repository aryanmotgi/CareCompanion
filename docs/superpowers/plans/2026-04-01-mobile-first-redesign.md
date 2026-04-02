# Mobile-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform CareCompanion from a sidebar-nav desktop layout into a mobile-first, bottom-tab-bar app with futuristic visual polish (glows, animated gradients, transitions, ambient background, skeleton loading, number animations).

**Architecture:** Replace the AppShell sidebar with a BottomTabBar + top bar + ProfileMenu slide-out. Merge Medications + Appointments into a single Care tab with segment control. Rewrite Dashboard as a priority card feed. Add global animation system via CSS keyframes + utility components.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS 3.4, Supabase, TypeScript. No new dependencies — all animations are CSS + vanilla JS.

**Spec:** `docs/superpowers/specs/2026-04-01-mobile-first-redesign-design.md`

**Important conventions (from codebase):**
- All components use **named exports** (`export function X`), NOT default exports
- Supabase browser client: `import { createClient } from '@/lib/supabase/client'`
- Supabase server client: `import { createClient } from '@/lib/supabase/server'`
- Foreign key for care profiles: `care_profile_id` (NOT `profile_id`)
- Props from layout may be optional/null (e.g., `patientAge` can be null, `relationship` can be undefined)

---

## Chunk 1: Global Animation System & Shared Components

Build the animation foundation and reusable UI primitives that every other task depends on.

### Task 1: Global CSS — Futuristic Animation Keyframes & Utilities

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add new keyframe animations to globals.css**

Add these after the existing `@keyframes` block (around line 400+):

```css
/* ===== FUTURISTIC ANIMATION SYSTEM ===== */

/* Staggered card fade-in */
@keyframes card-stagger-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Glow pulse for urgent cards */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.15); }
  50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.3), 0 0 40px rgba(239, 68, 68, 0.1); }
}

/* Cyan glow for active tab */
@keyframes tab-glow {
  0%, 100% { box-shadow: 0 0 6px rgba(56, 189, 248, 0.2); }
  50% { box-shadow: 0 0 12px rgba(56, 189, 248, 0.4); }
}

/* Animated gradient border rotation */
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes gradient-rotate {
  to { --gradient-angle: 360deg; }
}

/* Ambient floating blobs */
@keyframes blob-float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.1); }
  66% { transform: translate(-20px, 15px) scale(0.9); }
}

@keyframes blob-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-25px, 20px) scale(0.95); }
  66% { transform: translate(15px, -25px) scale(1.05); }
}

/* Shimmer loading sweep */
@keyframes shimmer-sweep {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Spring bounce for tab icons */
@keyframes tab-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(0.85); }
  50% { transform: scale(1.1); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* Slide up for bottom sheets */
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Slide in from right (profile menu) */
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* Fade overlay */
@keyframes fade-overlay {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Number count-up container reveal */
@keyframes number-reveal {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Add utility classes in @layer utilities**

Add inside the existing `@layer utilities` block:

```css
/* Futuristic utility classes */
.animate-card-in {
  animation: card-stagger-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.animate-glow-pulse {
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.15);
  animation: glow-pulse 2s ease-in-out infinite;
}
.animate-tab-glow {
  animation: tab-glow 2s ease-in-out infinite;
}
.animate-blob-1 {
  animation: blob-float-1 40s ease-in-out infinite;
}
.animate-blob-2 {
  animation: blob-float-2 50s ease-in-out infinite;
}
.animate-shimmer {
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer-sweep 1.5s ease-in-out infinite;
}
.animate-tab-bounce {
  animation: tab-bounce 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.animate-press {
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.animate-press:active {
  transform: scale(0.95);
}
.animate-slide-up {
  animation: slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.animate-slide-in-right {
  animation: slide-in-right 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.animate-fade-overlay {
  animation: fade-overlay 0.25s ease-out;
}
.animate-number-reveal {
  animation: number-reveal 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
}

/* Gradient border card wrapper — glow on hover */
.gradient-border-card {
  position: relative;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.gradient-border-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 13px;
  background: conic-gradient(from var(--gradient-angle, 0deg), #06b6d4, #8b5cf6, #3b82f6, #06b6d4);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}
.gradient-border-card:hover::before {
  opacity: 1;
  animation: gradient-rotate 3s linear infinite;
}

/* Card hover lift */
.card-hover-lift {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease;
}
.card-hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 3: Update prefers-reduced-motion to cover all new animations**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add futuristic animation system (keyframes, utilities, gradient borders)"
```

---

### Task 2: AmbientBackground Component

**Files:**
- Create: `src/components/AmbientBackground.tsx`

- [ ] **Step 1: Create the ambient floating blobs component**

```tsx
'use client'

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div
        className="absolute w-[600px] h-[600px] rounded-full animate-blob-1"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.04) 0%, transparent 70%)',
          top: '-10%',
          right: '-10%',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full animate-blob-2"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.04) 0%, transparent 70%)',
          bottom: '-5%',
          left: '-10%',
          filter: 'blur(80px)',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AmbientBackground.tsx
git commit -m "feat: add AmbientBackground component with floating gradient blobs"
```

---

### Task 3: SkeletonCard Component

**Files:**
- Create: `src/components/SkeletonCard.tsx`

- [ ] **Step 1: Create shimmer skeleton component**

```tsx
'use client'

interface SkeletonCardProps {
  variant?: 'default' | 'wide' | 'compact'
}

export function SkeletonCard({ variant = 'default' }: SkeletonCardProps) {
  const heights = {
    default: 'h-[88px]',
    wide: 'h-[120px]',
    compact: 'h-[64px]',
  }

  return (
    <div className={`rounded-xl bg-[#1e293b] ${heights[variant]} p-4 overflow-hidden relative`}>
      <div className="space-y-3">
        <div className="h-2.5 w-24 rounded-full bg-white/[0.04] animate-shimmer" />
        <div className="h-4 w-48 rounded-full bg-white/[0.04] animate-shimmer" style={{ animationDelay: '0.1s' }} />
        <div className="h-2.5 w-32 rounded-full bg-white/[0.04] animate-shimmer" style={{ animationDelay: '0.2s' }} />
      </div>
    </div>
  )
}

/** Multiple skeleton cards for loading states */
export function SkeletonFeed() {
  return (
    <div className="space-y-3 px-5 py-4">
      <SkeletonCard />
      <SkeletonCard variant="compact" />
      <SkeletonCard />
      <SkeletonCard variant="compact" />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SkeletonCard.tsx
git commit -m "feat: add SkeletonCard and SkeletonFeed components with shimmer animation"
```

---

### Task 4: AnimatedNumber Component

**Files:**
- Create: `src/components/AnimatedNumber.tsx`

- [ ] **Step 1: Create count-up number component with Intersection Observer**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
}

export function AnimatedNumber({
  value,
  duration = 800,
  suffix = '',
  prefix = '',
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (hasAnimated) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true)
          const startTime = performance.now()

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplayValue(Math.round(eased * value))

            if (progress < 1) {
              requestAnimationFrame(animate)
            }
          }

          requestAnimationFrame(animate)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, duration, hasAnimated])

  return (
    <span ref={ref} className={`animate-number-reveal ${className}`}>
      {prefix}{displayValue}{suffix}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AnimatedNumber.tsx
git commit -m "feat: add AnimatedNumber component with count-up and intersection observer"
```

---

### Task 5: BottomSheet Component

**Files:**
- Create: `src/components/BottomSheet.tsx`

- [ ] **Step 1: Create bottom sheet overlay component**

```tsx
'use client'

import { useEffect, useCallback } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 animate-fade-overlay" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-[#1e293b] rounded-t-2xl animate-slide-up overflow-hidden">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {title && (
          <div className="px-5 pb-3 pt-1 border-b border-white/[0.06]">
            <h3 className="text-white font-semibold text-lg">{title}</h3>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto max-h-[calc(85vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BottomSheet.tsx
git commit -m "feat: add BottomSheet component with slide-up spring animation"
```

---

### Task 6: SegmentControl Component

**Files:**
- Create: `src/components/SegmentControl.tsx`

- [ ] **Step 1: Create sliding pill segment control**

```tsx
'use client'

import { useRef, useState, useEffect } from 'react'

interface SegmentControlProps {
  segments: string[]
  activeIndex: number
  onChange: (index: number) => void
}

export function SegmentControl({ segments, activeIndex, onChange }: SegmentControlProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const buttons = containerRef.current.querySelectorAll('button')
    const active = buttons[activeIndex]
    if (active) {
      setPillStyle({
        left: active.offsetLeft,
        width: active.offsetWidth,
      })
    }
  }, [activeIndex])

  return (
    <div ref={containerRef} className="relative flex bg-[#1e293b] rounded-[10px] p-[3px]">
      <div
        className="absolute top-[3px] h-[calc(100%-6px)] rounded-lg bg-[#38bdf8] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ left: pillStyle.left, width: pillStyle.width }}
      />
      {segments.map((label, i) => (
        <button
          key={label}
          onClick={() => onChange(i)}
          className={`relative z-10 flex-1 text-center py-2 px-4 rounded-lg text-[13px] font-semibold transition-colors duration-200 ${
            i === activeIndex ? 'text-[#0f172a]' : 'text-[#64748b]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SegmentControl.tsx
git commit -m "feat: add SegmentControl with sliding pill animation"
```

---

## Chunk 2: Navigation Overhaul

Replace sidebar with bottom tab bar and profile menu.

### Task 7: BottomTabBar Component

**Files:**
- Create: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: Create bottom tab bar with bounce and glow animations**

```tsx
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

const TABS = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke={active ? '#38bdf8' : '#64748b'} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      </svg>
    ),
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke={active ? '#38bdf8' : '#64748b'} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    label: 'Care',
    href: '/care',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke={active ? '#38bdf8' : '#64748b'} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ),
  },
  {
    label: 'Scan',
    href: '/scans',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke={active ? '#38bdf8' : '#64748b'} strokeWidth="2" viewBox="0 0 24 24">
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0f172a]/95 backdrop-blur-lg border-t border-white/[0.08]">
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
              <span className={`text-[10px] font-medium ${active ? 'text-[#38bdf8] font-semibold' : 'text-[#64748b]'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BottomTabBar.tsx
git commit -m "feat: add BottomTabBar with tab bounce and glow animations"
```

---

### Task 8: ProfileMenu Component

**Files:**
- Create: `src/components/ProfileMenu.tsx`

- [ ] **Step 1: Create slide-out profile menu**

Note: Profile, Connect, and Settings render as full pages (their existing routes) when tapped, not inline in the panel. The menu is a navigation hub.

```tsx
'use client'

import { useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ProfileMenuProps {
  isOpen: boolean
  onClose: () => void
  userName: string
  patientName: string
  relationship?: string
}

const MENU_ITEMS = [
  {
    label: 'Care Profile',
    href: '/profile',
    icon: (
      <svg width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    label: 'Connected Accounts',
    href: '/connect',
    icon: (
      <svg width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
  {
    label: 'Help & Support',
    href: '#',
    icon: (
      <svg width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
]

export function ProfileMenu({ isOpen, onClose, userName, patientName, relationship }: ProfileMenuProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const initials = (userName || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 animate-fade-overlay" onClick={onClose} />
      <div className="absolute top-0 right-0 bottom-0 w-[280px] bg-[#1e293b] animate-slide-in-right flex flex-col">
        {/* User info */}
        <div className="flex items-center gap-3 p-5 pb-4 border-b border-white/[0.06]">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-base font-semibold">
            {initials}
          </div>
          <div>
            <div className="text-[#f1f5f9] text-[15px] font-semibold">{userName || 'User'}</div>
            <div className="text-[#64748b] text-xs">Caring for {patientName}</div>
          </div>
        </div>

        {/* Menu items */}
        <div className="flex-1 flex flex-col gap-1 p-3 pt-4">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.04] transition-colors duration-200 animate-press"
            >
              {item.icon}
              <span className="text-[#e2e8f0] text-sm flex-1">{item.label}</span>
              <svg width="14" height="14" fill="none" stroke="#475569" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>

        {/* Sign out */}
        <div className="p-3 pt-0 border-t border-white/[0.06]">
          <button className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.04] transition-colors w-full animate-press">
            <svg width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="text-[#ef4444] text-sm">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProfileMenu.tsx
git commit -m "feat: add ProfileMenu slide-out with Help & Support and animated entrance"
```

---

### Task 9: Rewrite AppShell — Remove Sidebar, Add Top Bar + Bottom Tab Bar

**Files:**
- Modify: `src/components/AppShell.tsx` (full rewrite)

- [ ] **Step 1: Rewrite AppShell.tsx**

Replace the entire file. Must use **named export** to match `import { AppShell }` in `src/app/(app)/layout.tsx`. Props use optional markers to match what the layout passes.

```tsx
'use client'

import { useState } from 'react'
import { BottomTabBar } from './BottomTabBar'
import { ProfileMenu } from './ProfileMenu'
import { AmbientBackground } from './AmbientBackground'

interface AppShellProps {
  children: React.ReactNode
  patientName: string
  patientAge?: number | null
  relationship?: string
  userName: string
  notifications: any[]
}

export function AppShell({
  children,
  patientName,
  patientAge,
  relationship,
  userName,
  notifications,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const initials = (userName || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] relative">
      <AmbientBackground />

      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0f172a]/95 backdrop-blur-lg border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 h-14">
          <h1 className="text-[#f1f5f9] text-lg font-bold">CareCompanion</h1>
          <button
            onClick={() => setMenuOpen(true)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-sm font-semibold animate-press"
          >
            {initials}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14 pb-24 relative z-10">
        {children}
      </main>

      <BottomTabBar />

      <ProfileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={userName}
        patientName={patientName}
        relationship={relationship}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat: rewrite AppShell — bottom tab bar, top bar with avatar, profile menu, ambient background"
```

---

### Task 10: Add /care Route

**Files:**
- Create: `src/app/(app)/care/page.tsx`

- [ ] **Step 1: Create the Care page combining medications + appointments**

Uses `care_profile_id` (the actual FK column name) and named import for CareView.

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CareView } from '@/components/CareView'

export default async function CarePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const [{ data: medications }, { data: appointments }] = await Promise.all([
    supabase
      .from('medications')
      .select('*')
      .eq('care_profile_id', profile.id)
      .order('name'),
    supabase
      .from('appointments')
      .select('*')
      .eq('care_profile_id', profile.id)
      .order('date_time', { ascending: true }),
  ])

  return (
    <CareView
      profileId={profile.id}
      medications={medications || []}
      appointments={appointments || []}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/care/page.tsx
git commit -m "feat: add /care route combining medications and appointments"
```

---

## Chunk 3: Core Views Rewrite

### Task 11: CareView Component (Merged Meds + Appointments)

**Files:**
- Create: `src/components/CareView.tsx`

- [ ] **Step 1: Create CareView with segment control, grouped lists, and bottom sheet details**

Key fixes from review: uses `createClient` from `@/lib/supabase/client`, uses `care_profile_id`, groups appointments as "This Week" / "Upcoming" (not "Upcoming" / "Past"), separates `animate-card-in` delay from `animate-glow-pulse`.

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SegmentControl } from './SegmentControl'
import { BottomSheet } from './BottomSheet'
import { AnimatedNumber } from './AnimatedNumber'

interface CareViewProps {
  profileId: string
  medications: any[]
  appointments: any[]
}

export function CareView({ profileId, medications: initialMeds, appointments: initialAppts }: CareViewProps) {
  const [activeSegment, setActiveSegment] = useState(0)
  const [medications, setMedications] = useState(initialMeds)
  const [appointments, setAppointments] = useState(initialAppts)
  const [selectedMed, setSelectedMed] = useState<any>(null)
  const [selectedAppt, setSelectedAppt] = useState<any>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add medication form state
  const [medName, setMedName] = useState('')
  const [medDosage, setMedDosage] = useState('')
  const [medFrequency, setMedFrequency] = useState('')
  const [medRefillDate, setMedRefillDate] = useState('')

  // Add appointment form state
  const [apptDoctor, setApptDoctor] = useState('')
  const [apptSpecialty, setApptSpecialty] = useState('')
  const [apptDateTime, setApptDateTime] = useState('')
  const [apptLocation, setApptLocation] = useState('')

  const supabase = createClient()
  const now = new Date()

  // Medication grouping
  const needsRefill = medications.filter((m) => {
    if (!m.refill_date) return false
    const diff = (new Date(m.refill_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 3
  })
  const activeMeds = medications.filter((m) => !needsRefill.includes(m))

  // Appointment grouping: "This Week" vs "Upcoming" (future only, no past)
  const futureAppts = appointments.filter((a) => a.date_time && new Date(a.date_time) >= now)
  const endOfWeek = new Date(now)
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
  endOfWeek.setHours(23, 59, 59, 999)

  const thisWeekAppts = futureAppts.filter((a) => new Date(a.date_time) <= endOfWeek)
  const laterAppts = futureAppts.filter((a) => new Date(a.date_time) > endOfWeek)

  const daysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    return `In ${diff} days`
  }

  const handleAddMed = async () => {
    if (!medName) return
    setSaving(true)
    const { data } = await supabase
      .from('medications')
      .insert({ care_profile_id: profileId, name: medName, dosage: medDosage, frequency: medFrequency, refill_date: medRefillDate || null })
      .select()
      .single()
    if (data) {
      setMedications([...medications, data].sort((a, b) => a.name.localeCompare(b.name)))
      setMedName(''); setMedDosage(''); setMedFrequency(''); setMedRefillDate('')
      setShowAddForm(false)
    }
    setSaving(false)
  }

  const handleAddAppt = async () => {
    if (!apptDoctor || !apptDateTime) return
    setSaving(true)
    const { data } = await supabase
      .from('appointments')
      .insert({ care_profile_id: profileId, doctor_name: apptDoctor, specialty: apptSpecialty, date_time: apptDateTime, location: apptLocation })
      .select()
      .single()
    if (data) {
      setAppointments([...appointments, data].sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()))
      setApptDoctor(''); setApptSpecialty(''); setApptDateTime(''); setApptLocation('')
      setShowAddForm(false)
    }
    setSaving(false)
  }

  const handleDeleteMed = async (id: string) => {
    await supabase.from('medications').delete().eq('id', id)
    setMedications(medications.filter((m) => m.id !== id))
    setSelectedMed(null)
  }

  const handleDeleteAppt = async (id: string) => {
    await supabase.from('appointments').delete().eq('id', id)
    setAppointments(appointments.filter((a) => a.id !== id))
    setSelectedAppt(null)
  }

  const inputClass = "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#38bdf8]/50"

  return (
    <div className="px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[#f1f5f9] text-xl font-bold">Care</h2>
        <button onClick={() => setShowAddForm(true)} className="w-8 h-8 rounded-full bg-[#38bdf8]/10 flex items-center justify-center animate-press">
          <svg width="16" height="16" fill="none" stroke="#38bdf8" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Segment control */}
      <div className="mb-5">
        <SegmentControl segments={['Medications', 'Appointments']} activeIndex={activeSegment} onChange={setActiveSegment} />
      </div>

      {/* Medications segment */}
      {activeSegment === 0 && (
        <div>
          {needsRefill.length > 0 && (
            <>
              <div className="text-[10px] text-[#64748b] font-semibold tracking-wider mb-2">REFILL NEEDED</div>
              {needsRefill.map((med, i) => (
                <button
                  key={med.id}
                  onClick={() => setSelectedMed(med)}
                  className="w-full text-left gradient-border-card bg-[#1e293b] border border-red-500/20 rounded-xl p-3.5 mb-2 flex justify-between items-center card-hover-lift animate-press animate-glow-pulse"
                  style={{ animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) ${i * 100}ms both, glow-pulse 2s ease-in-out infinite` }}
                >
                  <div>
                    <div className="text-[#f1f5f9] text-sm font-semibold">{med.name} {med.dosage}</div>
                    <div className="text-[#94a3b8] text-[11px] mt-0.5">{med.frequency}</div>
                    <div className="text-[#fca5a5] text-[11px] mt-0.5">Refill {daysUntil(med.refill_date).toLowerCase()}</div>
                  </div>
                  <div className="bg-red-500/10 rounded-lg px-2.5 py-1.5">
                    <span className="text-[#fca5a5] text-[11px] font-semibold">Refill</span>
                  </div>
                </button>
              ))}
            </>
          )}

          {activeMeds.length > 0 && (
            <>
              <div className="text-[10px] text-[#64748b] font-semibold tracking-wider mb-2 mt-4">ACTIVE</div>
              {activeMeds.map((med, i) => (
                <button
                  key={med.id}
                  onClick={() => setSelectedMed(med)}
                  className="w-full text-left gradient-border-card bg-[#1e293b] border border-white/[0.06] rounded-xl p-3.5 mb-2 flex justify-between items-center animate-card-in card-hover-lift animate-press"
                  style={{ animationDelay: `${(needsRefill.length + i) * 100}ms` }}
                >
                  <div>
                    <div className="text-[#f1f5f9] text-sm font-semibold">{med.name} {med.dosage}</div>
                    <div className="text-[#94a3b8] text-[11px] mt-0.5">{med.frequency}</div>
                    {med.refill_date && (
                      <div className="text-[#22c55e] text-[11px] mt-0.5">
                        Refill in <AnimatedNumber value={Math.max(0, Math.ceil((new Date(med.refill_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))} suffix=" days" />
                      </div>
                    )}
                  </div>
                  <svg width="16" height="16" fill="none" stroke="#475569" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              ))}
            </>
          )}

          {medications.length === 0 && (
            <div className="text-center py-12 text-[#64748b] text-sm">No medications yet. Tap + to add one.</div>
          )}
        </div>
      )}

      {/* Appointments segment */}
      {activeSegment === 1 && (
        <div>
          {thisWeekAppts.length > 0 && (
            <>
              <div className="text-[10px] text-[#64748b] font-semibold tracking-wider mb-2">THIS WEEK</div>
              {thisWeekAppts.map((appt, i) => (
                <button key={appt.id} onClick={() => setSelectedAppt(appt)} className="w-full text-left gradient-border-card bg-[#1e293b] border border-white/[0.06] rounded-xl p-3.5 mb-2 animate-card-in card-hover-lift animate-press" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                    <span className="text-[#38bdf8] text-[10px] font-semibold">{daysUntil(appt.date_time).toUpperCase()}</span>
                  </div>
                  <div className="text-[#f1f5f9] text-sm font-semibold">{appt.doctor_name || 'Appointment'}</div>
                  {appt.specialty && <div className="text-[#94a3b8] text-[11px] mt-0.5">{appt.specialty}</div>}
                  <div className="text-[#64748b] text-[11px] mt-0.5">
                    {new Date(appt.date_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                    {new Date(appt.date_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </button>
              ))}
            </>
          )}

          {laterAppts.length > 0 && (
            <>
              <div className="text-[10px] text-[#64748b] font-semibold tracking-wider mb-2 mt-4">UPCOMING</div>
              {laterAppts.map((appt, i) => (
                <button key={appt.id} onClick={() => setSelectedAppt(appt)} className="w-full text-left gradient-border-card bg-[#1e293b] border border-white/[0.06] rounded-xl p-3.5 mb-2 animate-card-in card-hover-lift animate-press" style={{ animationDelay: `${(thisWeekAppts.length + i) * 100}ms` }}>
                  <div className="text-[#f1f5f9] text-sm font-semibold">{appt.doctor_name || 'Appointment'}</div>
                  {appt.specialty && <div className="text-[#94a3b8] text-[11px] mt-0.5">{appt.specialty}</div>}
                  <div className="text-[#64748b] text-[11px] mt-0.5">
                    {new Date(appt.date_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                    {new Date(appt.date_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </button>
              ))}
            </>
          )}

          {futureAppts.length === 0 && (
            <div className="text-center py-12 text-[#64748b] text-sm">No upcoming appointments. Tap + to add one.</div>
          )}
        </div>
      )}

      {/* Medication detail bottom sheet */}
      <BottomSheet isOpen={!!selectedMed} onClose={() => setSelectedMed(null)} title={selectedMed?.name}>
        {selectedMed && (
          <div className="space-y-4">
            <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">DOSAGE</div><div className="text-[#e2e8f0] text-sm mt-1">{selectedMed.dosage || 'Not specified'}</div></div>
            <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">FREQUENCY</div><div className="text-[#e2e8f0] text-sm mt-1">{selectedMed.frequency || 'Not specified'}</div></div>
            {selectedMed.refill_date && <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">REFILL DATE</div><div className="text-[#e2e8f0] text-sm mt-1">{new Date(selectedMed.refill_date).toLocaleDateString()}</div></div>}
            <button onClick={() => handleDeleteMed(selectedMed.id)} className="w-full mt-4 py-2.5 rounded-lg bg-red-500/10 text-[#ef4444] text-sm font-semibold animate-press">Remove Medication</button>
          </div>
        )}
      </BottomSheet>

      {/* Appointment detail bottom sheet */}
      <BottomSheet isOpen={!!selectedAppt} onClose={() => setSelectedAppt(null)} title={selectedAppt?.doctor_name || 'Appointment'}>
        {selectedAppt && (
          <div className="space-y-4">
            {selectedAppt.specialty && <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">SPECIALTY</div><div className="text-[#e2e8f0] text-sm mt-1">{selectedAppt.specialty}</div></div>}
            <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">DATE & TIME</div><div className="text-[#e2e8f0] text-sm mt-1">{new Date(selectedAppt.date_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {new Date(selectedAppt.date_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div></div>
            {selectedAppt.location && <div><div className="text-[10px] text-[#64748b] font-semibold tracking-wider">LOCATION</div><div className="text-[#e2e8f0] text-sm mt-1">{selectedAppt.location}</div></div>}
            <button onClick={() => handleDeleteAppt(selectedAppt.id)} className="w-full mt-4 py-2.5 rounded-lg bg-red-500/10 text-[#ef4444] text-sm font-semibold animate-press">Cancel Appointment</button>
          </div>
        )}
      </BottomSheet>

      {/* Add form bottom sheet */}
      <BottomSheet isOpen={showAddForm} onClose={() => setShowAddForm(false)} title={activeSegment === 0 ? 'Add Medication' : 'Add Appointment'}>
        {activeSegment === 0 ? (
          <div className="space-y-3">
            <input placeholder="Medication name" value={medName} onChange={(e) => setMedName(e.target.value)} className={inputClass} />
            <input placeholder="Dosage (e.g. 10mg)" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} className={inputClass} />
            <input placeholder="Frequency (e.g. Once daily)" value={medFrequency} onChange={(e) => setMedFrequency(e.target.value)} className={inputClass} />
            <div><label className="text-[10px] text-[#64748b] font-semibold tracking-wider">REFILL DATE</label><input type="date" value={medRefillDate} onChange={(e) => setMedRefillDate(e.target.value)} className={`mt-1 ${inputClass}`} /></div>
            <button onClick={handleAddMed} disabled={!medName || saving} className="w-full py-2.5 rounded-lg bg-[#38bdf8] text-[#0f172a] text-sm font-semibold disabled:opacity-50 animate-press">{saving ? 'Saving...' : 'Add Medication'}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <input placeholder="Doctor name" value={apptDoctor} onChange={(e) => setApptDoctor(e.target.value)} className={inputClass} />
            <input placeholder="Specialty (e.g. Cardiology)" value={apptSpecialty} onChange={(e) => setApptSpecialty(e.target.value)} className={inputClass} />
            <div><label className="text-[10px] text-[#64748b] font-semibold tracking-wider">DATE & TIME</label><input type="datetime-local" value={apptDateTime} onChange={(e) => setApptDateTime(e.target.value)} className={`mt-1 ${inputClass}`} /></div>
            <input placeholder="Location (optional)" value={apptLocation} onChange={(e) => setApptLocation(e.target.value)} className={inputClass} />
            <button onClick={handleAddAppt} disabled={!apptDoctor || !apptDateTime || saving} className="w-full py-2.5 rounded-lg bg-[#38bdf8] text-[#0f172a] text-sm font-semibold disabled:opacity-50 animate-press">{saving ? 'Saving...' : 'Add Appointment'}</button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CareView.tsx
git commit -m "feat: add CareView — merged meds + appointments with segment control, bottom sheets, animations"
```

---

### Task 12: PriorityCard Component

**Files:**
- Create: `src/components/PriorityCard.tsx`

- [ ] **Step 1: Create reusable priority card component**

```tsx
'use client'

import Link from 'next/link'

type CardVariant = 'urgent' | 'upcoming' | 'alert' | 'quick-ask'

interface PriorityCardProps {
  variant: CardVariant
  title: string
  subtitle?: string
  action?: string
  href?: string
  index?: number
}

const VARIANT_STYLES: Record<CardVariant, { bg: string; border: string; dotColor: string; labelColor: string; label: string }> = {
  urgent: {
    bg: 'bg-gradient-to-br from-red-500/[0.12] to-red-500/[0.04]',
    border: 'border-red-500/20',
    dotColor: 'bg-[#ef4444]',
    labelColor: 'text-[#fca5a5]',
    label: 'NEEDS ATTENTION',
  },
  upcoming: {
    bg: 'bg-[#1e293b]',
    border: 'border-white/[0.06]',
    dotColor: 'bg-[#38bdf8]',
    labelColor: 'text-[#38bdf8]',
    label: 'UPCOMING',
  },
  alert: {
    bg: 'bg-[#1e293b]',
    border: 'border-white/[0.06]',
    dotColor: 'bg-[#f59e0b]',
    labelColor: 'text-[#fbbf24]',
    label: 'ALERT',
  },
  'quick-ask': {
    bg: 'bg-gradient-to-br from-indigo-500/[0.1] to-cyan-400/[0.06]',
    border: 'border-indigo-500/20',
    dotColor: 'bg-[#818cf8]',
    labelColor: 'text-[#a5b4fc]',
    label: 'QUICK ASK',
  },
}

export function PriorityCard({ variant, title, subtitle, action, href, index = 0 }: PriorityCardProps) {
  const s = VARIANT_STYLES[variant]
  const isUrgent = variant === 'urgent'

  const card = (
    <div
      className={`${s.bg} border ${s.border} rounded-xl p-3.5 gradient-border-card card-hover-lift animate-press ${isUrgent ? 'animate-glow-pulse' : ''}`}
      style={{ animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) ${index * 100}ms both${isUrgent ? ', glow-pulse 2s ease-in-out infinite' : ''}` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${s.dotColor}`} />
        <span className={`${s.labelColor} text-[10px] font-semibold tracking-wider`}>{s.label}</span>
      </div>
      <div className="text-[#f1f5f9] text-[13px] font-semibold">{title}</div>
      {subtitle && <div className="text-[#94a3b8] text-[11px] mt-0.5">{subtitle}</div>}
      {action && <div className="text-[#94a3b8] text-[11px] mt-1">{action} →</div>}
    </div>
  )

  if (href) return <Link href={href} className="block mb-2.5">{card}</Link>
  return <div className="mb-2.5">{card}</div>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PriorityCard.tsx
git commit -m "feat: add PriorityCard component with urgent/upcoming/alert/quick-ask variants"
```

---

### Task 13: Rewrite DashboardView as Home Feed

**Files:**
- Modify: `src/components/DashboardView.tsx` (full rewrite)

- [ ] **Step 1: Rewrite DashboardView as priority card feed**

Must use named export to match `import { DashboardView }` in `src/app/(app)/dashboard/page.tsx`.

```tsx
'use client'

import { PriorityCard } from './PriorityCard'

interface DashboardViewProps {
  patientName: string
  medications: any[]
  appointments: any[]
  notifications: any[]
  labResults: any[]
  claims: any[]
}

export function DashboardView({
  patientName,
  medications,
  appointments,
  notifications,
  labResults,
  claims,
}: DashboardViewProps) {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  type CardEntry = { variant: 'urgent' | 'upcoming' | 'alert' | 'quick-ask'; title: string; subtitle?: string; action?: string; href?: string; priority: number }
  const cards: CardEntry[] = []

  // Urgent: medications needing refill within 3 days
  medications.forEach((med) => {
    if (!med.refill_date) return
    const diff = Math.ceil((new Date(med.refill_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 3) {
      const urgency = diff <= 0 ? 'overdue' : diff === 1 ? 'due tomorrow' : `due in ${diff} days`
      cards.push({
        variant: 'urgent',
        title: `${med.name} refill ${urgency}`,
        subtitle: `${med.dosage || ''} ${med.frequency || ''}`.trim() || undefined,
        action: 'Tap to manage refill',
        href: '/care',
        priority: 0,
      })
    }
  })

  // Upcoming: appointments in next 7 days
  appointments.forEach((appt) => {
    if (!appt.date_time) return
    const apptDate = new Date(appt.date_time)
    const diff = Math.ceil((apptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff >= 0 && diff <= 7) {
      const dayStr = apptDate.toLocaleDateString('en-US', { weekday: 'long' })
      const timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      cards.push({
        variant: 'upcoming',
        title: `${appt.doctor_name || 'Appointment'} — ${dayStr} ${timeStr}`,
        subtitle: appt.specialty || undefined,
        href: '/care',
        priority: 1,
      })
    }
  })

  // Alerts: abnormal lab results
  labResults.forEach((lab) => {
    if (lab.is_abnormal) {
      cards.push({
        variant: 'alert',
        title: `${lab.test_name || 'Lab result'} flagged ${lab.flag || 'abnormal'}`,
        subtitle: lab.value ? `Result: ${lab.value}` : undefined,
        action: 'Ask AI about this',
        href: `/chat?prompt=${encodeURIComponent(`Tell me about my ${lab.test_name} result`)}`,
        priority: 2,
      })
    }
  })

  // Alerts: denied claims
  claims.forEach((claim) => {
    if (claim.status === 'denied') {
      cards.push({
        variant: 'alert',
        title: 'Insurance claim denied',
        subtitle: claim.description || claim.provider || undefined,
        action: 'Ask AI for help',
        href: `/chat?prompt=${encodeURIComponent('Help me understand my denied insurance claim')}`,
        priority: 2,
      })
    }
  })

  // Quick ask: contextual AI prompt
  let quickAskPrompt = 'What should I know about my care this week?'
  const nextAppt = appointments.find((a) => a.date_time && new Date(a.date_time) >= now)
  if (nextAppt) {
    quickAskPrompt = `What should I ask ${nextAppt.doctor_name || 'the doctor'} at my next appointment?`
  }
  cards.push({
    variant: 'quick-ask',
    title: quickAskPrompt,
    action: 'Tap to ask',
    href: `/chat?prompt=${encodeURIComponent(quickAskPrompt)}`,
    priority: 3,
  })

  cards.sort((a, b) => a.priority - b.priority)

  return (
    <div className="px-5 py-4">
      <div className="mb-5">
        <div className="text-[#94a3b8] text-xs">{greeting}</div>
        <h2 className="text-[#f1f5f9] text-xl font-bold mt-0.5">{patientName}&apos;s Care Summary</h2>
      </div>

      <div>
        {cards.map((card, i) => (
          <PriorityCard
            key={`${card.variant}-${i}`}
            variant={card.variant}
            title={card.title}
            subtitle={card.subtitle}
            action={card.action}
            href={card.href}
            index={i}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DashboardView.tsx
git commit -m "feat: rewrite DashboardView as priority card feed with urgency sorting"
```

---

## Chunk 4: Route Cleanup & Final Integration

### Task 14: Add Suspense Loading for Dashboard (Skeleton States)

**Files:**
- Create: `src/app/(app)/dashboard/loading.tsx`

- [ ] **Step 1: Create loading.tsx for skeleton states during server-side data fetch**

```tsx
import { SkeletonFeed } from '@/components/SkeletonCard'

export default function DashboardLoading() {
  return <SkeletonFeed />
}
```

- [ ] **Step 2: Create loading.tsx for Care tab too**

Create `src/app/(app)/care/loading.tsx`:

```tsx
import { SkeletonFeed } from '@/components/SkeletonCard'

export default function CareLoading() {
  return <SkeletonFeed />
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/dashboard/loading.tsx src/app/\(app\)/care/loading.tsx
git commit -m "feat: add skeleton loading states for Dashboard and Care tabs"
```

---

### Task 15: Verify Middleware Covers /care Route

**Files:**
- Check: `src/middleware.ts`

- [ ] **Step 1: Read middleware and verify /care is automatically protected**

The middleware guards all routes under `(app)`. Since `/care` is inside `src/app/(app)/care/`, it should be automatically covered. Read the file and confirm — no changes expected.

- [ ] **Step 2: Commit if changes needed**

---

### Task 16: Clean Up Stale Imports

- [ ] **Step 1: Search for NotificationBell imports**

```bash
grep -r "NotificationBell" src/
```

The old AppShell imported it — since we rewrote AppShell, verify no other files reference it.

- [ ] **Step 2: Commit if changes needed**

---

### Task 17: Smoke Test the Full App

- [ ] **Step 1: Run the dev server**

```bash
cd /Users/aryanmotgi/carecompanion && npm run dev
```

- [ ] **Step 2: Test each tab**

Open http://localhost:3000 and verify:
- Home tab: priority card feed, staggered card fade-in, urgent cards glow-pulse, gradient borders on hover, card lift on hover
- Chat tab: works as before
- Care tab: segment control slides, meds grouped by refill/active, appointments by this-week/upcoming, bottom sheets slide up, AnimatedNumber counts up
- Scan tab: opens scanner
- Profile avatar: opens slide-out menu with Care Profile, Connected Accounts, Settings, Help & Support, Sign Out
- Ambient background: subtle floating blobs visible behind content
- Press animations: buttons scale down on tap
- Tab bounce: icons bounce when tapped

- [ ] **Step 3: Test mobile viewport**

In browser dev tools, set viewport to iPhone 14 (390x844):
- Bottom tab bar visible and tappable
- No horizontal scroll
- Cards fill width properly
- Bottom sheets are touch-friendly
- Profile menu fills right side properly

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: mobile-first redesign complete — integration cleanup"
```
