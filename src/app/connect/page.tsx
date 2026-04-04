'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FHIR_PROVIDERS, type FhirProvider } from '@/lib/fhir-providers';

interface Connection {
  source: string;
  provider_name: string;
  last_synced: string | null;
  is_expired: boolean;
}

function ProviderCard({
  provider,
  connection,
  onConnect,
  onSync,
  syncing,
}: {
  provider: FhirProvider;
  connection?: Connection;
  onConnect: () => void;
  onSync: () => void;
  syncing: boolean;
}) {
  const isConnected = !!connection && !connection.is_expired;
  const isExpired = connection?.is_expired;
  const isComingSoon = provider.status === 'coming_soon';

  return (
    <div
      className={`relative rounded-2xl border p-5 transition-all ${
        isConnected
          ? 'border-[#6366F1]/30 bg-[#6366F1]/[0.06]'
          : isComingSoon
          ? 'border-white/[0.04] bg-white/[0.02] opacity-50'
          : 'border-[var(--border)] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05]'
      }`}
    >
      {/* Status badge */}
      {isConnected && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Connected
        </div>
      )}
      {isExpired && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Expired
        </div>
      )}
      {isComingSoon && (
        <div className="absolute top-3 right-3 text-xs text-[var(--text-muted)] bg-white/[0.06] px-2 py-0.5 rounded-full">
          Coming soon
        </div>
      )}
      {provider.status === 'sandbox' && !isConnected && !isComingSoon && (
        <div className="absolute top-3 right-3 text-xs text-[#A78BFA] bg-[#A78BFA]/10 px-2 py-0.5 rounded-full">
          Sandbox
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="text-3xl flex-shrink-0 mt-0.5">{provider.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[var(--text)] font-semibold text-base">{provider.name}</h3>
          <p className="text-[var(--text-muted)] text-sm mt-1 leading-relaxed">
            {provider.description}
          </p>

          {isConnected && connection?.last_synced && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Last synced: {new Date(connection.last_synced).toLocaleDateString()} at{' '}
              {new Date(connection.last_synced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            {isConnected ? (
              <>
                <button
                  onClick={onSync}
                  disabled={syncing}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-[#6366F1]/20 text-[#A78BFA] hover:bg-[#6366F1]/30 transition-colors disabled:opacity-50"
                >
                  {syncing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Syncing...
                    </span>
                  ) : (
                    'Sync Now'
                  )}
                </button>
                <button
                  onClick={onConnect}
                  className="px-4 py-2 text-sm font-medium rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/[0.06] transition-colors"
                >
                  Reconnect
                </button>
              </>
            ) : isExpired ? (
              <button
                onClick={onConnect}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
              >
                Reconnect
              </button>
            ) : isComingSoon ? (
              <button
                disabled
                className="px-4 py-2 text-sm font-medium rounded-xl bg-white/[0.04] text-[var(--text-muted)] cursor-not-allowed"
              >
                Coming Soon
              </button>
            ) : (
              <button
                onClick={onConnect}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white hover:opacity-90 transition-opacity active:scale-[0.98]"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    fetchConnections();

    // Handle callback params
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected) {
      const provider = FHIR_PROVIDERS.find((p) => p.id === connected);
      setToast({
        message: `Connected to ${provider?.name || connected}! Syncing your health data...`,
        type: 'success',
      });
      // Refresh connections after a short delay
      setTimeout(fetchConnections, 2000);
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        missing_code: 'Authorization was cancelled',
        token_exchange_failed: 'Failed to connect. Please try again.',
        auth_mismatch: 'Session mismatch. Please try again.',
        oauth_error: 'Something went wrong. Please try again.',
        provider_not_configured: 'This provider is not configured yet.',
        save_failed: 'Failed to save connection. Please try again.',
        invalid_state: 'Invalid authorization state. Please try again.',
      };
      setToast({
        message: errorMessages[error] || `Connection error: ${error}`,
        type: 'error',
      });
    }
  }, [searchParams]);

  async function fetchConnections() {
    try {
      const res = await fetch('/api/fhir/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleConnect(providerId: string) {
    window.location.href = `/api/fhir/authorize?provider=${providerId}`;
  }

  async function handleSync(providerId: string) {
    setSyncingProvider(providerId);
    try {
      const res = await fetch('/api/fhir/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId }),
      });

      if (res.ok) {
        const data = await res.json();
        const total = Object.values(data.synced as Record<string, number>).reduce((a, b) => a + b, 0);
        setToast({ message: `Synced ${total} records from ${data.provider}`, type: 'success' });
        fetchConnections();
      } else {
        const data = await res.json();
        if (data.error?.includes('expired') || data.error?.includes('reconnect')) {
          setToast({ message: 'Token expired. Please reconnect.', type: 'error' });
        } else {
          setToast({ message: data.error || 'Sync failed', type: 'error' });
        }
      }
    } catch {
      setToast({ message: 'Sync failed. Please try again.', type: 'error' });
    } finally {
      setSyncingProvider(null);
    }
  }

  const connectedCount = connections.filter((c) => !c.is_expired).length;

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border backdrop-blur-xl text-sm font-medium animate-slide-up ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {toast.message}
          <button
            onClick={() => setToast(null)}
            className="ml-3 text-xs opacity-60 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="max-w-xl mx-auto px-5 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <h1 className="text-fluid-2xl font-bold text-[var(--text)]">Connect Your Health</h1>
          <p className="text-[var(--text-muted)] mt-2 text-sm leading-relaxed max-w-sm mx-auto">
            Securely connect your health portals. We use SMART on FHIR, the same standard
            your hospital uses. Your data stays yours.
          </p>
          {connectedCount > 0 && (
            <p className="text-xs text-[#A78BFA] mt-3">
              {connectedCount} account{connectedCount === 1 ? '' : 's'} connected
            </p>
          )}
        </div>

        {/* How it works */}
        <div className="mb-8 p-4 rounded-xl bg-white/[0.03] border border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-3">How it works</h2>
          <div className="space-y-2">
            {[
              { step: '1', text: 'Click Connect on your health provider below' },
              { step: '2', text: "You'll log in to your patient portal (we never see your password)" },
              { step: '3', text: 'Grant CareCompanion read-only access to your records' },
              { step: '4', text: 'Your medications, labs, appointments sync automatically' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#6366F1]/20 text-[#A78BFA] text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">
                  {item.step}
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Provider cards */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-white/[0.03] border border-[var(--border)] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected providers first, then available, then coming soon */}
            {[...FHIR_PROVIDERS]
              .sort((a, b) => {
                const aConnected = connections.some((c) => c.source === `fhir_${a.id}` && !c.is_expired);
                const bConnected = connections.some((c) => c.source === `fhir_${b.id}` && !c.is_expired);
                if (aConnected && !bConnected) return -1;
                if (!aConnected && bConnected) return 1;
                if (a.status === 'coming_soon' && b.status !== 'coming_soon') return 1;
                if (a.status !== 'coming_soon' && b.status === 'coming_soon') return -1;
                return 0;
              })
              .map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  connection={connections.find((c) => c.source === `fhir_${provider.id}`)}
                  onConnect={() => handleConnect(provider.id)}
                  onSync={() => handleSync(provider.id)}
                  syncing={syncingProvider === provider.id}
                />
              ))}
          </div>
        )}

        {/* Also show legacy connections (google calendar, 1uphealth) */}
        {connections.some((c) => !c.source.startsWith('fhir_')) && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Other Connections</h2>
            <div className="space-y-2">
              {connections
                .filter((c) => !c.source.startsWith('fhir_'))
                .map((c) => (
                  <div
                    key={c.source}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-[var(--border)]"
                  >
                    <div>
                      <p className="text-sm text-[var(--text)]">{c.provider_name}</p>
                      {c.last_synced && (
                        <p className="text-xs text-[var(--text-muted)]">
                          Synced {new Date(c.last_synced).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Connected
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            {connectedCount > 0 ? 'Continue to Dashboard' : 'Skip for Now'}
          </button>
          <button
            onClick={() => router.push('/manual-setup')}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Or enter your info manually
          </button>
        </div>

        {/* Privacy note */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-[var(--border)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A78BFA]">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-xs text-[var(--text-muted)]">
              Encrypted in transit and at rest. Read-only access. You can disconnect anytime.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
