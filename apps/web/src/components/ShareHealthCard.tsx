'use client';

import { useState, useEffect } from 'react';
import { useCsrfToken } from '@/components/CsrfProvider';

interface ExistingLink {
  token: string;
  expiresAt: string;
  viewCount: number;
  url: string;
}

export function ShareHealthCard() {
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingLink, setExistingLink] = useState<ExistingLink | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    fetch('/api/share')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!json) return;
        const links: { token: string; type: string; expiresAt: string; viewCount: number; url: string }[] = json.data?.links ?? [];
        const match = links.find(l => l.type === 'health_summary');
        if (match) {
          setExistingLink({ token: match.token, expiresAt: match.expiresAt, viewCount: match.viewCount, url: match.url });
          setShareUrl(match.url);
        }
      })
      .catch(() => {})
      .finally(() => setIsCheckingExisting(false));
  }, []);

  const handleShare = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ type: 'health_summary' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate link');
      setShareUrl(json.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — please copy the link manually.');
    }
  };

  const handleRevoke = async () => {
    if (!existingLink) return;
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${existingLink.token}/revoke`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to revoke link');
      }
      setShareUrl(null);
      setExistingLink(null);
      setConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke link');
    } finally {
      setRevoking(false);
    }
  };

  const handleReset = () => {
    setShareUrl(null);
    setExistingLink(null);
    setConfirmed(false);
    setError(null);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#6366F1]/10 to-[#A78BFA]/10 border border-[#A78BFA]/20 px-5 py-4">
      {!shareUrl ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Share Health Summary</p>
              <p className="text-xs text-white/50 mt-0.5">
                Generate a private link for your doctor or family — expires in 7 days
              </p>
            </div>
            {!confirmed ? (
              <button
                onClick={() => setConfirmed(true)}
                disabled={isCheckingExisting}
                className="flex-shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold transition-opacity disabled:opacity-40"
              >
                {isCheckingExisting ? 'Loading...' : 'Share'}
              </button>
            ) : (
              <button
                onClick={handleShare}
                disabled={loading}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : 'Confirm & share'}
              </button>
            )}
          </div>
          <p className="text-xs text-white/30">
            {confirmed
              ? 'This will share: medications, lab results, care team, appointments, allergies, and cancer staging. Tap "Confirm & share" to generate the link.'
              : 'This will share: medications, lab results, care team, appointments, allergies, and cancer staging. The link expires in 7 days.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="text-sm font-semibold text-white truncate">
                {existingLink ? 'Active link' : 'Link ready'} — expires{' '}
                {existingLink
                  ? new Date(existingLink.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'in 7 days'}
              </p>
            </div>
            {existingLink && existingLink.viewCount > 0 && (
              <span className="text-xs text-white/30 flex-shrink-0">
                Viewed {existingLink.viewCount} time{existingLink.viewCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/60 truncate font-mono">
              {shareUrl}
            </div>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 px-3 py-2 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-xs font-semibold transition-opacity"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleReset} className="text-xs text-white/30 hover:text-white/50 transition-colors">
              Generate another link
            </button>
            {existingLink && (
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {revoking ? 'Revoking...' : 'Revoke link'}
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
