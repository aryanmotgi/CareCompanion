# Connect Accounts System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual setup wizard with a "Connect Your Accounts" onboarding flow where users sign into their health portals (Epic/MyChart, insurance, Medicare, VA, Walgreens, wearables) and CareCompanion auto-imports all their medical data — medications, labs, appointments, conditions, doctors, insurance, and claims.

**Architecture:** New onboarding page replaces the old setup wizard. Users see a grid of medical services they can connect via SMART on FHIR (Epic, Cerner, insurance payers, Medicare, VA) or REST OAuth (Walgreens, Fitbit, Withings, Google Calendar). Each connection saves tokens to `connected_apps` table, then a sync function pulls FHIR/REST data and populates the existing tables (medications, appointments, lab_results, etc.). A minimal care profile (patient name, relationship) is still collected first. The old manual setup wizard remains accessible as a fallback option.

**Tech Stack:** Next.js 14, Supabase, SMART on FHIR (OAuth 2.0), Epic FHIR R4, FHIR R4 payer APIs, CMS Blue Button 2.0, VA Lighthouse, Walgreens REST API, Fitbit REST API, existing Tailwind dark theme.

---

## Chunk 1: New Onboarding Flow & Connect Page

### Overview

Replace the current 5-step setup wizard redirect flow. After signup, users:
1. Enter basic info (who are you caring for?) — 1 screen
2. Land on "Connect Your Accounts" page — pick which services to connect
3. Each connection opens OAuth → returns → syncs data
4. User can skip connections and go to dashboard at any time

### File Structure

```
src/
  app/
    setup/
      page.tsx                          [MODIFY — simplified: basic info → connect accounts]
    (app)/
      connect/
        page.tsx                        [CREATE — main Connect Accounts hub, also accessible from sidebar]
  components/
    QuickSetup.tsx                      [CREATE — replaces SetupWizard: just name, age, relationship]
    ConnectAccounts.tsx                 [CREATE — grid of medical services to connect]
    ConnectionCard.tsx                  [CREATE — individual service card with connect/disconnect]
  lib/
    connections.ts                      [CREATE — registry of all connectable services with metadata]
    types.ts                            [MODIFY — add connection-related types]
  app/
    api/
      connections/
        status/route.ts                 [CREATE — returns current connection states for user]
```

---

### Task 1: Define the connections registry

**Files:**
- Create: `src/lib/connections.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add new types to types.ts**

Add after the existing `ConnectedApp` interface:

```typescript
export type ConnectionCategory = 'health_system' | 'insurance' | 'government' | 'pharmacy' | 'wearable' | 'other';

export type ConnectionAuthType = 'smart_on_fhir' | 'oauth2' | 'browser_session';

export interface ConnectionDefinition {
  id: string;
  name: string;
  description: string;
  category: ConnectionCategory;
  authType: ConnectionAuthType;
  icon: string; // SVG path
  accentColor: string; // tailwind color class
  accentBg: string; // tailwind bg class
  dataTypes: string[]; // what data this connection provides
  authUrl?: string; // OAuth authorization URL (null for browser_session)
  fhirBaseUrl?: string; // FHIR base URL if applicable
  available: boolean; // false = "coming soon"
}
```

- [ ] **Step 2: Create connections registry**

Create `src/lib/connections.ts` with ALL services:

```typescript
import type { ConnectionDefinition } from './types';

