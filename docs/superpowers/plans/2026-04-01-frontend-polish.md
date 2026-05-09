# Frontend Polish & Feature Buildout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all CareCompanion pages to premium mobile-first design standard with expandable cards, polished chat, document hub, settings hub, and living health profile.

**Architecture:** Shared ExpandableCard component used across Dashboard and Care tab. Database migrations first (user_settings table, new columns). Each page rebuilt independently as a client component receiving server-fetched data via props.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, Supabase (PostgreSQL + RLS), TypeScript

**Conventions:**
- Named exports: `export function Foo` (NOT `export default` for components)
- Supabase browser: `import { createClient } from '@/lib/supabase/client'`
- Supabase server: `import { createClient } from '@/lib/supabase/server'`
- FK: `care_profile_id` (NOT `profile_id`)
- All pages under `src/app/(app)/` are server components that fetch data and pass to client components

---

## Chunk 0: Pre-requisite Fix — AnimatedNumber Decimals Support

### Task 0: Add `decimals` prop to AnimatedNumber

**Files:**
- Modify: `src/components/AnimatedNumber.tsx`

The existing `AnimatedNumber` uses `Math.round()` and cannot display decimals (e.g., A1C 7.2). Add a `decimals` prop.

- [ ] **Step 1: Update AnimatedNumber component**

In `src/components/AnimatedNumber.tsx`, update the interface and rendering:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  suffix?: string
  prefix?: string
  className?: string
}

