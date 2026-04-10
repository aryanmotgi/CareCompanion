'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { DataConsentModal } from '@/components/DataConsentModal';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { useToast } from '@/components/ToastProvider';
import type { ConnectedApp } from '@/lib/types';

interface ConnectAccountsProps {
  connectedApps: ConnectedApp[];
  patientName?: string | null;
  hasProfile: boolean;
}

const OTHER_SERVICES = [
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Heart rate, sleep, activity, SpO2',
    icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 8v4l3 3',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    glowColor: 'rgba(52, 211, 153, 0.3)',
    available: true,
  },
  {
    id: 'withings',
    name: 'Withings',
    description: 'Blood pressure, weight, sleep',
    icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 8v4l3 3',
    accentColor: 'text-cyan-400',
    accentBg: 'bg-cyan-500/15',
    glowColor: 'rgba(34, 211, 238, 0.3)',
    available: true,
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    description: 'Sleep, readiness, activity scores',
    icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 8v4l3 3',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    glowColor: 'rgba(167, 139, 250, 0.3)',
    available: true,
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync medical appointments',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
    glowColor: 'rgba(251, 191, 36, 0.3)',
    available: true,
  },
  {
    id: 'walgreens',
    name: 'Walgreens',
    description: 'Coming soon — pending partnership approval',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0',
    accentColor: 'text-red-400',
    accentBg: 'bg-red-500/15',
    glowColor: 'rgba(248, 113, 113, 0.3)',
    available: false,
  },
];

const DATA_PILLS = [
  { label: 'medications', color: 'bg-blue-500/20 text-blue-300' },
  { label: 'lab results', color: 'bg-cyan-500/20 text-cyan-300' },
  { label: 'conditions', color: 'bg-violet-500/20 text-violet-300' },
  { label: 'allergies', color: 'bg-amber-500/20 text-amber-300' },
  { label: 'appointments', color: 'bg-emerald-500/20 text-emerald-300' },
  { label: 'doctors', color: 'bg-pink-500/20 text-pink-300' },
  { label: 'claims', color: 'bg-indigo-500/20 text-indigo-300' },
  { label: 'insurance', color: 'bg-teal-500/20 text-teal-300' },
];

