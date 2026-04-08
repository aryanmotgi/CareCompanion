'use client';

interface ConnectionStatusProps {
  source: string;
  lastSynced?: string | null;
  onSync?: () => void;
  onDisconnect?: () => void;
  syncing?: boolean;
}

export function ConnectionStatus({ source, lastSynced }: ConnectionStatusProps) {
  const displayName = source === '1uphealth' ? '1upHealth' : source;
  const formattedTime = lastSynced
    ? new Date(lastSynced).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold tracking-wide">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-dot-pulse" />
        {displayName} Connected
      </div>
      {formattedTime && (
        <span className="text-[10px] text-emerald-400/60">
          Last synced {formattedTime}
        </span>
      )}
    </div>
  );
}
