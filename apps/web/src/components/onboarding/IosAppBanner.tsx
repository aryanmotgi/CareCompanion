'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const DISMISS_KEY = 'cc-ios-banner-dismissed';
const APP_STORE_URL =
  'https://apps.apple.com/app/carecompanion-ai/id6738888888'; // placeholder; replace once listing live

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
}

interface IosAppBannerProps {
  role: 'patient' | 'caregiver' | 'self' | null;
}

export function IosAppBanner({ role }: IosAppBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (role !== 'patient') return;
    if (!isIosSafari()) return;
    let dismissed = false;
    try { dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'; } catch { /* private */ }
    if (!dismissed) setVisible(true);
  }, [role]);

  function dismiss() {
    setVisible(false);
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private */ }
  }

  if (!visible) return null;

  return (
    <motion.div
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -64, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      role="region"
      aria-label="Mobile app suggestion"
      className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
      style={{
        background: 'var(--bg-warm)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg"
        style={{
          background: 'linear-gradient(135deg, #A78BFA, #818CF8)',
        }}
        aria-hidden
      >
        ❤️
      </span>
      <div className="flex-1">
        <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
          Apple Health connects in 30 seconds in our app.
        </div>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-block text-xs"
          style={{ color: 'var(--accent)' }}
          onClick={() => {
            // Treat tapping the link as a soft dismissal so the banner doesn't follow them across phases
            try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private */ }
          }}
        >
          Get the app →
        </a>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        ✕
      </button>
    </motion.div>
  );
}
