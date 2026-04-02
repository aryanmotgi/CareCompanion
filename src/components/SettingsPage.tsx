'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { INTEGRATIONS, type IntegrationDef } from '@/lib/integrations';
import { Button } from '@/components/ui/Button';
import { CvsImportModal } from '@/components/CvsImportModal';
import type { ConnectedApp, Notification } from '@/lib/types';

interface SettingsPageProps {
  connectedApps: ConnectedApp[];
  unreadNotifications: Notification[];
}

function IntegrationCard({
  integration,
  connection,
  onConnect,
  onDisconnect,
}: {
  integration: IntegrationDef;
  connection: ConnectedApp | undefined;
  onConnect: (source: string) => void;
  onDisconnect: (id: string) => void;
}) {
  const isConnected = !!connection;

  return (
    <div className="flex items-start gap-4 p-5 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] hover:border-[var(--text-muted)]/30 transition-colors">
      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center">
        <svg
          className="w-5 h-5 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={integration.icon} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-display font-semibold text-white">{integration.name}</h3>
          {isConnected && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Connected
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-3">{integration.description}</p>
        {isConnected && connection.last_synced && (
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Last synced: {new Date(connection.last_synced).toLocaleString()}
          </p>
        )}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <button
              onClick={() => onDisconnect(connection.id)}
              className="text-sm text-red-400 hover:text-red-400 font-medium transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => onConnect(integration.source)}
              className="!py-2 !px-4 !min-h-0 text-sm"
            >
              {integration.source === 'cvs_import' ? 'Import' : 'Connect'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SettingsPage({ connectedApps, unreadNotifications }: SettingsPageProps) {
  const supabase = createClient();
  const [apps, setApps] = useState(connectedApps);
  const [showCvsModal, setShowCvsModal] = useState(false);

  const getConnection = (source: string) =>
    apps.find((a) => a.source === source);

  const handleConnect = (source: string) => {
    if (source === 'cvs_import') {
      setShowCvsModal(true);
      return;
    }
    if (source === 'google_calendar') {
      window.location.href = '/api/auth/google-calendar';
      return;
    }
    if (source === 'health_system') {
      window.location.href = '/api/auth/health-system';
      return;
    }
    if (source === 'insurance') {
      window.location.href = '/api/auth/insurance';
      return;
    }
    if (source === 'walgreens') {
      window.location.href = '/api/auth/walgreens';
      return;
    }
    // For integrations without OAuth, show a coming soon message
    alert(`${source} integration is coming soon. API credentials required.`);
  };

  const handleDisconnect = async (id: string) => {
    const { error } = await supabase.from('connected_apps').delete().eq('id', id);
    if (!error) {
      setApps((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const categories = [
    { key: 'health', label: 'Health Systems' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'pharmacy', label: 'Pharmacy' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'finance', label: 'Financial' },
  ] as const;

  return (
    <div className="space-y-8">
      {/* Notifications summary */}
      {unreadNotifications.length > 0 && (
        <div className="bg-blue-500/15 border border-blue-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            <h3 className="font-display font-semibold text-blue-200">
              {unreadNotifications.length} unread notification{unreadNotifications.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="space-y-2">
            {unreadNotifications.slice(0, 3).map((n) => (
              <p key={n.id} className="text-sm text-blue-300">{n.title}</p>
            ))}
            {unreadNotifications.length > 3 && (
              <p className="text-xs text-blue-400">+{unreadNotifications.length - 3} more</p>
            )}
          </div>
        </div>
      )}

      {/* Connected Apps */}
      <div>
        <h2 className="font-display text-lg font-semibold text-white mb-1">Connected Apps</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Link your health accounts to automatically sync medications, appointments, lab results, and insurance data.
        </p>

        {categories.map(({ key, label }) => {
          const integrations = INTEGRATIONS.filter((i) => i.category === key);
          if (integrations.length === 0) return null;
          return (
            <div key={key} className="mb-6">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-3">{label}</h3>
              <div className="space-y-3">
                {integrations.map((integration) => (
                  <IntegrationCard
                    key={integration.source}
                    integration={integration}
                    connection={getConnection(integration.source)}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* CVS Import Modal */}
      {showCvsModal && (
        <CvsImportModal onClose={() => setShowCvsModal(false)} />
      )}
    </div>
  );
}