export const CONNECTIONS: ConnectionDefinition[] = [
  // === HEALTH SYSTEMS (SMART on FHIR) ===
  {
    id: 'epic_mychart',
    name: 'MyChart (Epic)',
    description: 'Sutter Health, Kaiser, Mayo Clinic, and 300+ hospitals',
    category: 'health_system',
    authType: 'smart_on_fhir',
    icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z',
    accentColor: 'text-blue-400',
    accentBg: 'bg-blue-500/15',
    dataTypes: ['medications', 'lab_results', 'appointments', 'conditions', 'allergies', 'doctors', 'immunizations'],
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    available: true,
  },
  {
    id: 'cerner',
    name: 'Oracle Health (Cerner)',
    description: 'Major hospital systems using Cerner/Oracle Health',
    category: 'health_system',
    authType: 'smart_on_fhir',
    icon: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0',
    accentColor: 'text-cyan-400',
    accentBg: 'bg-cyan-500/15',
    dataTypes: ['medications', 'lab_results', 'appointments', 'conditions', 'allergies', 'doctors'],
    available: true,
  },
  {
    id: 'athenahealth',
    name: 'athenahealth',
    description: 'Smaller practices and outpatient clinics',
    category: 'health_system',
    authType: 'smart_on_fhir',
    icon: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21',
    accentColor: 'text-teal-400',
    accentBg: 'bg-teal-500/15',
    dataTypes: ['medications', 'lab_results', 'appointments', 'conditions', 'allergies'],
    available: true,
  },

  // === INSURANCE (FHIR R4 Patient Access API) ===
  {
    id: 'aetna',
    name: 'Aetna',
    description: 'Claims, EOBs, coverage, deductibles',
    category: 'insurance',
    authType: 'smart_on_fhir',
    icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    dataTypes: ['claims', 'insurance', 'eobs'],
    available: true,
  },
  {
    id: 'unitedhealthcare',
    name: 'UnitedHealthcare',
    description: 'Claims, EOBs, coverage info',
    category: 'insurance',
    authType: 'smart_on_fhir',
    icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    dataTypes: ['claims', 'insurance', 'eobs'],
    available: true,
  },
  {
    id: 'cigna',
    name: 'Cigna',
    description: 'Claims, EOBs, coverage info',
    category: 'insurance',
    authType: 'smart_on_fhir',
    icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    dataTypes: ['claims', 'insurance', 'eobs'],
    available: true,
  },
  {
    id: 'humana',
    name: 'Humana',
    description: 'Claims, EOBs, coverage info',
    category: 'insurance',
    authType: 'smart_on_fhir',
    icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    dataTypes: ['claims', 'insurance', 'eobs'],
    available: true,
  },
  {
    id: 'bcbs',
    name: 'Blue Cross Blue Shield',
    description: 'Claims, EOBs — select your state plan',
    category: 'insurance',
    authType: 'smart_on_fhir',
    icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    dataTypes: ['claims', 'insurance', 'eobs'],
    available: true,
  },
  {
    id: 'anthem',
    name: 'Anthem',
    description: 'Claims, EOBs, coverage info',
    category: 'insurance',
    authType: 'smart_on_fhir',
    icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    dataTypes: ['claims', 'insurance', 'eobs'],
    available: true,
  },

  // === GOVERNMENT ===
  {
    id: 'medicare',
    name: 'Medicare (Blue Button)',
    description: 'Claims, procedures, medications for 65+ or disabled',
    category: 'government',
    authType: 'oauth2',
    icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
    accentColor: 'text-sky-400',
    accentBg: 'bg-sky-500/15',
    dataTypes: ['claims', 'medications', 'conditions', 'procedures'],
    authUrl: 'https://sandbox.bluebutton.cms.gov/v2/o/authorize/',
    available: true,
  },
  {
    id: 'va',
    name: 'VA Health',
    description: 'Full health record for veterans',
    category: 'government',
    authType: 'oauth2',
    icon: 'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z',
    accentColor: 'text-sky-400',
    accentBg: 'bg-sky-500/15',
    dataTypes: ['medications', 'lab_results', 'appointments', 'conditions', 'allergies', 'doctors', 'immunizations'],
    authUrl: 'https://sandbox-api.va.gov/oauth2/health/v1/authorization',
    available: true,
  },

  // === PHARMACY ===
  {
    id: 'walgreens',
    name: 'Walgreens',
    description: 'Prescription refills and history',
    category: 'pharmacy',
    authType: 'oauth2',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0',
    accentColor: 'text-red-400',
    accentBg: 'bg-red-500/15',
    dataTypes: ['medications', 'refills'],
    available: true,
  },
  {
    id: 'cvs',
    name: 'CVS Pharmacy',
    description: 'Prescription history and refills',
    category: 'pharmacy',
    authType: 'browser_session',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0',
    accentColor: 'text-red-400',
    accentBg: 'bg-red-500/15',
    dataTypes: ['medications', 'refills'],
    available: false, // future: browser-use
  },
  {
    id: 'walmart_pharmacy',
    name: 'Walmart Pharmacy',
    description: 'Prescription history and refills',
    category: 'pharmacy',
    authType: 'browser_session',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0',
    accentColor: 'text-red-400',
    accentBg: 'bg-red-500/15',
    dataTypes: ['medications', 'refills'],
    available: false, // future: browser-use
  },

  // === WEARABLES ===
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Heart rate, sleep, activity, SpO2',
    category: 'wearable',
    authType: 'oauth2',
    icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 8v4l3 3',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    dataTypes: ['heart_rate', 'sleep', 'activity', 'spo2'],
    available: true,
  },
  {
    id: 'withings',
    name: 'Withings',
    description: 'Blood pressure, weight, sleep',
    category: 'wearable',
    authType: 'oauth2',
    icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 8v4l3 3',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    dataTypes: ['blood_pressure', 'weight', 'sleep'],
    available: true,
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    description: 'Sleep, readiness, activity scores',
    category: 'wearable',
    authType: 'oauth2',
    icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 8v4l3 3',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    dataTypes: ['sleep', 'activity', 'readiness'],
    available: true,
  },

  // === OTHER ===
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync medical appointments from your calendar',
    category: 'other',
    authType: 'oauth2',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
    dataTypes: ['appointments'],
    available: true,
  },
  {
    id: 'goodrx',
    name: 'GoodRx',
    description: 'Medication price comparisons',
    category: 'other',
    authType: 'oauth2',
    icon: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
    dataTypes: ['medication_prices'],
    available: false, // requires approval
  },
];

export const CONNECTION_CATEGORIES: Record<ConnectionCategory, { label: string; description: string }> = {
  health_system: { label: 'Health Systems', description: 'Your hospital patient portals' },
  insurance: { label: 'Insurance', description: 'Claims, EOBs, and coverage' },
  government: { label: 'Government Programs', description: 'Medicare, VA, and more' },
  pharmacy: { label: 'Pharmacies', description: 'Prescription history and refills' },
  wearable: { label: 'Wearables & Fitness', description: 'Health tracking devices' },
  other: { label: 'Other Services', description: 'Calendar, pricing, and more' },
};