export function AnimatedNumber({
  value,
  duration = 800,
  decimals = 0,
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
            setDisplayValue(eased * value)

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

  const formatted = decimals > 0
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toString()

  return (
    <span ref={ref} className={`animate-number-reveal ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/AnimatedNumber.tsx
git commit -m "feat: add decimals prop to AnimatedNumber for A1C display"
```

---

## Chunk 1: Foundation — Database, Types, Shared Components

### Task 1: Database Migrations

**Files:**
- Create: `supabase/migrations/20260401_user_settings.sql`
- Create: `supabase/migrations/20260401_schema_updates.sql`

- [ ] **Step 1: Create user_settings table migration**

```sql
-- supabase/migrations/20260401_user_settings.sql

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  refill_reminders BOOLEAN DEFAULT true,
  appointment_reminders BOOLEAN DEFAULT true,
  lab_alerts BOOLEAN DEFAULT true,
  claim_updates BOOLEAN DEFAULT true,
  ai_personality TEXT DEFAULT 'professional' CHECK (ai_personality IN ('professional', 'friendly', 'concise')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
```

- [ ] **Step 2: Create schema updates migration**

```sql
-- supabase/migrations/20260401_schema_updates.sql

-- Add pharmacy phone to medications
ALTER TABLE medications ADD COLUMN IF NOT EXISTS pharmacy_phone TEXT;

-- Add emergency contact to care_profiles
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Fix documents RLS (currently has no policies)
CREATE POLICY "Users read own documents" ON documents FOR SELECT USING (
  care_profile_id IN (SELECT id FROM care_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users insert own documents" ON documents FOR INSERT WITH CHECK (
  care_profile_id IN (SELECT id FROM care_profiles WHERE user_id = auth.uid())
);
```

- [ ] **Step 3: Run migrations against Supabase**

Run: `npx supabase db push` or execute SQL directly in Supabase dashboard.

If using direct SQL execution:
```bash
# Load env and run each migration file against the database
# Or paste into Supabase SQL Editor
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add user_settings table, pharmacy_phone, emergency contact columns, documents RLS"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add pharmacy_phone to Medication interface**

In `src/lib/types.ts`, the `Medication` interface (lines 12-24) needs `pharmacy_phone`. Add after `quantity_remaining`:

```typescript
// Add to Medication interface after quantity_remaining
pharmacy_phone?: string | null
```

- [ ] **Step 2: Add emergency contact fields to CareProfile interface**

In the `CareProfile` interface (lines 1-10), add:

```typescript
// Add to CareProfile interface
emergency_contact_name?: string | null
emergency_contact_phone?: string | null
```

- [ ] **Step 3: Create UserSettings interface**

Add at the end of `src/lib/types.ts`:

```typescript
export interface UserSettings {
  id: string
  user_id: string
  refill_reminders: boolean
  appointment_reminders: boolean
  lab_alerts: boolean
  claim_updates: boolean
  ai_personality: 'professional' | 'friendly' | 'concise'
  created_at: string
  updated_at: string
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add UserSettings type, pharmacy_phone and emergency contact to existing types"
```

---

### Task 3: ExpandableCard Shared Component

**Files:**
- Create: `src/components/ExpandableCard.tsx`

- [ ] **Step 1: Create the ExpandableCard component**

```tsx
'use client'

import { useRef, useEffect, useState } from 'react'

interface ExpandableCardProps {
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  expandedContent: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function ExpandableCard({
  expanded,
  onToggle,
  children,
  expandedContent,
  className = '',
  style,
}: ExpandableCardProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [expanded, expandedContent])

  return (
    <div
      onClick={onToggle}
      className={`
        bg-white/[0.04] border rounded-xl p-4 cursor-pointer
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${expanded ? 'border-[rgba(34,211,238,0.2)]' : 'border-white/[0.06]'}
        ${className}
      `}
      style={style}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">{children}</div>
        <span className={`text-lg transition-transform duration-300 ${expanded ? 'rotate-90 text-[#22d3ee]' : 'text-[#64748b]'}`}>
          ▸
        </span>
      </div>

      <div
        style={{
          maxHeight: expanded ? `${height}px` : '0px',
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 300ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
        }}
      >
        <div ref={contentRef}>
          <div
            className="mt-3 pt-3 border-t border-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            {expandedContent}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ExpandableCard.tsx
git commit -m "feat: add shared ExpandableCard component with smooth expand/collapse"
```

---

### Task 4: Lab Value Parsing Utility

**Files:**
- Create: `src/lib/lab-parsing.ts`

- [ ] **Step 1: Create lab value parsing utility**

```typescript
export interface ParsedLabValue {
  displayValue: string
  numericValue: number | null
  referenceMax: number | null
  referenceMin: number | null
  isNumeric: boolean
  progressPercent: number | null
}

export function parseLabValue(value: string | null | undefined, referenceRange: string | null | undefined): ParsedLabValue {
  if (!value) return { displayValue: '—', numericValue: null, referenceMax: null, referenceMin: null, isNumeric: false, progressPercent: null }
  const refRange = referenceRange || ''
  const result: ParsedLabValue = {
    displayValue: value,
    numericValue: null,
    referenceMax: null,
    referenceMin: null,
    isNumeric: false,
    progressPercent: null,
  }

  // Parse value — handle BP format "142/88" (use systolic)
  if (value.includes('/')) {
    const systolic = parseFloat(value.split('/')[0])
    if (!isNaN(systolic)) {
      result.numericValue = systolic
      result.isNumeric = true
    }
  } else {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      result.numericValue = num
      result.isNumeric = true
    }
  }

  // Parse reference range
  const ltMatch = refRange.match(/^<\s*([\d.]+)/)
  const rangeMatch = refRange.match(/^([\d.]+)\s*-\s*([\d.]+)/)
  const ltBpMatch = refRange.match(/^<\s*([\d.]+)\/([\d.]+)/)

  if (ltBpMatch) {
    result.referenceMax = parseFloat(ltBpMatch[1])
  } else if (ltMatch) {
    result.referenceMax = parseFloat(ltMatch[1])
  } else if (rangeMatch) {
    result.referenceMin = parseFloat(rangeMatch[1])
    result.referenceMax = parseFloat(rangeMatch[2])
  }

  // Calculate progress
  if (result.isNumeric && result.numericValue !== null && result.referenceMax !== null) {
    result.progressPercent = Math.min((result.numericValue / result.referenceMax) * 100, 150)
  }

  return result
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/lab-parsing.ts
git commit -m "feat: add lab value parsing utility for progress bar rendering"
```

---

## Chunk 2: Dashboard & Care Tab

### Task 5: Dashboard — Expandable Priority Cards

**Files:**
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/PriorityCard.tsx`

The current `DashboardView.tsx` (127 lines) generates card objects and renders `PriorityCard` components. The current `PriorityCard.tsx` (69 lines) is a simple display component.

- [ ] **Step 1: Update PriorityCard to support expandable content**

Rewrite `src/components/PriorityCard.tsx` to use `ExpandableCard` internally. The card needs to accept an `expandedContent` prop and manage expand state from the parent.

```tsx
'use client'

import Link from 'next/link'
import { ExpandableCard } from './ExpandableCard'

interface PriorityCardProps {
  variant: 'urgent' | 'upcoming' | 'alert' | 'quick-ask'
  label: string
  title: string
  subtitle: string
  action?: string
  href?: string
  index: number
  expanded?: boolean
  onToggle?: () => void
  expandedContent?: React.ReactNode
}

const VARIANT_STYLES = {
  urgent: {
    bg: 'bg-[rgba(239,68,68,0.08)]',
    border: 'border-[rgba(239,68,68,0.2)]',
    dot: 'bg-[#ef4444]',
    label: 'text-[#ef4444]',
  },
  upcoming: {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.06]',
    dot: 'bg-[#22d3ee]',
    label: 'text-[#22d3ee]',
  },
  alert: {
    bg: 'bg-[rgba(251,191,36,0.08)]',
    border: 'border-[rgba(251,191,36,0.2)]',
    dot: 'bg-[#fbbf24]',
    label: 'text-[#fbbf24]',
  },
  'quick-ask': {
    bg: 'bg-gradient-to-br from-indigo-500/10 to-cyan-400/10',
    border: 'border-indigo-500/20',
    dot: 'bg-indigo-500',
    label: 'text-indigo-400',
  },
}

export function PriorityCard({
  variant,
  label,
  title,
  subtitle,
  action,
  href,
  index,
  expanded = false,
  onToggle,
  expandedContent,
}: PriorityCardProps) {
  const s = VARIANT_STYLES[variant]
  const animStyle = {
    animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both${variant === 'urgent' ? ', glow-pulse 2s ease-in-out infinite' : ''}`,
    animationDelay: `${index * 60}ms`,
  }

  const content = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${s.dot}`} />
        <span className={`text-xs font-semibold ${s.label}`}>{label}</span>
      </div>
      <div className="text-[#f1f5f9] text-sm font-semibold">{title}</div>
      <div className="text-[#94a3b8] text-xs">{subtitle}</div>
    </>
  )

  // Quick-ask cards use Link, not expandable
  if (href && variant === 'quick-ask') {
    return (
      <Link href={href}>
        <div
          className={`${s.bg} border ${s.border} rounded-xl p-4 animate-press`}
          style={animStyle}
        >
          {content}
          {action && <div className="text-indigo-400 text-xs font-medium mt-2">{action} →</div>}
        </div>
      </Link>
    )
  }

  // Expandable cards
  if (expandedContent && onToggle) {
    return (
      <ExpandableCard
        expanded={expanded}
        onToggle={onToggle}
        expandedContent={expandedContent}
        className={`${s.bg} ${expanded ? '' : `border-${s.border.replace('border-', '')}`} animate-press`}
        style={animStyle}
      >
        {content}
      </ExpandableCard>
    )
  }

  // Fallback: non-expandable card
  return (
    <div
      className={`${s.bg} border ${s.border} rounded-xl p-4 animate-press`}
      style={animStyle}
    >
      {content}
    </div>
  )
}
```

- [ ] **Step 2: Update DashboardView with expandable cards and empty state**

Rewrite `src/components/DashboardView.tsx`. Key changes:
- Add `expandedId` state for accordion behavior
- Generate `expandedContent` for each card type (medication → call pharmacy, appointment → directions, lab → progress bar)
- Add empty state when no cards exist

```tsx
'use client'

import { useState } from 'react'
import { PriorityCard } from './PriorityCard'
import { AnimatedNumber } from './AnimatedNumber'
import { parseLabValue } from '@/lib/lab-parsing'
import type { Medication, Appointment, LabResult, Claim } from '@/lib/types'

interface DashboardViewProps {
  patientName: string
  medications: Medication[]
  appointments: Appointment[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notifications: any[]
  labResults: LabResult[]
  claims: Claim[]
}

export function DashboardView({
  patientName,
  medications,
  appointments,
  labResults,
  claims,
}: DashboardViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const cards: {
    id: string
    variant: 'urgent' | 'upcoming' | 'alert' | 'quick-ask'
    label: string
    title: string
    subtitle: string
    priority: number
    action?: string
    href?: string
    expandedContent?: React.ReactNode
  }[] = []

  // Medication refill cards
  const now = new Date()
  medications.forEach((med) => {
    if (!med.refill_date) return
    const refillDate = new Date(med.refill_date)
    const daysLeft = Math.ceil((refillDate.getTime() - now.getTime()) / 86400000)
    if (daysLeft <= 3) {
      cards.push({
        id: `med-${med.id}`,
        variant: 'urgent',
        label: 'URGENT',
        title: `${med.name} refill ${daysLeft <= 0 ? 'overdue' : daysLeft === 1 ? 'due tomorrow' : `due in ${daysLeft} days`}`,
        subtitle: `${med.quantity_remaining ?? '?'} pills remaining • ${med.prescribing_doctor || 'Unknown doctor'}`,
        priority: 1,
        expandedContent: (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-[#64748b]">Dose:</span> <span className="text-[#e2e8f0]">{med.dose}</span></div>
              <div><span className="text-[#64748b]">Frequency:</span> <span className="text-[#e2e8f0]">{med.frequency}</span></div>
              <div><span className="text-[#64748b]">Doctor:</span> <span className="text-[#e2e8f0]">{med.prescribing_doctor}</span></div>
              <div><span className="text-[#64748b]">Remaining:</span> <span className="text-[#fbbf24]">{med.quantity_remaining} pills</span></div>
            </div>
            {med.pharmacy_phone && (
              <a
                href={`tel:${med.pharmacy_phone}`}
                className="block w-full text-center py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-xs font-semibold"
              >
                Call Pharmacy
              </a>
            )}
          </div>
        ),
      })
    }
  })

  // Appointment cards (next 7 days)
  appointments.forEach((appt) => {
    const apptDate = new Date(appt.date_time)
    const daysUntil = Math.ceil((apptDate.getTime() - now.getTime()) / 86400000)
    if (daysUntil >= 0 && daysUntil <= 7) {
      const timeStr = apptDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      const dayStr = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`
      cards.push({
        id: `appt-${appt.id}`,
        variant: 'upcoming',
        label: 'UPCOMING',
        title: `${appt.doctor_name} — ${appt.specialty}`,
        subtitle: `${dayStr} at ${timeStr} • ${appt.purpose || ''}`,
        priority: 2,
        expandedContent: (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-[#64748b]">Location:</span> <span className="text-[#e2e8f0]">{appt.location}</span></div>
              <div><span className="text-[#64748b]">Purpose:</span> <span className="text-[#e2e8f0]">{appt.purpose}</span></div>
            </div>
            <div className="flex gap-2">
              {appt.location && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(appt.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold"
                >
                  Get Directions
                </a>
              )}
              <a
                href={`/chat?prompt=${encodeURIComponent(`Help me prepare for my ${appt.specialty} appointment with ${appt.doctor_name}`)}`}
                className="flex-1 text-center py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-xs font-semibold"
              >
                Prepare with AI
              </a>
            </div>
          </div>
        ),
      })
    }
  })

  // Abnormal lab alerts
  labResults.forEach((lab) => {
    if (!lab.is_abnormal) return
    const parsed = parseLabValue(lab.value, lab.reference_range || '')
    cards.push({
      id: `lab-${lab.id}`,
      variant: 'alert',
      label: 'ALERT',
      title: `${lab.test_name} — ${lab.value} ${lab.unit}`,
      subtitle: `${lab.is_abnormal ? 'Above normal' : 'Normal'} range (${lab.reference_range}) • ${lab.source || ''}`,
      priority: 3,
      expandedContent: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-[#64748b]">Value:</span> <span className="text-[#ef4444]">{lab.value} {lab.unit}</span></div>
            <div><span className="text-[#64748b]">Normal:</span> <span className="text-[#e2e8f0]">{lab.reference_range}</span></div>
            <div><span className="text-[#64748b]">Source:</span> <span className="text-[#e2e8f0]">{lab.source}</span></div>
            <div><span className="text-[#64748b]">Date:</span> <span className="text-[#e2e8f0]">{new Date(lab.date_taken).toLocaleDateString()}</span></div>
          </div>
          {parsed.progressPercent !== null && (
            <div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#ef4444]"
                  style={{ width: `${Math.min(parsed.progressPercent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#64748b] mt-1">
                <span>0</span>
                <span>{parsed.referenceMax ? `Normal: <${parsed.referenceMax}` : ''}</span>
              </div>
            </div>
          )}
        </div>
      ),
    })
  })

  // Denied claims
  claims.forEach((claim) => {
    if (claim.status !== 'denied') return
    cards.push({
      id: `claim-${claim.id}`,
      variant: 'alert',
      label: 'ALERT',
      title: `Claim denied — ${claim.provider_name}`,
      subtitle: `$${claim.patient_responsibility} patient responsibility • ${claim.denial_reason || ''}`,
      priority: 3,
      expandedContent: (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-[#64748b]">Billed:</span> <span className="text-[#e2e8f0]">${claim.billed_amount}</span></div>
          <div><span className="text-[#64748b]">Paid:</span> <span className="text-[#e2e8f0]">${claim.paid_amount}</span></div>
          <div><span className="text-[#64748b]">Your cost:</span> <span className="text-[#ef4444]">${claim.patient_responsibility}</span></div>
          <div><span className="text-[#64748b]">Reason:</span> <span className="text-[#fbbf24]">{claim.denial_reason}</span></div>
        </div>
      ),
    })
  })

  // Quick-ask card (always last)
  cards.push({
    id: 'quick-ask',
    variant: 'quick-ask',
    label: 'AI ASSISTANT',
    title: 'Ask CareCompanion',
    subtitle: 'Get help understanding your health data',
    priority: 99,
    action: 'Start a conversation',
    href: '/chat',
  })

  cards.sort((a, b) => a.priority - b.priority)
  const actionCount = cards.filter((c) => c.variant !== 'quick-ask').length

  return (
    <div className="px-5 py-6">
      <div className="mb-1 text-[#94a3b8] text-xs uppercase tracking-wider">{greeting}</div>
      <h2 className="text-[#f1f5f9] text-xl font-bold mb-5">
        {actionCount > 0 ? (
          <>
            <AnimatedNumber value={actionCount} /> {actionCount === 1 ? 'item needs' : 'items need'} attention
          </>
        ) : (
          `Looking good, ${patientName.split(' ')[0]}!`
        )}
      </h2>

      {actionCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#10b981]/10 flex items-center justify-center mb-4">
            <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="text-[#f1f5f9] text-lg font-semibold mb-1">All clear!</div>
          <div className="text-[#64748b] text-sm">No items need your attention right now.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card, i) => (
            <PriorityCard
              key={card.id}
              variant={card.variant}
              label={card.label}
              title={card.title}
              subtitle={card.subtitle}
              action={card.action}
              href={card.href}
              index={i}
              expanded={expandedId === card.id}
              onToggle={() => setExpandedId(expandedId === card.id ? null : card.id)}
              expandedContent={card.expandedContent}
            />
          ))}
        </div>
      )}

      {/* Quick-ask prompts */}
      {actionCount > 0 && (
        <div className="mt-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Quick Ask</div>
          <div className="flex flex-wrap gap-2">
            {['Prepare for my appointment', 'Explain my lab results', 'What should I ask my doctor?'].map((prompt) => (
              <a
                key={prompt}
                href={`/chat?prompt=${encodeURIComponent(prompt)}`}
                className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#94a3b8] text-xs hover:bg-white/[0.08] transition-colors animate-press"
              >
                {prompt}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Visual test**

Run: `npm run dev`
Navigate to `http://localhost:3000/dashboard`
Verify: Cards render, expand on tap, collapse when another is tapped, pharmacy/directions buttons visible in expanded state.

- [ ] **Step 5: Commit**

```bash
git add src/components/DashboardView.tsx src/components/PriorityCard.tsx
git commit -m "feat: dashboard expandable priority cards with empty state and quick-ask prompts"
```

---

### Task 6: Care Tab — Expandable Cards

**Files:**
- Modify: `src/components/CareView.tsx`
- Modify: `src/app/(app)/care/page.tsx` (add doctors prop)

The current `CareView.tsx` (264 lines) uses BottomSheet for detail views. Full rewrite to use ExpandableCard. Keep BottomSheet for add-new forms only.

- [ ] **Step 1: Update care page to also fetch doctors (for Call Office button)**

In `src/app/(app)/care/page.tsx`, add doctors fetch alongside medications and appointments:

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
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const [{ data: medications }, { data: appointments }, { data: doctors }] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id).order('date_time', { ascending: true }),
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
  ])

  return (
    <CareView
      profileId={profile.id}
      medications={medications || []}
      appointments={appointments || []}
      doctors={doctors || []}
    />
  )
}
```

- [ ] **Step 2: Full rewrite of CareView with expandable cards**

Replace the entire `src/components/CareView.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SegmentControl } from './SegmentControl'
import { ExpandableCard } from './ExpandableCard'
import { BottomSheet } from './BottomSheet'
import type { Medication, Appointment, Doctor } from '@/lib/types'

interface CareViewProps {
  profileId: string
  medications: Medication[]
  appointments: Appointment[]
  doctors: Doctor[]
}

export function CareView({ profileId, medications: initialMeds, appointments: initialAppts, doctors }: CareViewProps) {
  const [segment, setSegment] = useState<'medications' | 'appointments'>('medications')
  const [medications, setMedications] = useState(initialMeds)
  const [appointments, setAppointments] = useState(initialAppts)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showMedForm, setShowMedForm] = useState(false)
  const [showApptForm, setShowApptForm] = useState(false)

  // Form state for adding
  const [medName, setMedName] = useState('')
  const [medDose, setMedDose] = useState('')
  const [medFreq, setMedFreq] = useState('')
  const [apptDoctor, setApptDoctor] = useState('')
  const [apptSpecialty, setApptSpecialty] = useState('')
  const [apptDate, setApptDate] = useState('')
  const [apptLocation, setApptLocation] = useState('')
  const [apptPurpose, setApptPurpose] = useState('')

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[#e2e8f0] text-sm outline-none placeholder:text-[#64748b] mb-3'

  const now = new Date()

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr)
    return Math.ceil((d.getTime() - now.getTime()) / 86400000)
  }

  // Lookup doctor phone by name
  const getDoctorPhone = (doctorName: string) => {
    const doc = doctors.find((d) => d.name.toLowerCase() === doctorName.toLowerCase())
    return doc?.phone || null
  }

  const needsRefill = medications.filter((m) => m.refill_date && daysUntil(m.refill_date) <= 3)
  const activeMeds = medications.filter((m) => !m.refill_date || daysUntil(m.refill_date) > 3)

  const thisWeekAppts = appointments.filter((a) => {
    const days = daysUntil(a.date_time)
    return days >= 0 && days <= 7
  })
  const upcomingAppts = appointments.filter((a) => daysUntil(a.date_time) > 7)

  const handleAddMed = async () => {
    if (!medName) return
    const supabase = createClient()
    const { data } = await supabase.from('medications').insert({
      care_profile_id: profileId,
      name: medName,
      dose: medDose,
      frequency: medFreq,
    }).select().single()
    if (data) setMedications([...medications, data])
    setMedName(''); setMedDose(''); setMedFreq('')
    setShowMedForm(false)
  }

  const handleAddAppt = async () => {
    if (!apptDoctor || !apptDate) return
    const supabase = createClient()
    const { data } = await supabase.from('appointments').insert({
      care_profile_id: profileId,
      doctor_name: apptDoctor,
      specialty: apptSpecialty,
      date_time: new Date(apptDate).toISOString(),
      location: apptLocation,
      purpose: apptPurpose,
    }).select().single()
    if (data) setAppointments([...appointments, data])
    setApptDoctor(''); setApptSpecialty(''); setApptDate(''); setApptLocation(''); setApptPurpose('')
    setShowApptForm(false)
  }

  const handleDeleteMed = async (id: string) => {
    const supabase = createClient()
    await supabase.from('medications').delete().eq('id', id)
    setMedications(medications.filter((m) => m.id !== id))
    setExpandedId(null)
  }

  const handleDeleteAppt = async (id: string) => {
    const supabase = createClient()
    await supabase.from('appointments').delete().eq('id', id)
    setAppointments(appointments.filter((a) => a.id !== id))
    setExpandedId(null)
  }

  const renderMedCard = (med: Medication, i: number) => {
    const refillSoon = med.refill_date && daysUntil(med.refill_date) <= 3
    const lowQty = (med.quantity_remaining ?? 999) <= 5
    return (
      <ExpandableCard
        key={med.id}
        expanded={expandedId === med.id}
        onToggle={() => setExpandedId(expandedId === med.id ? null : med.id)}
        className="animate-press"
        style={{ animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both`, animationDelay: `${i * 60}ms` }}
        expandedContent={
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-[#64748b]">Doctor:</span> <span className="text-[#e2e8f0]">{med.prescribing_doctor || '—'}</span></div>
              <div><span className="text-[#64748b]">Refill:</span> <span className={refillSoon ? 'text-[#ef4444]' : 'text-[#e2e8f0]'}>{med.refill_date ? new Date(med.refill_date).toLocaleDateString() : '—'}</span></div>
              <div><span className="text-[#64748b]">Remaining:</span> <span className={lowQty ? 'text-[#fbbf24]' : 'text-[#e2e8f0]'}>{med.quantity_remaining ?? '—'}</span></div>
              <div><span className="text-[#64748b]">Frequency:</span> <span className="text-[#e2e8f0]">{med.frequency || '—'}</span></div>
            </div>
            <div className="flex gap-2">
              {med.pharmacy_phone && (
                <a href={`tel:${med.pharmacy_phone}`} className="flex-1 text-center py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-xs font-semibold animate-press">
                  Call Pharmacy
                </a>
              )}
              <button
                onClick={() => handleDeleteMed(med.id)}
                className="flex-1 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold animate-press"
              >
                Delete
              </button>
            </div>
          </div>
        }
      >
        <div>
          <div className="text-[#f1f5f9] text-[15px] font-semibold">{med.name}</div>
          <div className="text-[#94a3b8] text-xs">{med.dose}{med.frequency ? ` • ${med.frequency}` : ''}</div>
        </div>
      </ExpandableCard>
    )
  }

  const renderApptCard = (appt: Appointment, i: number) => {
    const apptDate = new Date(appt.date_time)
    const timeStr = apptDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const dateStr = apptDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    const doctorPhone = getDoctorPhone(appt.doctor_name)

    return (
      <ExpandableCard
        key={appt.id}
        expanded={expandedId === appt.id}
        onToggle={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
        className="animate-press"
        style={{ animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both`, animationDelay: `${i * 60}ms` }}
        expandedContent={
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-[#64748b]">Location:</span> <span className="text-[#e2e8f0]">{appt.location || '—'}</span></div>
              <div><span className="text-[#64748b]">Purpose:</span> <span className="text-[#e2e8f0]">{appt.purpose || '—'}</span></div>
            </div>
            <div className="flex gap-2">
              {doctorPhone && (
                <a href={`tel:${doctorPhone}`} className="flex-1 text-center py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold animate-press">
                  Call Office
                </a>
              )}
              {appt.location && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(appt.location)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold animate-press">
                  Directions
                </a>
              )}
              <a href={`/chat?prompt=${encodeURIComponent(`Help me prepare for my ${appt.specialty} appointment with ${appt.doctor_name}`)}`} className="flex-1 text-center py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-xs font-semibold animate-press">
                Prepare
              </a>
            </div>
          </div>
        }
      >
        <div>
          <div className="text-[#f1f5f9] text-[15px] font-semibold">{appt.doctor_name}</div>
          <div className="text-[#94a3b8] text-xs">{appt.specialty} • {dateStr} at {timeStr}</div>
        </div>
      </ExpandableCard>
    )
  }

  return (
    <div className="px-5 py-6">
      <SegmentControl
        segments={[
          { id: 'medications', label: 'Medications' },
          { id: 'appointments', label: 'Appointments' },
        ]}
        active={segment}
        onChange={(id) => { setSegment(id as 'medications' | 'appointments'); setExpandedId(null) }}
      />

      {segment === 'medications' && (
        <div className="mt-5 space-y-5">
          {needsRefill.length > 0 && (
            <div>
              <div className="text-[#ef4444] text-[11px] uppercase tracking-wider font-semibold mb-2">Needs Refill</div>
              <div className="space-y-2">{needsRefill.map((m, i) => renderMedCard(m, i))}</div>
            </div>
          )}
          <div>
            <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Active Medications</div>
            {activeMeds.length === 0 && needsRefill.length === 0 ? (
              <div className="text-center py-8 text-[#64748b] text-sm">No medications added yet</div>
            ) : (
              <div className="space-y-2">{activeMeds.map((m, i) => renderMedCard(m, i + needsRefill.length))}</div>
            )}
          </div>
          <button
            onClick={() => setShowMedForm(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold animate-press"
          >
            + Add Medication
          </button>
        </div>
      )}

      {segment === 'appointments' && (
        <div className="mt-5 space-y-5">
          {thisWeekAppts.length > 0 && (
            <div>
              <div className="text-[#22d3ee] text-[11px] uppercase tracking-wider font-semibold mb-2">This Week</div>
              <div className="space-y-2">{thisWeekAppts.map((a, i) => renderApptCard(a, i))}</div>
            </div>
          )}
          <div>
            <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Upcoming</div>
            {upcomingAppts.length === 0 && thisWeekAppts.length === 0 ? (
              <div className="text-center py-8 text-[#64748b] text-sm">No appointments scheduled</div>
            ) : (
              <div className="space-y-2">{upcomingAppts.map((a, i) => renderApptCard(a, i + thisWeekAppts.length))}</div>
            )}
          </div>
          <button
            onClick={() => setShowApptForm(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold animate-press"
          >
            + Add Appointment
          </button>
        </div>
      )}

      {/* Add Medication Form */}
      <BottomSheet isOpen={showMedForm} onClose={() => setShowMedForm(false)} title="Add Medication">
        <input className={inputClass} placeholder="Medication name" value={medName} onChange={(e) => setMedName(e.target.value)} />
        <input className={inputClass} placeholder="Dose (e.g., 10mg)" value={medDose} onChange={(e) => setMedDose(e.target.value)} />
        <input className={inputClass} placeholder="Frequency (e.g., Once daily)" value={medFreq} onChange={(e) => setMedFreq(e.target.value)} />
        <button onClick={handleAddMed} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold">Save</button>
      </BottomSheet>

      {/* Add Appointment Form */}
      <BottomSheet isOpen={showApptForm} onClose={() => setShowApptForm(false)} title="Add Appointment">
        <input className={inputClass} placeholder="Doctor name" value={apptDoctor} onChange={(e) => setApptDoctor(e.target.value)} />
        <input className={inputClass} placeholder="Specialty" value={apptSpecialty} onChange={(e) => setApptSpecialty(e.target.value)} />
        <input className={inputClass} type="datetime-local" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
        <input className={inputClass} placeholder="Location" value={apptLocation} onChange={(e) => setApptLocation(e.target.value)} />
        <input className={inputClass} placeholder="Purpose" value={apptPurpose} onChange={(e) => setApptPurpose(e.target.value)} />
        <button onClick={handleAddAppt} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold">Save</button>
      </BottomSheet>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Visual test**

Navigate to `http://localhost:3000/care`
Verify: Medications and appointments show as expandable cards. Accordion behavior works. Add forms still work via BottomSheet.

- [ ] **Step 4: Commit**

```bash
git add src/components/CareView.tsx
git commit -m "feat: care tab expandable cards replacing detail bottom sheets"
```

---

## Chunk 3: Chat & Scans

### Task 7: Chat Page — Visual Polish

**Files:**
- Modify: `src/components/ChatInterface.tsx`
- Modify: `src/components/MessageBubble.tsx`

- [ ] **Step 1: Restyle MessageBubble**

Rewrite `src/components/MessageBubble.tsx` with the new design:

```tsx
'use client'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

function renderMarkdown(text: string) {
  // Simple markdown: bold, italic, lists, headers
  return text.split('\n').map((line, i) => {
    // Headers
    if (line.startsWith('### ')) return <h4 key={i} className="text-[#f1f5f9] font-semibold text-sm mt-2 mb-1">{line.slice(4)}</h4>
    if (line.startsWith('## ')) return <h3 key={i} className="text-[#f1f5f9] font-semibold text-base mt-2 mb-1">{line.slice(3)}</h3>
    // List items
    if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc">{formatInline(line.slice(2))}</li>
    if (/^\d+\. /.test(line)) return <li key={i} className="ml-4 list-decimal">{formatInline(line.replace(/^\d+\. /, ''))}</li>
    // Empty line
    if (!line.trim()) return <br key={i} />
    // Regular paragraph
    return <p key={i} className="mb-1">{formatInline(line)}</p>
  })
}

function formatInline(text: string) {
  // Bold and italic
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-[#f1f5f9]">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3 animate-slide-up">
        <div className="max-w-[75%] bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-[16px_16px_4px_16px] px-4 py-2.5 text-white text-sm leading-relaxed">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start mb-3 animate-slide-up">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
        AI
      </div>
      <div className="flex-1 max-w-[80%]">
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-[4px_16px_16px_16px] px-4 py-2.5 text-[#e2e8f0] text-sm leading-relaxed">
          {renderMarkdown(content)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update ChatInterface styling**

In `src/components/ChatInterface.tsx`, update:
- Input bar: glass card style with gradient send button
- Empty state: show starter prompt buttons
- Typing indicator: ensure `TypingIndicator` component (already exists at `src/components/TypingIndicator.tsx`) is shown when `isLoading` is true from useChat — style it with three dots using staggered bounce: each dot is a `span` with `animation: bounce 1.4s infinite both` and `animation-delay: 0s, 0.2s, 0.4s`
- Add `animate-slide-up` keyframe to message entrance
- Update input placeholder to "Ask about your health..."

Key changes to the input section (bottom of ChatInterface):
```tsx
{/* Input bar */}
<div className="p-4">
  {messages.length === 0 && (
    <div className="flex flex-wrap gap-2 mb-3">
      {['How are my vitals?', 'Prepare for my next appointment', 'Explain my medications'].map((prompt) => (
        <button
          key={prompt}
          onClick={() => handleStarterPrompt(prompt)}
          className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#94a3b8] text-xs hover:bg-white/[0.08] transition-colors animate-press"
        >
          {prompt}
        </button>
      ))}
    </div>
  )}
  <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2">
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Ask about your health..."
      className="flex-1 bg-transparent text-[#e2e8f0] text-sm outline-none placeholder:text-[#64748b]"
    />
    <button
      onClick={handleSend}
      disabled={!input.trim()}
      className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white disabled:opacity-40 transition-opacity animate-press"
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
      </svg>
    </button>
  </div>
</div>
```

- [ ] **Step 3: Add slide-up animation to globals.css if not present**

Check if `animate-slide-up` exists in globals.css. If not, add:

```css
.animate-slide-up {
  animation: slide-up 0.3s ease-out both;
}
```

(The `slide-up` keyframe already exists in globals.css from the previous redesign.)

- [ ] **Step 4: Verify build and visual test**

Run: `npm run build && npm run dev`
Navigate to `http://localhost:3000/chat`
Verify: User bubbles are gradient, AI bubbles have avatar, input bar is glass-card style, starter prompts show on empty state.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatInterface.tsx src/components/MessageBubble.tsx src/app/globals.css
git commit -m "feat: chat page visual polish — gradient bubbles, AI avatar, glass input bar, starter prompts"
```

---

### Task 8: Scans — Document Hub Redesign

**Files:**
- Modify: `src/components/ScanCenter.tsx`

The current `ScanCenter.tsx` has a 5-category grid. Redesign to 4-category (2x2) grid with recent scans list below.

- [ ] **Step 1: Rewrite ScanCenter**

```tsx
'use client'

import { useState } from 'react'
import { DocumentScanner } from './DocumentScanner'
import { CategoryScanner } from './CategoryScanner'

const CATEGORIES = [
  { id: 'lab', label: 'Lab Reports', emoji: '🧪', color: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)', types: ['lab_report'] },
  { id: 'prescription', label: 'Prescriptions', emoji: '💊', color: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.2)', types: ['medication'] },
  { id: 'insurance', label: 'Insurance/EOBs', emoji: '🏥', color: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.2)', types: ['insurance_card', 'eob_bill'] },
  { id: 'medical', label: 'Medical Records', emoji: '📋', color: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)', types: ['doctor_note'] },
]

interface ScanCenterProps {
  documents?: { id: string; type: string; description: string | null; document_date: string | null }[]
}

export function ScanCenter({ documents = [] }: ScanCenterProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanType, setScanType] = useState<string | null>(null)

  const filteredDocs = activeCategory
    ? documents.filter((d) => {
        const cat = CATEGORIES.find((c) => c.id === activeCategory)
        return cat?.types.includes(d.type)
      })
    : documents

  const getCategoryCount = (catId: string) => {
    const cat = CATEGORIES.find((c) => c.id === catId)
    return documents.filter((d) => cat?.types.includes(d.type)).length
  }

  if (scanning && scanType) {
    return <CategoryScanner category={scanType} onClose={() => { setScanning(false); setScanType(null) }} />
  }

  if (scanning) {
    return <DocumentScanner onClose={() => setScanning(false)} />
  }

  return (
    <div className="px-5 py-6">
      <h2 className="text-[#f1f5f9] text-xl font-bold mb-1">Scan Center</h2>
      <p className="text-[#64748b] text-sm mb-5">Upload and manage your medical documents</p>

      {/* Category grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className={`rounded-xl p-4 text-center transition-all duration-200 animate-press border ${
              activeCategory === cat.id ? 'border-[rgba(34,211,238,0.3)] ring-1 ring-[rgba(34,211,238,0.1)]' : ''
            }`}
            style={{
              background: cat.color,
              borderColor: activeCategory === cat.id ? 'rgba(34,211,238,0.3)' : cat.borderColor,
              animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both`,
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div className="text-2xl mb-1">{cat.emoji}</div>
            <div className="text-[#f1f5f9] text-sm font-semibold">{cat.label}</div>
            <div className="text-[#64748b] text-xs">{getCategoryCount(cat.id)} documents</div>
          </button>
        ))}
      </div>

      {/* Recent scans */}
      <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-3">
        {activeCategory ? CATEGORIES.find((c) => c.id === activeCategory)?.label : 'Recent Scans'}
      </div>

      {filteredDocs.length === 0 ? (
        <div className="text-center py-8 text-[#64748b] text-sm">
          {activeCategory ? 'No documents in this category' : 'No documents scanned yet'}
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {filteredDocs.slice(0, 10).map((doc) => {
            const cat = CATEGORIES.find((c) => c.types.includes(doc.type))
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl p-3"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{ background: cat?.color || 'rgba(255,255,255,0.04)' }}
                >
                  {cat?.emoji || '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[#f1f5f9] text-sm font-semibold truncate">
                    {doc.description || doc.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[#64748b] text-xs">
                    {doc.document_date ? new Date(doc.document_date).toLocaleDateString() : 'Unknown date'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Scan button */}
      <button
        onClick={() => setScanning(true)}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold tracking-wide animate-press"
      >
        + Scan New Document
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Update scans page to pass documents**

Modify `src/app/(app)/scans/page.tsx` to be a server component that fetches documents:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScanCenter } from '@/components/ScanCenter'

export default async function ScansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  let documents: { id: string; type: string; description: string | null; document_date: string | null }[] = []
  if (profile) {
    const { data } = await supabase
      .from('documents')
      .select('id, type, description, document_date')
      .eq('care_profile_id', profile.id)
      .order('document_date', { ascending: false })
      .limit(20)
    documents = data || []
  }

  return <ScanCenter documents={documents} />
}
```

- [ ] **Step 3: Verify build and visual test**

Run: `npm run build && npm run dev`
Navigate to `http://localhost:3000/scans`
Verify: 2x2 category grid renders, tapping category filters the list, scan button works.

- [ ] **Step 4: Commit**

```bash
git add src/components/ScanCenter.tsx src/app/(app)/scans/page.tsx
git commit -m "feat: scan center redesign — 2x2 category grid, filtered document list, premium styling"
```

---

## Chunk 4: Settings & Profile

### Task 9: Settings — Full Settings Hub

**Files:**
- Modify: `src/components/SettingsPage.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Rewrite SettingsPage**

Complete rewrite of `src/components/SettingsPage.tsx` as iPhone-style grouped settings:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings, ConnectedApp } from '@/lib/types'

interface SettingsPageProps {
  settings: UserSettings | null
  connectedApps: ConnectedApp[]
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-[42px] h-6 rounded-full relative transition-colors duration-200 ${
        enabled ? 'bg-gradient-to-r from-indigo-500 to-cyan-400' : 'bg-white/[0.1]'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full absolute top-0.5 transition-all duration-200 ${
          enabled ? 'right-0.5 bg-white' : 'left-0.5 bg-[#64748b]'
        }`}
      />
    </button>
  )
}

function SettingsRow({
  label,
  description,
  right,
  onClick,
  danger,
}: {
  label: string
  description?: string
  right?: React.ReactNode
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <div
      className={`px-4 py-3.5 flex items-center justify-between ${onClick ? 'cursor-pointer active:bg-white/[0.02]' : ''}`}
      onClick={onClick}
    >
      <div>
        <div className={`text-sm ${danger ? 'text-[#ef4444]' : 'text-[#e2e8f0]'}`}>{label}</div>
        {description && <div className="text-[11px] text-[#64748b] mt-0.5">{description}</div>}
      </div>
      {right || (onClick && <span className="text-[#64748b] text-base">›</span>)}
    </div>
  )
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2 mt-6 first:mt-0">
      {children}
    </div>
  )
}

export function SettingsPage({ settings: initialSettings, connectedApps }: SettingsPageProps) {
  const router = useRouter()
  const [settings, setSettings] = useState<UserSettings | null>(initialSettings)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleSetting = async (key: keyof UserSettings) => {
    if (!settings) return
    const supabase = createClient()
    const newValue = !settings[key]
    setSettings({ ...settings, [key]: newValue })
    await supabase
      .from('user_settings')
      .update({ [key]: newValue, updated_at: new Date().toISOString() })
      .eq('user_id', settings.user_id)
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) return
    setSaving(true)
    const supabase = createClient()
    await supabase.auth.updateUser({ password: newPassword })
    setNewPassword('')
    setShowPasswordForm(false)
    setSaving(false)
  }

  const handleDeleteAccount = async () => {
    setSaving(true)
    const res = await fetch('/api/delete-account', { method: 'POST' })
    if (res.ok) {
      window.location.href = '/login'
    }
    setSaving(false)
  }

  const handleExport = async () => {
    const res = await fetch('/api/export-data')
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'carecompanion-data.json'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="px-5 py-6">
      <h2 className="text-[#f1f5f9] text-xl font-bold mb-6">Settings</h2>

      <SectionLabel>Notifications</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label="Refill Reminders"
          description="Alert when medications are running low"
          right={<Toggle enabled={settings?.refill_reminders ?? true} onToggle={() => toggleSetting('refill_reminders')} />}
        />
        <SettingsRow
          label="Appointment Reminders"
          description="24 hours and 1 hour before"
          right={<Toggle enabled={settings?.appointment_reminders ?? true} onToggle={() => toggleSetting('appointment_reminders')} />}
        />
        <SettingsRow
          label="Lab Result Alerts"
          description="Notify when new results are available"
          right={<Toggle enabled={settings?.lab_alerts ?? true} onToggle={() => toggleSetting('lab_alerts')} />}
        />
        <SettingsRow
          label="Claim Updates"
          description="Status changes on insurance claims"
          right={<Toggle enabled={settings?.claim_updates ?? true} onToggle={() => toggleSetting('claim_updates')} />}
        />
      </SettingsGroup>

      <SectionLabel>Connected Accounts</SectionLabel>
      <SettingsGroup>
        {connectedApps.length === 0 ? (
          <SettingsRow
            label="No accounts connected"
            description="Connect health systems, insurance, and more"
            onClick={() => router.push('/connect')}
          />
        ) : (
          connectedApps.map((app) => (
            <SettingsRow
              key={app.id}
              label={app.source}
              description={app.last_synced ? `Last synced ${new Date(app.last_synced).toLocaleDateString()}` : undefined}
              right={<span className="text-[#10b981] text-xs font-semibold">Connected</span>}
              onClick={() => router.push('/connect')}
            />
          ))
        )}
        <SettingsRow label="Manage Connections" onClick={() => router.push('/connect')} />
      </SettingsGroup>

      <SectionLabel>App Preferences</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label="Theme"
          right={<span className="text-[#64748b] text-sm">Dark</span>}
        />
        <SettingsRow
          label="AI Personality"
          right={
            <select
              value={settings?.ai_personality || 'professional'}
              onChange={async (e) => {
                if (!settings) return
                const val = e.target.value as 'professional' | 'friendly' | 'concise'
                setSettings({ ...settings, ai_personality: val })
                const supabase = createClient()
                await supabase.from('user_settings').update({ ai_personality: val, updated_at: new Date().toISOString() }).eq('user_id', settings.user_id)
              }}
              className="bg-transparent text-[#64748b] text-sm outline-none cursor-pointer"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
            </select>
          }
        />
      </SettingsGroup>

      <SectionLabel>Privacy & Security</SectionLabel>
      <SettingsGroup>
        <SettingsRow label="Export My Data" onClick={handleExport} />
        <SettingsRow
          label="Change Password"
          onClick={() => setShowPasswordForm(!showPasswordForm)}
        />
        <SettingsRow label="Delete Account" danger onClick={() => setShowDeleteConfirm(true)} />
      </SettingsGroup>

      {showPasswordForm && (
        <div className="mt-3 bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 6 characters)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[#e2e8f0] text-sm mb-3 outline-none"
          />
          <button
            onClick={handleChangePassword}
            disabled={saving || newPassword.length < 6}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold disabled:opacity-40"
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#1e293b] rounded-xl p-6 mx-5 max-w-sm w-full">
            <h3 className="text-[#f1f5f9] text-lg font-bold mb-2">Delete Account</h3>
            <p className="text-[#94a3b8] text-sm mb-4">
              This will permanently delete your account and all your data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-white/[0.06] text-[#e2e8f0] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-40"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SectionLabel>About</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label="App Version"
          right={<span className="text-[#64748b] text-sm">1.0.0</span>}
        />
        <SettingsRow label="Terms & Privacy Policy" onClick={() => {}} />
      </SettingsGroup>

      <div className="h-8" />
    </div>
  )
}
```

- [ ] **Step 2: Update settings server page to fetch user_settings**

Rewrite `src/app/(app)/settings/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsPage } from '@/components/SettingsPage'

export default async function SettingsRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch or create user settings
  let { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!settings) {
    const { data: newSettings } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id })
      .select()
      .single()
    settings = newSettings
  }

  const { data: connectedApps } = await supabase
    .from('connected_apps')
    .select('*')
    .eq('user_id', user.id)

  return (
    <SettingsPage
      settings={settings}
      connectedApps={connectedApps || []}
    />
  )
}
```

- [ ] **Step 3: Create paired API routes (export-data, delete-account)**

Create `src/app/api/export-data/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('care_profiles').select('*').eq('user_id', user.id).single()
  const profileId = profile?.id

  const [medications, appointments, doctors, labResults, claims, documents, notifications] = await Promise.all([
    profileId ? supabase.from('medications').select('*').eq('care_profile_id', profileId) : { data: [] },
    profileId ? supabase.from('appointments').select('*').eq('care_profile_id', profileId) : { data: [] },
    profileId ? supabase.from('doctors').select('*').eq('care_profile_id', profileId) : { data: [] },
    supabase.from('lab_results').select('*').eq('user_id', user.id),
    supabase.from('claims').select('*').eq('user_id', user.id),
    profileId ? supabase.from('documents').select('*').eq('care_profile_id', profileId) : { data: [] },
    supabase.from('notifications').select('*').eq('user_id', user.id),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    profile,
    medications: medications.data,
    appointments: appointments.data,
    doctors: doctors.data,
    lab_results: labResults.data,
    claims: claims.data,
    documents: documents.data,
    notifications: notifications.data,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="carecompanion-data.json"',
    },
  })
}
```

Create `src/app/api/delete-account/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Delete all user data (cascading from care_profiles handles medications, appointments, doctors, documents)
  await supabase.from('care_profiles').delete().eq('user_id', user.id)
  await supabase.from('lab_results').delete().eq('user_id', user.id)
  await supabase.from('claims').delete().eq('user_id', user.id)
  await supabase.from('notifications').delete().eq('user_id', user.id)
  await supabase.from('user_settings').delete().eq('user_id', user.id)
  await supabase.from('connected_apps').delete().eq('user_id', user.id)
  await supabase.from('messages').delete().eq('user_id', user.id)

  // Delete auth user using service-role admin client
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await adminSupabase.auth.admin.deleteUser(user.id)

  return NextResponse.json({ success: true })
}
```

**Note:** Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. This key should never be exposed to the client — only used in server-side API routes.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsPage.tsx src/app/(app)/settings/page.tsx src/app/api/export-data/route.ts src/app/api/delete-account/route.ts
git commit -m "feat: settings hub — grouped sections, notification toggles, export data, delete account"
```

---

### Task 10: Profile — Living Health Dashboard

**Files:**
- Modify: `src/components/ProfileEditor.tsx` (or create new `src/components/ProfileDashboard.tsx`)
- Modify: `src/app/(app)/profile/page.tsx`

Since ProfileEditor is 14KB with complex edit forms, create a new `ProfileDashboard.tsx` for the read-only dashboard view, and keep ProfileEditor for editing.

- [ ] **Step 1: Create ProfileDashboard component**

Create `src/components/ProfileDashboard.tsx`:

```tsx
'use client'

import { AnimatedNumber } from './AnimatedNumber'
import { parseLabValue } from '@/lib/lab-parsing'
import type { CareProfile, Doctor, LabResult } from '@/lib/types'

interface ProfileDashboardProps {
  profile: CareProfile
  doctors: Doctor[]
  labResults: LabResult[]
}

export function ProfileDashboard({ profile, doctors, labResults }: ProfileDashboardProps) {
  const initials = (profile.patient_name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Parse conditions and allergies from comma-separated text
  const conditions = profile.conditions
    ? profile.conditions.split(',').map((c) => c.trim()).filter(Boolean)
    : []
  const allergies = profile.allergies
    ? profile.allergies.split(',').map((a) => a.trim()).filter(Boolean)
    : []

  // Get latest vitals from lab results
  const getLatestLab = (testName: string) =>
    labResults.find((l) => l.test_name.toLowerCase().includes(testName.toLowerCase()))

  const vitals = [
    { label: 'Blood Pressure', lab: getLatestLab('Blood Pressure') },
    { label: 'A1C', lab: getLatestLab('A1C') },
    { label: 'LDL', lab: getLatestLab('LDL') },
  ]

  return (
    <div className="px-5 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 mx-auto mb-3 flex items-center justify-center text-white text-[22px] font-bold">
          {initials}
        </div>
        <div className="text-[#f1f5f9] text-xl font-bold">{profile.patient_name}</div>
        <div className="text-[#64748b] text-sm">
          {profile.patient_age ? `Age ${profile.patient_age}` : ''}
          {profile.patient_age && profile.relationship ? ' • ' : ''}
          {profile.relationship || ''}
        </div>
      </div>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="mb-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Conditions</div>
          <div className="flex flex-wrap gap-2">
            {conditions.map((condition) => (
              <span
                key={condition}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-[rgba(251,191,36,0.12)] border border-[rgba(251,191,36,0.2)] text-[#fbbf24]"
              >
                {condition}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Vitals Snapshot */}
      {labResults.length > 0 && (
        <div className="mb-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Vitals Snapshot</div>
          <div className="grid grid-cols-3 gap-2">
            {vitals.map((v) => {
              const parsed = v.lab ? parseLabValue(v.lab.value, v.lab.reference_range || '') : null
              return (
                <div
                  key={v.label}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center"
                >
                  <div className={`text-lg font-bold ${v.lab?.is_abnormal ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
                    {v.lab ? (
                      parsed?.isNumeric ? (
                        <AnimatedNumber value={parsed.numericValue!} decimals={v.label === 'A1C' ? 1 : 0} suffix={v.label === 'Blood Pressure' ? `/${v.lab.value.split('/')[1] || ''}` : ''} />
                      ) : (
                        v.lab.value
                      )
                    ) : (
                      <span className="text-[#64748b]">—</span>
                    )}
                  </div>
                  <div className="text-[#64748b] text-[10px] mt-0.5">{v.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Care Team */}
      {doctors.length > 0 && (
        <div className="mb-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Care Team</div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
            {doctors.map((doc) => {
              const docInitials = (doc.name || '?')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
              return (
                <div key={doc.id} className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-semibold">
                    {docInitials}
                  </div>
                  <div className="flex-1">
                    <div className="text-[#e2e8f0] text-sm font-semibold">{doc.name}</div>
                    <div className="text-[#64748b] text-xs">{doc.specialty}</div>
                  </div>
                  {doc.phone && (
                    <a
                      href={`tel:${doc.phone}`}
                      className="w-8 h-8 rounded-full bg-[rgba(34,211,238,0.15)] flex items-center justify-center"
                    >
                      <svg width="14" height="14" fill="none" stroke="#22d3ee" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                      </svg>
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Allergies */}
      {allergies.length > 0 && (
        <div className="mb-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Allergies</div>
          <div className="flex flex-wrap gap-2">
            {allergies.map((allergy) => (
              <span
                key={allergy}
                className="px-3 py-1 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-[#e2e8f0]"
              >
                {allergy}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Contact */}
      {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
        <div className="mb-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Emergency Contact</div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[#e2e8f0] text-sm font-semibold">{profile.emergency_contact_name || 'Unknown'}</div>
              {profile.emergency_contact_phone && (
                <div className="text-[#64748b] text-xs">{profile.emergency_contact_phone}</div>
              )}
            </div>
            {profile.emergency_contact_phone && (
              <a
                href={`tel:${profile.emergency_contact_phone}`}
                className="w-8 h-8 rounded-full bg-[rgba(34,211,238,0.15)] flex items-center justify-center"
              >
                <svg width="14" height="14" fill="none" stroke="#22d3ee" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile */}
      <a
        href="/profile/edit"
        className="block w-full text-center py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-sm font-semibold animate-press"
      >
        Edit Profile
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Update profile page to use ProfileDashboard**

Rewrite `src/app/(app)/profile/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileDashboard } from '@/components/ProfileDashboard'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const [{ data: doctors }, { data: labResults }] = await Promise.all([
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
    supabase.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: false }),
  ])

  return (
    <ProfileDashboard
      profile={profile}
      doctors={doctors || []}
      labResults={labResults || []}
    />
  )
}
```

- [ ] **Step 3: Create profile edit route**

Create `src/app/(app)/profile/edit/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileEditor } from '@/components/ProfileEditor'

export default async function ProfileEditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const [{ data: medications }, { data: doctors }, { data: appointments }] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id),
  ])

  return (
    <ProfileEditor
      profile={profile}
      medications={medications || []}
      doctors={doctors || []}
      appointments={appointments || []}
    />
  )
}
```

- [ ] **Step 4: Verify build and visual test**

Run: `npm run build && npm run dev`
Navigate to `http://localhost:3000/profile`
Verify: Dashboard shows vitals, conditions, care team, allergies. "Edit Profile" navigates to edit form.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfileDashboard.tsx src/app/(app)/profile/page.tsx src/app/(app)/profile/edit/page.tsx
git commit -m "feat: profile living health dashboard with vitals, care team, conditions, allergies"
```

---

### Task 11: Update Seed Demo with New Fields

**Files:**
- Modify: `src/app/api/seed-demo/route.ts`

- [ ] **Step 1: Add pharmacy_phone, emergency contact, doctors, and user_settings to seed data**

Update the seed endpoint to include the new fields so testing works:

Add to the medications insert — add `pharmacy_phone` to some medications:
```typescript
// Update medication inserts to include pharmacy_phone
{ care_profile_id: profile.id, name: 'Lisinopril', dose: '10mg', frequency: 'Once daily - Morning', prescribing_doctor: 'Dr. Patel', refill_date: dayISO(1), quantity_remaining: 3, pharmacy_phone: '555-0100' },
```

Add doctors seeding:
```typescript
await supabase.from('doctors').insert([
  { care_profile_id: profile.id, name: 'Dr. Patel', specialty: 'Cardiology', phone: '555-0101' },
  { care_profile_id: profile.id, name: 'Dr. Chen', specialty: 'Endocrinology', phone: '555-0102' },
  { care_profile_id: profile.id, name: 'Dr. Williams', specialty: 'Primary Care', phone: '555-0103' },
]);
```

Add emergency contact to care profile update:
```typescript
await supabase.from('care_profiles').update({
  emergency_contact_name: 'Jane Doe',
  emergency_contact_phone: '555-0199',
}).eq('id', profile.id);
```

Add user_settings:
```typescript
await supabase.from('user_settings').upsert({
  user_id: user.id,
  refill_reminders: true,
  appointment_reminders: true,
  lab_alerts: true,
  claim_updates: true,
  ai_personality: 'professional',
});
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/seed-demo/route.ts
git commit -m "feat: seed demo includes pharmacy phones, doctors, emergency contact, user settings"
```

---

### Task 12: Final Polish — Animations & Consistency

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Ensure all needed animation classes exist**

Verify these CSS classes/keyframes exist in `globals.css`. Add any that are missing:

```css
/* Slide up for new chat messages */
.animate-slide-up {
  animation: slide-up 0.3s ease-out both;
}

/* Expandable card transition helper */
.animate-expand {
  transition: max-height 300ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease;
}
```

- [ ] **Step 2: Verify full build**

Run: `npm run build`
Expected: Zero errors

- [ ] **Step 3: Full visual test**

Navigate through all pages:
1. `/dashboard` — expandable cards, empty state, quick-ask prompts
2. `/care` — expandable medications and appointments
3. `/chat` — gradient bubbles, glass input, starter prompts
4. `/scans` — 2x2 category grid, document list
5. `/settings` — grouped sections, toggles, password change
6. `/profile` — vitals, care team, conditions, allergies

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: final animation polish for consistency across all pages"
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAN | 8 proposals, 8 accepted, 0 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAN | 4 issues, 8 critical gaps (mutation error handling) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAN | score: 6/10 → 8/10, 6 decisions |

**UNRESOLVED:** 0 total across all reviews
**VERDICT:** CEO + ENG + DESIGN CLEARED — ready to implement.
