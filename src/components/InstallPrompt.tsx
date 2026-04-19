'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      sessionStorage.getItem('install-prompt-dismissed')
    ) return;

    let savedEvent: BeforeInstallPromptEvent | null = null;
    const handler = (e: Event) => {
      e.preventDefault();
      savedEvent = e as BeforeInstallPromptEvent;
      setTimeout(() => {
        if (savedEvent) setPromptEvent(savedEvent);
      }, 15000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!promptEvent || dismissed) return null;

  async function handleInstall() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setPromptEvent(null);
      setDismissed(true);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem('install-prompt-dismissed', '1');
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4 flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-lg">
          📱
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Add to Home Screen</p>
          <p className="text-xs text-gray-500 mt-0.5">Get quick access to CareCompanion — works offline too.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 bg-blue-600 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 border border-gray-200 text-gray-500 text-xs py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