export function ConnectAccounts({ connectedApps, patientName, hasProfile }: ConnectAccountsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { showToast } = useToast();

  const [apps, setApps] = useState(connectedApps);
  const [managingFor, setManagingFor] = useState<'self' | 'other'>(patientName ? 'other' : 'self');
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [name, setName] = useState(patientName || '');
  const [age, setAge] = useState('');
  const [relationship, setRelationship] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [justConnected, setJustConnected] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOneUpConnected = apps.some((a) => a.source === '1uphealth');

  const ERROR_MESSAGES: Record<string, string> = {
    provider_not_configured: '1upHealth is not configured yet. Please contact support.',
    oneup_user_failed: 'Could not create 1upHealth account. Please try again.',
    oneup_token_failed: 'Authentication with 1upHealth failed. Please try again.',
    oneup_error: 'Something went wrong connecting to 1upHealth. Please try again.',
  };

  // Check if we just came back from a successful connection or error
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setConnectError(ERROR_MESSAGES[error] || 'Connection failed. Please try again.');
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }

    const connected = searchParams.get('connected');
    if (connected) {
      setJustConnected(connected);
      // Clear the param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());

      // Refresh connected apps + trigger sync
      const refreshAndSync = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('connected_apps').select('*').eq('user_id', user.id);
          if (data) setApps(data);

          // Auto-trigger sync to import health data and auto-detect cancer type
          fetch('/api/oneup/sync', { method: 'POST' }).catch(() => {});
        }
      };
      refreshAndSync();
    }

    // Auto-sync if 1upHealth is connected but profile is incomplete (e.g., user just returned from system search)
    const autoSync = async () => {
      const oneUp = connectedApps.find(a => a.source === '1uphealth');
      if (!oneUp) return;
      // If connected recently (within last 5 min) and no last_synced or very recent connection
      const connectedAt = oneUp.metadata && typeof oneUp.metadata === 'object' && 'connected_at' in oneUp.metadata
        ? new Date(oneUp.metadata.connected_at as string).getTime() : 0;
      const syncedAt = oneUp.last_synced ? new Date(oneUp.last_synced).getTime() : 0;
      if (connectedAt > syncedAt) {
        // Connection is newer than last sync — trigger sync
        fetch('/api/oneup/sync', { method: 'POST' }).catch(() => {});
      }
    };
    if (!connected && !error) autoSync();
  }, [searchParams, supabase]);

  const handleManagingForChange = (value: 'self' | 'other') => {
    setManagingFor(value);
    setShowPatientForm(value === 'other');
  };

  const savePatientInfo = async () => {
    if (!name.trim()) return;
    setSavingProfile(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert care profile with the patient info
      const { data: existing } = await supabase
        .from('care_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        await supabase.from('care_profiles').update({
          patient_name: name.trim(),
          patient_age: age ? parseInt(age) : null,
          relationship: relationship || null,
        }).eq('id', existing.id);
      } else {
        await supabase.from('care_profiles').insert({
          user_id: user.id,
          patient_name: name.trim(),
          patient_age: age ? parseInt(age) : null,
          relationship: relationship || null,
        });
      }

      setShowPatientForm(false);
      showToast('Profile saved', 'success');
    } catch (err) {
      console.error('Save patient info error:', err);
      showToast('Failed to save profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/oneup/sync', { method: 'POST' });
      showToast('Sync started', 'success');
      router.refresh();
    } catch {
      showToast('Failed to sync', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (source: string) => {
    const app = apps.find((a) => a.source === source);
    if (!app) return;
    const { error } = await supabase.from('connected_apps').delete().eq('id', app.id);
    if (!error) {
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      showToast('Account disconnected', 'success');
    } else {
      showToast('Failed to disconnect account', 'error');
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto space-y-10 px-4 py-8">

      {/* ── Background orbs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] animate-orb-drift" />
        <div className="absolute top-[40%] -right-40 w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px] animate-orb-drift" style={{ animationDelay: '3s' }} />
        <div className="absolute bottom-20 -left-32 w-[300px] h-[300px] rounded-full bg-cyan-500/8 blur-[100px] animate-orb-drift" style={{ animationDelay: '6s' }} />
      </div>

      {/* ━━ 1. HEADER ━━ */}
      <header className="relative text-center animate-fade-in-up">
        {/* Floating orb behind header */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-gradient-to-br from-blue-500/20 via-violet-500/15 to-cyan-500/20 blur-[60px] animate-orb-drift pointer-events-none" />
        <h1 className="relative font-display text-4xl sm:text-5xl font-bold tracking-tight animate-gradient-text pb-1">
          Connect Your World
        </h1>
        <p className="relative mt-3 text-[var(--text-secondary)] text-base sm:text-lg max-w-md mx-auto">
          Link your health services for a unified, intelligent care experience
        </p>
      </header>

      {/* ━━ ERROR BANNER ━━ */}
      {connectError && (
        <div className="glass-card animate-fade-in-up rounded-2xl p-5 border border-red-500/20" style={{ background: 'rgba(239, 68, 68, 0.06)' }}>
          <div className="flex items-center gap-4">
            <div className="relative w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">Connection failed</p>
              <p className="text-xs text-red-400/70 mt-0.5">{connectError}</p>
            </div>
            <button onClick={() => setConnectError(null)} className="text-red-400/60 hover:text-red-400 transition-colors p-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ━━ 7. SUCCESS BANNER ━━ */}
      {justConnected && (
        <div className="glass-card animate-fade-in-up stagger-1 animate-pulse-glow-green rounded-2xl p-5 border border-emerald-500/20" style={{ background: 'rgba(52, 211, 153, 0.06)' }}>
          <div className="flex items-center gap-4">
            <div className="relative w-11 h-11 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-md" />
              <svg className="relative w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path className="animate-draw-check" strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Connected successfully!</p>
              <p className="text-xs text-emerald-400/70 mt-0.5">Your health data is syncing in the background...</p>
            </div>
          </div>
        </div>
      )}

      {/* ━━ 2. WHO IS THIS FOR? ━━ */}
      <section className="animate-fade-in-up stagger-2">
        <h3 className="text-[11px] font-semibold tracking-[0.2em] text-[var(--text-muted)] uppercase mb-4">Who is this for?</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Myself card */}
          <button
            onClick={() => handleManagingForChange('self')}
            className={`glass-card rounded-2xl p-5 text-left transition-all ${
              managingFor === 'self' ? 'border-flow-gradient' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${managingFor === 'self' ? 'bg-blue-500/20' : 'bg-white/5'} transition-colors`}>
                <svg className={`w-5 h-5 ${managingFor === 'self' ? 'text-[#A78BFA]' : 'text-[var(--text-muted)]'} transition-colors`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <span className={`font-medium text-sm ${managingFor === 'self' ? 'text-white' : 'text-[var(--text-secondary)]'} transition-colors`}>Myself</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">Track your own health records and vitals</p>
          </button>

          {/* Someone I care for card */}
          <button
            onClick={() => handleManagingForChange('other')}
            className={`glass-card rounded-2xl p-5 text-left transition-all ${
              managingFor === 'other' ? 'border-flow-gradient' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${managingFor === 'other' ? 'bg-pink-500/20' : 'bg-white/5'} transition-colors`}>
                <svg className={`w-5 h-5 ${managingFor === 'other' ? 'text-pink-400' : 'text-[var(--text-muted)]'} transition-colors`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
              </div>
              <span className={`font-medium text-sm ${managingFor === 'other' ? 'text-white' : 'text-[var(--text-secondary)]'} transition-colors`}>Someone I care for</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">Manage health data for a loved one</p>
          </button>
        </div>

        {/* Patient info form — slides down */}
        {showPatientForm && (
          <div className="animate-slide-down mt-4">
            <div className="glass-card-elevated rounded-2xl p-6 space-y-4 border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-sm text-[var(--text-secondary)]">
                Tell us about the person you&apos;re caring for:
              </p>
              <FormField label="Their name" value={name} onChange={setName} placeholder="e.g., Mom, Dad, John" required />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Age" type="number" value={age} onChange={setAge} placeholder="e.g., 75" />
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Relationship</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select...</option>
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
              <Button onClick={savePatientInfo} loading={savingProfile} className="!py-2 !px-4 !min-h-0 text-sm">
                Save
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ━━ 3. 1upHEALTH PRIMARY CARD ━━ */}
      <section className="animate-fade-in-up stagger-3">
        <h3 className="text-[11px] font-semibold tracking-[0.2em] text-[var(--text-muted)] uppercase mb-4">Health Records</h3>
        <div
          className={`glass-card rounded-2xl p-6 sm:p-8 relative overflow-hidden ${
            isOneUpConnected
              ? 'border-flow-gradient border-flow-gradient-green animate-pulse-glow-green'
              : 'border-flow-gradient animate-pulse-glow-blue'
          }`}
        >
          {/* Glow orb behind icon */}
          <div className="absolute top-6 left-6 w-20 h-20 rounded-full bg-blue-500/15 blur-[40px] pointer-events-none" />

          <div className="relative flex items-start gap-5">
            {/* Large health icon with pulsing glow */}
            <div className="relative flex-shrink-0">
              <div className={`absolute inset-0 rounded-2xl blur-xl ${isOneUpConnected ? 'bg-emerald-500/25' : 'bg-blue-500/25'} animate-orb-pulse`} />
              <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center ${isOneUpConnected ? 'bg-emerald-500/15' : 'bg-blue-500/15'} transition-colors`}>
                <svg className={`w-7 h-7 sm:w-8 sm:h-8 ${isOneUpConnected ? 'text-emerald-400' : 'text-[#A78BFA]'} transition-colors`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {/* Connected badge */}
              {isOneUpConnected && (
                <div className="mb-2">
                  <ConnectionStatus
                    source="1uphealth"
                    lastSynced={apps.find((a) => a.source === '1uphealth')?.last_synced}
                  />
                </div>
              )}

              <h3 className="font-display text-xl sm:text-2xl font-bold animate-gradient-text inline-block">
                Connect Health Records
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                MyChart, Kaiser, Sutter Health, Aetna, UnitedHealthcare, Medicare, and 300+ more health systems and insurers
              </p>

              {/* Data type pills */}
              <div className="flex flex-wrap gap-2 mt-4">
                {DATA_PILLS.map((pill) => (
                  <span
                    key={pill.label}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                      isOneUpConnected ? 'bg-emerald-500/10 text-emerald-400' : pill.color
                    } transition-colors`}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>

              {/* Last synced time */}
              {isOneUpConnected && (
                <p className="text-xs text-emerald-400/70 mt-3">
                  {apps.find((a) => a.source === '1uphealth')?.last_synced
                    ? `Last synced ${new Date(apps.find((a) => a.source === '1uphealth')!.last_synced!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                    : 'Syncing...'}
                </p>
              )}
            </div>
          </div>

          {/* CTA area */}
          <div className="relative z-10 mt-6 flex items-center gap-3">
            {isOneUpConnected ? (
              <>
                <Button onClick={handleSync} loading={syncing} variant="secondary" className="!py-2.5 !px-5 !min-h-0 text-sm !bg-emerald-500/10 !border-emerald-500/20 !text-emerald-400 hover:!bg-emerald-500/20">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                  Sync Now
                </Button>
                <button onClick={() => handleDisconnect('1uphealth')} className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors px-3 py-2">
                  Disconnect
                </button>
              </>
            ) : (
              <button onClick={() => setShowConsent(true)} className="relative z-10 gradient-btn inline-flex items-center gap-2.5 text-white font-semibold text-sm py-3 px-7 rounded-xl cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
                Connect Health Records
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ━━ 4. OTHER SERVICES GRID ━━ */}
      <section className="animate-fade-in-up stagger-4">
        <h3 className="text-[11px] font-semibold tracking-[0.2em] text-[var(--text-muted)] uppercase mb-4">Other Services</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {OTHER_SERVICES.map((svc, i) => {
            const isConnected = apps.some((a) => a.source === svc.id);
            return (
              <div
                key={svc.id}
                className={`glass-card rounded-2xl p-5 relative overflow-hidden animate-fade-in-up`}
                style={{ animationDelay: `${0.3 + i * 0.07}s` }}
              >
                {/* Subtle colored glow */}
                <div
                  className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-[40px] pointer-events-none opacity-40"
                  style={{ background: svc.glowColor }}
                />

                <div className="relative flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {/* Icon with glow bg */}
                    <div className="relative">
                      <div className={`absolute inset-0 rounded-xl blur-lg ${svc.accentBg} opacity-50`} />
                      <div className={`relative w-10 h-10 rounded-xl ${svc.accentBg} flex items-center justify-center flex-shrink-0`}>
                        <svg className={`w-5 h-5 ${svc.accentColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d={svc.icon} />
                        </svg>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white text-sm">{svc.name}</h4>
                        {/* Green connected indicator dot */}
                        {isConnected && (
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-dot-pulse flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{svc.description}</p>
                    </div>
                  </div>

                  <div className="ml-3 flex-shrink-0">
                    {svc.available ? (
                      isConnected ? (
                        <button onClick={() => handleDisconnect(svc.id)} className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors py-1.5">
                          Disconnect
                        </button>
                      ) : (
                        <button className="text-xs font-medium text-[#A78BFA] bg-blue-500/10 hover:bg-blue-500/20 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] px-3.5 py-1.5 rounded-lg transition-all">
                          Connect
                        </button>
                      )
                    ) : (
                      <span className="text-[10px] font-medium text-[var(--text-muted)]/60 bg-white/[0.03] px-2.5 py-1 rounded-md whitespace-nowrap border border-white/[0.04]">
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ━━ 5. PHOTO SCANNER FALLBACK ━━ */}
      <section className="animate-fade-in-up stagger-5">
        <div className="glass-card rounded-2xl border border-dashed !border-[var(--text-muted)]/15 p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-violet-500/20 blur-lg" />
              <div className="relative w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white text-sm">Don&apos;t see your provider?</h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Use our photo scanner to import pill bottles, lab reports, insurance cards, and more
              </p>
            </div>
            <a href="/scans" className="flex-shrink-0 text-xs font-medium text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 hover:shadow-[0_0_15px_rgba(139,92,246,0.25)] px-4 py-2 rounded-xl transition-all whitespace-nowrap">
              Scan Documents
            </a>
          </div>
        </div>
      </section>

      {/* ━━ 6. DEMO DATA ━━ */}
      <section className="animate-fade-in-up stagger-6">
        <div className="glass-card rounded-2xl border border-dashed !border-cyan-500/20 p-6" style={{ background: 'rgba(6, 182, 212, 0.04)' }}>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-cyan-500/20 blur-lg" />
              <div className="relative w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white text-sm">Try with cancer care demo</h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Load realistic cancer treatment data (chemo meds, tumor markers, oncology appointments) to explore the full app
              </p>
            </div>
            <button
              onClick={async () => {
                setSavingProfile(true);
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;

                  // Ensure profile exists
                  const { data: existing } = await supabase.from('care_profiles').select('id').eq('user_id', user.id).single();
                  if (!existing) {
                    await supabase.from('care_profiles').insert({
                      user_id: user.id,
                      patient_name: 'Mom',
                      patient_age: 62,
                      relationship: 'parent',
                      conditions: 'Stage IIIA Breast Cancer (HER2+, ER+)\nHypertension\nAnxiety',
                      allergies: 'Sulfa drugs\nLatex',
                    });
                  }

                  await fetch('/api/seed-demo', { method: 'POST' });
                  showToast('Demo data loaded', 'success');
                  router.push('/dashboard');
                } catch (err) {
                  console.error('Demo seed error:', err);
                  showToast('Failed to load demo data', 'error');
                } finally {
                  setSavingProfile(false);
                }
              }}
              className="flex-shrink-0 text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] px-4 py-2 rounded-xl transition-all whitespace-nowrap"
            >
              {savingProfile ? 'Loading...' : 'Load Demo'}
            </button>
          </div>
        </div>
      </section>

      {/* ━━ DELETE ACCOUNT ━━ */}
      <section className="animate-fade-in-up stagger-6">
        <div className="text-center">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-[#64748b] hover:text-red-400 transition-colors"
          >
            Delete account &amp; start over
          </button>
        </div>
      </section>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-lg" onClick={() => !deleting && setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl shadow-2xl animate-fade-in-up overflow-hidden" style={{ backgroundColor: '#0f172a' }}>
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">Delete Account</h3>
              <p className="text-sm text-[#94a3b8] text-center mb-6">
                This will permanently delete your account and all your data — medications, appointments, lab results, messages, and settings. You&apos;ll be redirected to sign up again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#94a3b8] hover:text-white transition-colors disabled:opacity-40"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      const res = await fetch('/api/delete-account', { method: 'POST' });
                      if (!res.ok) throw new Error('Delete failed');
                      window.location.href = '/login';
                    } catch {
                      setDeleting(false);
                      setShowDeleteConfirm(false);
                      showToast('Failed to delete account', 'error');
                    }
                  }}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                >
                  {deleting && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {deleting ? 'Deleting...' : 'Delete Everything'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ━━ 7. FOOTER ━━ */}
      <footer className="flex items-center justify-between pb-10 animate-fade-in-up stagger-6">
        {!hasProfile && (
          <a href="/manual-setup" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            Enter data manually instead
          </a>
        )}
        <div className="ml-auto">
          <button
            onClick={() => router.push('/dashboard')}
            className="gradient-btn inline-flex items-center gap-2 text-white font-semibold text-sm py-3 px-7 rounded-xl"
          >
            {isOneUpConnected ? 'Continue to Dashboard' : 'Skip for now'}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </footer>

      <DataConsentModal
        isOpen={showConsent}
        onClose={() => setShowConsent(false)}
        consentHref="/api/fhir/authorize?provider=1uphealth"
        onConsent={() => {
          setShowConsent(false);
        }}
      />
    </div>
  );
}