// Helper to get connections by category
export function getConnectionsByCategory() {
  const grouped: Record<string, ConnectionDefinition[]> = {};
  for (const conn of CONNECTIONS) {
    if (!grouped[conn.category]) grouped[conn.category] = [];
    grouped[conn.category].push(conn);
  }
  return grouped;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/connections.ts src/lib/types.ts
git commit -m "feat: add connections registry with all medical service definitions"
```

---

### Task 2: Build the QuickSetup component

This replaces the 5-step wizard for the "connect accounts" path. Just collects: patient name, age, relationship. One screen.

**Files:**
- Create: `src/components/QuickSetup.tsx`

- [ ] **Step 1: Create QuickSetup component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';

interface QuickSetupProps {
  existingProfileId?: string | null;
  existingName?: string;
  existingAge?: string;
  existingRelationship?: string;
}

export function QuickSetup({ existingProfileId, existingName = '', existingAge = '', existingRelationship = '' }: QuickSetupProps) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(existingName);
  const [age, setAge] = useState(existingAge);
  const [relationship, setRelationship] = useState(existingRelationship);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (existingProfileId) {
        await supabase.from('care_profiles').update({
          patient_name: name.trim(),
          patient_age: age ? parseInt(age) : null,
          relationship: relationship || null,
        }).eq('id', existingProfileId);
      } else {
        const { error: insertError } = await supabase.from('care_profiles').insert({
          user_id: user.id,
          patient_name: name.trim(),
          patient_age: age ? parseInt(age) : null,
          relationship: relationship || null,
        });
        if (insertError) throw insertError;
      }

      router.push('/connect');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8">
      {error && (
        <div className="mb-6 p-3 bg-red-500/10 text-red-400 rounded-xl text-sm">{error}</div>
      )}

      <div className="space-y-5">
        <h2 className="font-display text-xl font-semibold text-white mb-4">
          Who are you caring for?
        </h2>
        <FormField
          label="Their name"
          value={name}
          onChange={setName}
          placeholder="e.g., Mom, Dad, John"
          required
        />
        <FormField
          label="Their age"
          type="number"
          value={age}
          onChange={setAge}
          placeholder="e.g., 75"
        />
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Your relationship to them
          </label>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">Select...</option>
            <option value="self">Myself</option>
            <option value="parent">Parent</option>
            <option value="spouse">Spouse / Partner</option>
            <option value="child">Child</option>
            <option value="sibling">Sibling</option>
            <option value="grandparent">Grandparent</option>
            <option value="friend">Friend</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Skip for now
        </button>
        <Button onClick={handleSubmit} loading={loading}>
          Continue
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/QuickSetup.tsx
git commit -m "feat: add QuickSetup component for simplified onboarding"
```

---

### Task 3: Build the ConnectAccounts component

**Files:**
- Create: `src/components/ConnectAccounts.tsx`
- Create: `src/components/ConnectionCard.tsx`

- [ ] **Step 1: Create ConnectionCard component**

```tsx
'use client';

import type { ConnectionDefinition, ConnectedApp } from '@/lib/types';

interface ConnectionCardProps {
  connection: ConnectionDefinition;
  connectedApp?: ConnectedApp | null;
  onConnect: (connectionId: string) => void;
  onDisconnect: (connectionId: string) => void;
}

export function ConnectionCard({ connection, connectedApp, onConnect, onDisconnect }: ConnectionCardProps) {
  const isConnected = !!connectedApp;
  const lastSynced = connectedApp?.last_synced
    ? new Date(connectedApp.last_synced).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className={`bg-[var(--bg-card)] rounded-2xl border ${isConnected ? 'border-emerald-500/30' : 'border-[var(--border)]'} p-5 transition-all`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${connection.accentBg} flex items-center justify-center flex-shrink-0`}>
            <svg className={`w-5 h-5 ${connection.accentColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={connection.icon} />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-white text-sm">{connection.name}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{connection.description}</p>
            {isConnected && lastSynced && (
              <p className="text-xs text-emerald-400 mt-1">Last synced: {lastSynced}</p>
            )}
          </div>
        </div>

        {connection.available ? (
          isConnected ? (
            <button
              onClick={() => onDisconnect(connection.id)}
              className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors flex-shrink-0 ml-3"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => onConnect(connection.id)}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ml-3"
            >
              Connect
            </button>
          )
        ) : (
          <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-1 rounded-md flex-shrink-0 ml-3">
            Coming soon
          </span>
        )}
      </div>

      {/* Data types pills */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {connection.dataTypes.map((dt) => (
          <span key={dt} className={`text-[10px] px-2 py-0.5 rounded-full ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
            {dt.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ConnectAccounts component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ConnectionCard } from '@/components/ConnectionCard';
import { CONNECTIONS, CONNECTION_CATEGORIES, getConnectionsByCategory } from '@/lib/connections';
import type { ConnectedApp, ConnectionCategory } from '@/lib/types';

interface ConnectAccountsProps {
  connectedApps: ConnectedApp[];
  showSkip?: boolean; // true during onboarding, false on /connect page
}

export function ConnectAccounts({ connectedApps, showSkip = false }: ConnectAccountsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [apps, setApps] = useState(connectedApps);
  const [syncing, setSyncing] = useState<string | null>(null);

  const grouped = getConnectionsByCategory();
  const categoryOrder: ConnectionCategory[] = ['health_system', 'insurance', 'government', 'pharmacy', 'wearable', 'other'];

  const handleConnect = async (connectionId: string) => {
    const connection = CONNECTIONS.find((c) => c.id === connectionId);
    if (!connection) return;

    // For SMART on FHIR and OAuth2, redirect to auth URL
    // The auth callback will save the token and redirect back
    if (connection.authType === 'smart_on_fhir' || connection.authType === 'oauth2') {
      window.location.href = `/api/connections/${connectionId}/authorize`;
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    const app = apps.find((a) => a.source === connectionId);
    if (!app) return;

    const { error } = await supabase.from('connected_apps').delete().eq('id', app.id);
    if (!error) {
      setApps((prev) => prev.filter((a) => a.id !== app.id));
    }
  };

  const handleSyncAll = async () => {
    setSyncing('all');
    try {
      await fetch('/api/sync/all', { method: 'POST' });
      window.location.reload();
    } catch {
      // silent fail
    } finally {
      setSyncing(null);
    }
  };

  const connectedCount = apps.length;

  return (
    <div className="space-y-8">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Connect Your Accounts</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {connectedCount === 0
              ? 'Connect your health services to auto-import your medical data'
              : `${connectedCount} service${connectedCount !== 1 ? 's' : ''} connected`}
          </p>
        </div>
        {connectedCount > 0 && (
          <Button
            variant="secondary"
            onClick={handleSyncAll}
            loading={syncing === 'all'}
            className="!py-2 !px-4 !min-h-0 text-sm"
          >
            Sync All
          </Button>
        )}
      </div>

      {/* Categories */}
      {categoryOrder.map((catKey) => {
        const connections = grouped[catKey];
        if (!connections || connections.length === 0) return null;
        const catMeta = CONNECTION_CATEGORIES[catKey];

        return (
          <div key={catKey}>
            <div className="mb-3">
              <h3 className="text-[11px] font-semibold tracking-widest text-[var(--text-muted)] uppercase">{catMeta.label}</h3>
              <p className="text-xs text-[var(--text-muted)]">{catMeta.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {connections.map((conn) => (
                <ConnectionCard
                  key={conn.id}
                  connection={conn}
                  connectedApp={apps.find((a) => a.source === conn.id) || null}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
        {showSkip ? (
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Skip — I&apos;ll enter data manually
          </button>
        ) : (
          <div />
        )}
        {showSkip && connectedCount > 0 && (
          <Button onClick={() => router.push('/dashboard')}>
            Continue to Dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ConnectionCard.tsx src/components/ConnectAccounts.tsx
git commit -m "feat: add ConnectAccounts and ConnectionCard components"
```

---

### Task 4: Update setup page and add connect route

**Files:**
- Modify: `src/app/setup/page.tsx`
- Create: `src/app/(app)/connect/page.tsx`
- Modify: `src/components/AppShell.tsx` — add Connect nav item
- Modify: `src/middleware.ts` — add /connect to matcher
- Modify: `src/app/auth/callback/route.ts` — redirect to /setup (which now leads to /connect)

- [ ] **Step 1: Rewrite setup page**

Replace `src/app/setup/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QuickSetup } from '@/components/QuickSetup';

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // If profile already exists, go to connect or dashboard
  if (profile?.patient_name) {
    redirect('/connect');
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl font-bold text-white">
            Welcome to CareCompanion
          </h1>
          <p className="text-[var(--text-secondary)] mt-2">
            Let&apos;s get started — just one quick question
          </p>
        </div>
        <QuickSetup
          existingProfileId={profile?.id || null}
          existingName={profile?.patient_name || ''}
          existingAge={profile?.patient_age?.toString() || ''}
          existingRelationship={profile?.relationship || ''}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create connect page**

Create `src/app/(app)/connect/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ConnectAccounts } from '@/components/ConnectAccounts';

export default async function ConnectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: connectedApps } = await supabase
    .from('connected_apps')
    .select('*')
    .eq('user_id', user.id);

  // Show skip button if coming from onboarding (no connected apps yet)
  const isOnboarding = !connectedApps || connectedApps.length === 0;

  return <ConnectAccounts connectedApps={connectedApps || []} showSkip={isOnboarding} />;
}
```

- [ ] **Step 3: Add Connect to sidebar nav in AppShell.tsx**

Add after the Scan Documents nav item:

```typescript
{ href: '/connect', label: 'Connect Apps', icon: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244' },
```

- [ ] **Step 4: Add /connect to middleware matcher**

Update matcher to include `/connect`.

- [ ] **Step 5: Commit**

```bash
git add src/app/setup/page.tsx src/app/\(app\)/connect/page.tsx src/components/AppShell.tsx src/middleware.ts
git commit -m "feat: new onboarding flow — quick setup then connect accounts"
```

---

## Chunk 2: SMART on FHIR OAuth Flow (Epic)

### Overview

Implement the SMART on FHIR authorization flow that works for Epic MyChart, Cerner, athenahealth, and insurance payer FHIR endpoints. This is a standardized OAuth 2.0 flow with FHIR-specific scopes.

### File Structure

```
src/
  app/
    api/
      connections/
        [connectionId]/
          authorize/route.ts            [CREATE — initiates OAuth redirect]
          callback/route.ts             [CREATE — handles OAuth callback, saves tokens]
  lib/
    fhir-auth.ts                        [CREATE — SMART on FHIR auth helpers]
    fhir-sync.ts                        [CREATE — FHIR data fetching and parsing into our DB]
```

---

### Task 5: SMART on FHIR auth helpers

**Files:**
- Create: `src/lib/fhir-auth.ts`

- [ ] **Step 1: Create FHIR auth utilities**

```typescript
import { CONNECTIONS } from './connections';

// SMART on FHIR scopes for patient-facing apps
const PATIENT_SCOPES = [
  'patient/Patient.read',
  'patient/MedicationRequest.read',
  'patient/Condition.read',
  'patient/AllergyIntolerance.read',
  'patient/Observation.read',
  'patient/Appointment.read',
  'patient/Practitioner.read',
  'patient/Immunization.read',
  'patient/ExplanationOfBenefit.read',
  'patient/Coverage.read',
  'launch/patient',
  'openid',
  'fhirUser',
  'offline_access',
].join(' ');

// FHIR endpoint metadata — in production these would be discovered via .well-known/smart-configuration
// For now, hardcode known endpoints
const FHIR_ENDPOINTS: Record<string, { authorizeUrl: string; tokenUrl: string; fhirBaseUrl: string }> = {
  epic_mychart: {
    authorizeUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
  },
  cerner: {
    authorizeUrl: 'https://authorization.cerner.com/tenants/{tenantId}/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    tokenUrl: 'https://authorization.cerner.com/tenants/{tenantId}/protocols/oauth2/profiles/smart-v1/token',
    fhirBaseUrl: 'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
  },
  // Insurance payers use the same SMART on FHIR pattern
  aetna: {
    authorizeUrl: 'https://vteapif1.aetna.com/fhirdemo/v1/oauth2/authorize',
    tokenUrl: 'https://vteapif1.aetna.com/fhirdemo/v1/oauth2/token',
    fhirBaseUrl: 'https://vteapif1.aetna.com/fhirdemo/v1/patientaccess',
  },
  medicare: {
    authorizeUrl: 'https://sandbox.bluebutton.cms.gov/v2/o/authorize/',
    tokenUrl: 'https://sandbox.bluebutton.cms.gov/v2/o/token/',
    fhirBaseUrl: 'https://sandbox.bluebutton.cms.gov/v2/fhir',
  },
  va: {
    authorizeUrl: 'https://sandbox-api.va.gov/oauth2/health/v1/authorization',
    tokenUrl: 'https://sandbox-api.va.gov/oauth2/health/v1/token',
    fhirBaseUrl: 'https://sandbox-api.va.gov/services/fhir/v0/r4',
  },
};

export function getClientCredentials(connectionId: string): { clientId: string; clientSecret: string } {
  // Each connection has its own registered OAuth client
  // These are stored as environment variables
  const prefix = connectionId.toUpperCase().replace(/-/g, '_');
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`] || process.env.FHIR_CLIENT_ID || '',
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] || process.env.FHIR_CLIENT_SECRET || '',
  };
}

export function getFhirEndpoints(connectionId: string) {
  return FHIR_ENDPOINTS[connectionId] || null;
}

export function buildAuthorizeUrl(connectionId: string, redirectUri: string, state: string): string | null {
  const endpoints = getFhirEndpoints(connectionId);
  if (!endpoints) return null;

  const { clientId } = getClientCredentials(connectionId);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: PATIENT_SCOPES,
    state: state,
    aud: endpoints.fhirBaseUrl,
  });

  return `${endpoints.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCodeForTokens(connectionId: string, code: string, redirectUri: string) {
  const endpoints = getFhirEndpoints(connectionId);
  if (!endpoints) throw new Error(`No FHIR endpoints for ${connectionId}`);

  const { clientId, clientSecret } = getClientCredentials(connectionId);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(endpoints.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    patient?: string; // FHIR patient ID
    scope?: string;
  }>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fhir-auth.ts
git commit -m "feat: SMART on FHIR auth helpers for Epic, Cerner, insurance payers"
```

---

### Task 6: OAuth authorize and callback routes

**Files:**
- Create: `src/app/api/connections/[connectionId]/authorize/route.ts`
- Create: `src/app/api/connections/[connectionId]/callback/route.ts`

- [ ] **Step 1: Create authorize route**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAuthorizeUrl } from '@/lib/fhir-auth';
import { CONNECTIONS } from '@/lib/connections';

export async function GET(
  _req: Request,
  { params }: { params: { connectionId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { connectionId } = params;
  const connection = CONNECTIONS.find((c) => c.id === connectionId);
  if (!connection || !connection.available) {
    return new Response('Connection not found', { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/connections/${connectionId}/callback`;

  // State encodes the user ID for verification in callback
  const state = Buffer.from(JSON.stringify({ userId: user.id, connectionId })).toString('base64url');

  const authorizeUrl = buildAuthorizeUrl(connectionId, redirectUri, state);

  if (!authorizeUrl) {
    // For non-FHIR OAuth (Walgreens, Fitbit, etc.), use connection-specific logic
    // TODO: implement per-provider OAuth
    return NextResponse.redirect(`${baseUrl}/connect?error=not_implemented`);
  }

  return NextResponse.redirect(authorizeUrl);
}
```

- [ ] **Step 2: Create callback route**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens } from '@/lib/fhir-auth';

export async function GET(
  req: Request,
  { params }: { params: { connectionId: string } }
) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/connect?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connect?error=missing_code`);
  }

  // Decode state
  let stateData: { userId: string; connectionId: string };
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return NextResponse.redirect(`${baseUrl}/connect?error=invalid_state`);
  }

  const { connectionId } = params;

  if (stateData.connectionId !== connectionId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=state_mismatch`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== stateData.userId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=auth_mismatch`);
  }

  try {
    const redirectUri = `${baseUrl}/api/connections/${connectionId}/callback`;
    const tokens = await exchangeCodeForTokens(connectionId, code, redirectUri);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Upsert connected app
    await supabase.from('connected_apps').upsert(
      {
        user_id: user.id,
        source: connectionId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt,
        metadata: { patient_id: tokens.patient || null, scope: tokens.scope || null },
      },
      { onConflict: 'user_id,source' }
    );

    // Trigger initial sync
    await fetch(`${baseUrl}/api/sync/${connectionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {}); // non-blocking

    return NextResponse.redirect(`${baseUrl}/connect?connected=${connectionId}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(`${baseUrl}/connect?error=token_exchange_failed`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/connections/
git commit -m "feat: generic OAuth authorize/callback routes for all FHIR connections"
```

---

### Task 7: FHIR data sync service

**Files:**
- Create: `src/lib/fhir-sync.ts`
- Create: `src/app/api/sync/[connectionId]/route.ts`

- [ ] **Step 1: Create FHIR sync library**

This is the core engine that fetches FHIR resources and maps them into our Supabase tables.

```typescript
import { getFhirEndpoints } from './fhir-auth';
import { createAdminClient } from './supabase/admin';

interface FhirResource {
  resourceType: string;
  [key: string]: unknown;
}

interface FhirBundle {
  resourceType: 'Bundle';
  entry?: Array<{ resource: FhirResource }>;
  link?: Array<{ relation: string; url: string }>;
}

async function fhirFetch(baseUrl: string, path: string, accessToken: string): Promise<FhirBundle> {
  const url = path.startsWith('http') ? path : `${baseUrl}/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/fhir+json' },
  });
  if (!res.ok) throw new Error(`FHIR fetch failed: ${res.status}`);
  return res.json();
}

// Fetch all pages of a FHIR search
async function fhirSearchAll(baseUrl: string, resourceType: string, params: string, accessToken: string): Promise<FhirResource[]> {
  const resources: FhirResource[] = [];
  let url = `${resourceType}?${params}&_count=100`;

  while (url) {
    const bundle = await fhirFetch(baseUrl, url, accessToken);
    if (bundle.entry) {
      resources.push(...bundle.entry.map((e) => e.resource));
    }
    const nextLink = bundle.link?.find((l) => l.relation === 'next');
    url = nextLink?.url || '';
  }

  return resources;
}

export async function syncFhirData(userId: string, connectionId: string, accessToken: string, patientId: string) {
  const endpoints = getFhirEndpoints(connectionId);
  if (!endpoints) throw new Error(`No FHIR endpoints for ${connectionId}`);

  const admin = createAdminClient();
  const baseUrl = endpoints.fhirBaseUrl;

  // Get care profile
  const { data: profile } = await admin
    .from('care_profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!profile) throw new Error('No care profile found');

  const results: Record<string, number> = {};

  // === MEDICATIONS (MedicationRequest) ===
  try {
    const meds = await fhirSearchAll(baseUrl, 'MedicationRequest', `patient=${patientId}&status=active`, accessToken);
    const rows = meds.map((m: Record<string, unknown>) => {
      const med = m as { medicationCodeableConcept?: { text?: string }; dosageInstruction?: Array<{ text?: string; timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } } }> };
      return {
        care_profile_id: profile.id,
        name: med.medicationCodeableConcept?.text || 'Unknown medication',
        dose: med.dosageInstruction?.[0]?.text || null,
        frequency: med.dosageInstruction?.[0]?.timing?.repeat
          ? `${med.dosageInstruction[0].timing.repeat.frequency || 1}x per ${med.dosageInstruction[0].timing.repeat.period || 1} ${med.dosageInstruction[0].timing.repeat.periodUnit || 'd'}`
          : null,
        notes: `Synced from ${connectionId}`,
      };
    });
    if (rows.length > 0) {
      // Delete previously synced meds from this source, then insert fresh
      await admin.from('medications').delete().eq('care_profile_id', profile.id).like('notes', `%Synced from ${connectionId}%`);
      await admin.from('medications').insert(rows);
      results.medications = rows.length;
    }
  } catch (e) { console.error('Sync medications error:', e); }

  // === CONDITIONS ===
  try {
    const conditions = await fhirSearchAll(baseUrl, 'Condition', `patient=${patientId}&clinical-status=active`, accessToken);
    const conditionNames = conditions
      .map((c: Record<string, unknown>) => {
        const cond = c as { code?: { text?: string; coding?: Array<{ display?: string }> } };
        return cond.code?.text || cond.code?.coding?.[0]?.display || null;
      })
      .filter(Boolean) as string[];

    if (conditionNames.length > 0) {
      const { data: currentProfile } = await admin.from('care_profiles').select('conditions').eq('id', profile.id).single();
      const existing = currentProfile?.conditions || '';
      const newOnes = conditionNames.filter((c) => !existing.toLowerCase().includes(c.toLowerCase()));
      if (newOnes.length > 0) {
        const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
        await admin.from('care_profiles').update({ conditions: updated }).eq('id', profile.id);
        results.conditions = newOnes.length;
      }
    }
  } catch (e) { console.error('Sync conditions error:', e); }

  // === ALLERGIES ===
  try {
    const allergies = await fhirSearchAll(baseUrl, 'AllergyIntolerance', `patient=${patientId}`, accessToken);
    const allergyNames = allergies
      .map((a: Record<string, unknown>) => {
        const allergy = a as { code?: { text?: string; coding?: Array<{ display?: string }> } };
        return allergy.code?.text || allergy.code?.coding?.[0]?.display || null;
      })
      .filter(Boolean) as string[];

    if (allergyNames.length > 0) {
      const { data: currentProfile } = await admin.from('care_profiles').select('allergies').eq('id', profile.id).single();
      const existing = currentProfile?.allergies || '';
      const newOnes = allergyNames.filter((a) => !existing.toLowerCase().includes(a.toLowerCase()));
      if (newOnes.length > 0) {
        const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
        await admin.from('care_profiles').update({ allergies: updated }).eq('id', profile.id);
        results.allergies = newOnes.length;
      }
    }
  } catch (e) { console.error('Sync allergies error:', e); }

  // === LAB RESULTS (Observation) ===
  try {
    const labs = await fhirSearchAll(baseUrl, 'Observation', `patient=${patientId}&category=laboratory&_sort=-date&_count=50`, accessToken);
    const rows = labs.map((o: Record<string, unknown>) => {
      const obs = o as {
        code?: { text?: string; coding?: Array<{ display?: string }> };
        valueQuantity?: { value?: number; unit?: string };
        referenceRange?: Array<{ text?: string }>;
        interpretation?: Array<{ coding?: Array<{ code?: string }> }>;
        effectiveDateTime?: string;
      };
      const isAbnormal = obs.interpretation?.[0]?.coding?.[0]?.code === 'A' ||
                          obs.interpretation?.[0]?.coding?.[0]?.code === 'H' ||
                          obs.interpretation?.[0]?.coding?.[0]?.code === 'L';
      return {
        user_id: userId,
        test_name: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown test',
        value: obs.valueQuantity?.value?.toString() || null,
        unit: obs.valueQuantity?.unit || null,
        reference_range: obs.referenceRange?.[0]?.text || null,
        is_abnormal: isAbnormal,
        date_taken: obs.effectiveDateTime || null,
        source: connectionId,
      };
    });
    if (rows.length > 0) {
      await admin.from('lab_results').delete().eq('user_id', userId).eq('source', connectionId);
      await admin.from('lab_results').insert(rows);
      results.lab_results = rows.length;
    }
  } catch (e) { console.error('Sync labs error:', e); }

  // === APPOINTMENTS ===
  try {
    const appts = await fhirSearchAll(baseUrl, 'Appointment', `patient=${patientId}&date=ge${new Date().toISOString().split('T')[0]}&status=booked`, accessToken);
    const rows = appts.map((a: Record<string, unknown>) => {
      const appt = a as {
        participant?: Array<{ actor?: { display?: string } }>;
        start?: string;
        description?: string;
        serviceType?: Array<{ text?: string }>;
      };
      const doctorParticipant = appt.participant?.find((p) => p.actor?.display);
      return {
        care_profile_id: profile.id,
        doctor_name: doctorParticipant?.actor?.display || null,
        date_time: appt.start || null,
        purpose: appt.description || appt.serviceType?.[0]?.text || null,
      };
    });
    if (rows.length > 0) {
      // Only add appointments that don't already exist (by doctor + date)
      for (const row of rows) {
        if (row.date_time) {
          const { data: existing } = await admin.from('appointments')
            .select('id')
            .eq('care_profile_id', profile.id)
            .eq('date_time', row.date_time)
            .maybeSingle();
          if (!existing) {
            await admin.from('appointments').insert(row);
            results.appointments = (results.appointments || 0) + 1;
          }
        }
      }
    }
  } catch (e) { console.error('Sync appointments error:', e); }

  // === CLAIMS / EOBs (for insurance connections) ===
  try {
    const eobs = await fhirSearchAll(baseUrl, 'ExplanationOfBenefit', `patient=${patientId}&_sort=-created&_count=20`, accessToken);
    const rows = eobs.map((e: Record<string, unknown>) => {
      const eob = e as {
        billablePeriod?: { start?: string };
        provider?: { display?: string };
        total?: Array<{ category?: { coding?: Array<{ code?: string }> }; amount?: { value?: number } }>;
        outcome?: string;
      };
      const billed = eob.total?.find((t) => t.category?.coding?.[0]?.code === 'submitted');
      const paid = eob.total?.find((t) => t.category?.coding?.[0]?.code === 'benefit');
      const patientCost = eob.total?.find((t) => t.category?.coding?.[0]?.code === 'deductible');
      return {
        user_id: userId,
        service_date: eob.billablePeriod?.start || null,
        provider_name: eob.provider?.display || null,
        billed_amount: billed?.amount?.value || null,
        paid_amount: paid?.amount?.value || null,
        patient_responsibility: patientCost?.amount?.value || null,
        status: eob.outcome === 'complete' ? 'paid' : eob.outcome === 'error' ? 'denied' : 'pending',
      };
    });
    if (rows.length > 0) {
      await admin.from('claims').delete().eq('user_id', userId);
      await admin.from('claims').insert(rows);
      results.claims = rows.length;
    }
  } catch (e) { console.error('Sync EOBs error:', e); }

  // Update last_synced timestamp
  await admin.from('connected_apps')
    .update({ last_synced: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('source', connectionId);

  return results;
}
```

- [ ] **Step 2: Create generic sync route**

Create `src/app/api/sync/[connectionId]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncFhirData } from '@/lib/fhir-sync';

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: { connectionId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { connectionId } = params;
  const admin = createAdminClient();

  // Get connected app credentials
  const { data: app } = await admin
    .from('connected_apps')
    .select('*')
    .eq('user_id', user.id)
    .eq('source', connectionId)
    .single();

  if (!app || !app.access_token) {
    return Response.json({ error: 'Not connected' }, { status: 400 });
  }

  const patientId = (app.metadata as Record<string, string>)?.patient_id || 'me';

  try {
    const results = await syncFhirData(user.id, connectionId, app.access_token, patientId);
    return Response.json({ success: true, synced: results });
  } catch (err) {
    console.error(`Sync error for ${connectionId}:`, err);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/fhir-sync.ts src/app/api/sync/\[connectionId\]/route.ts
git commit -m "feat: FHIR data sync engine — medications, labs, conditions, appointments, claims"
```

---

## Chunk 3: Cleanup & Integration

### Task 8: Update the (app) layout to handle profile-less state

Currently `(app)/layout.tsx` redirects to `/setup` if no profile exists. Since `/connect` is inside `(app)`, we need to handle the case where a profile exists but has no data yet (just came from QuickSetup).

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Update layout to be more lenient**

The layout should not redirect to `/setup` if the user is on `/connect`. Update the redirect logic:

```typescript
// In the layout, after checking profile:
if (!profile && !pathname.startsWith('/connect')) redirect('/setup');
```

This requires making the layout aware of the current path. Since it's a server component, we need `headers()` to check the URL.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "fix: allow connect page to render without complete profile"
```

---

### Task 9: Update sync/all to use new dynamic sync

**Files:**
- Modify: `src/app/api/sync/all/route.ts`

- [ ] **Step 1: Rewrite sync/all to iterate connected apps**

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { syncFhirData } from '@/lib/fhir-sync';

export const maxDuration = 300;

export async function GET() {
  // Cron job: sync all connected apps for all users
  const admin = createAdminClient();

  const { data: apps } = await admin
    .from('connected_apps')
    .select('*')
    .not('access_token', 'is', null);

  if (!apps || apps.length === 0) {
    return Response.json({ message: 'No apps to sync' });
  }

  const results: Array<{ userId: string; source: string; status: string; data?: Record<string, number> }> = [];

  for (const app of apps) {
    try {
      const patientId = (app.metadata as Record<string, string>)?.patient_id || 'me';
      const synced = await syncFhirData(app.user_id, app.source, app.access_token, patientId);
      results.push({ userId: app.user_id, source: app.source, status: 'ok', data: synced });
    } catch (err) {
      console.error(`Sync failed for ${app.source} (user ${app.user_id}):`, err);
      results.push({ userId: app.user_id, source: app.source, status: 'error' });
    }
  }

  return Response.json({ synced: results.length, results });
}

// Also support POST for manual trigger
export async function POST() {
  return GET();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/sync/all/route.ts
git commit -m "feat: rewrite sync/all to use generic FHIR sync for all connected apps"
```

---

### Task 10: Add unique constraint for connected_apps

We need a unique constraint on `(user_id, source)` for the upsert in the callback to work.

**Files:**
- Create: `supabase/migrations/connected_apps_unique.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Add unique constraint for upsert support
ALTER TABLE connected_apps ADD CONSTRAINT connected_apps_user_source_unique UNIQUE (user_id, source);
```

- [ ] **Step 2: Document this for the user**

The user needs to run this SQL in Supabase dashboard before testing.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/connected_apps_unique.sql
git commit -m "feat: add unique constraint on connected_apps(user_id, source)"
```

---

### Task 11: Keep the old SetupWizard as fallback

The old 5-step wizard should still be accessible for users who prefer manual entry.

**Files:**
- Create: `src/app/(app)/manual-setup/page.tsx` — wraps the existing SetupWizard

- [ ] **Step 1: Create manual setup route**

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SetupWizard } from '@/components/SetupWizard';
import type { Medication, Doctor, Appointment } from '@/lib/types';

export default async function ManualSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/setup');

  const [{ data: meds }, { data: docs }, { data: appts }] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <SetupWizard
        initialStep={2}
        existingProfile={profile}
        existingMedications={(meds || []) as Medication[]}
        existingDoctors={(docs || []) as Doctor[]}
        existingAppointments={(appts || []) as Appointment[]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add link to manual setup from Connect page**

In the `ConnectAccounts` component footer, the "Skip — I'll enter data manually" link should go to `/manual-setup`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/manual-setup/page.tsx
git commit -m "feat: keep manual setup wizard accessible at /manual-setup"
```

---

## Summary of New User Flow

```
1. User signs up → /login
2. Auth callback → /setup (new simplified page)
3. QuickSetup: "Who are you caring for?" → name, age, relationship → Continue
4. → /connect (Connect Your Accounts page)
5. User picks services (MyChart, Aetna, Fitbit, etc.)
6. Each one: click Connect → OAuth login on provider's site → callback saves tokens → sync runs
7. Data auto-populates: medications, labs, appointments, conditions, allergies, claims
8. User clicks "Continue to Dashboard" → /dashboard is fully loaded with real data
9. From sidebar, user can always go back to /connect to add more services
10. Cron job syncs all connected apps every 15 minutes
11. Manual entry still available at /manual-setup
12. Photo scanner still available at /scans
```

## Environment Variables Needed

```
# Epic FHIR (register at open.epic.com)
EPIC_MYCHART_CLIENT_ID=
EPIC_MYCHART_CLIENT_SECRET=

# Medicare Blue Button (register at bluebutton.cms.gov)
MEDICARE_CLIENT_ID=
MEDICARE_CLIENT_SECRET=

# VA (register at developer.va.gov)
VA_CLIENT_ID=
VA_CLIENT_SECRET=

# Insurance payers (register at each developer portal)
AETNA_CLIENT_ID=
AETNA_CLIENT_SECRET=
CIGNA_CLIENT_ID=
CIGNA_CLIENT_SECRET=
HUMANA_CLIENT_ID=
HUMANA_CLIENT_SECRET=

# Fitbit (register at dev.fitbit.com)
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=

# Withings
WITHINGS_CLIENT_ID=
WITHINGS_CLIENT_SECRET=

# Oura
OURA_CLIENT_ID=
OURA_CLIENT_SECRET=

# Fallback FHIR credentials
FHIR_CLIENT_ID=
FHIR_CLIENT_SECRET=
```
