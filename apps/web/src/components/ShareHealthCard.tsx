'use client';

import { useState, useEffect } from 'react';
import { useCsrfToken } from '@/components/CsrfProvider';

export function ShareHealthCard() {
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingLink, setExistingLink] = useState<{ token: string; expiresAt: string } | null>(null);

  useEffect(() => {
    fetch('/api/share')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!json) return;
        const links: { token: string; type: string; expiresAt: string }[] = json.data?.links ?? [];
        const match = links.find(l => l.type === 'health_summary');
        if (match) {
          setExistingLink({ token: match.token, expiresAt: match.expiresAt });
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
          setShareUrl(`${appUrl}/shared/${match.token}`);
        }
      })
      .catch(() => {});
  }, []);

  const handleShare = async () => {
    if (existingLink) {
      // Already populated by useEffect — nothing to do
      return;
    }
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

  const handleReset = () => {
    setShareUrl(null);
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
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" />
                  </svg>
                  Share
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-white/30">
            This will share: medications, lab results, care team, appointments, allergies, and cancer staging. The link expires in 7 days.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm font-semibold text-white">
              {existingLink ? 'Active link' : 'Link ready'} — expires{' '}
              {existingLink
                ? new Date(existingLink.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'in 7 days'}
            </p>
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
          <button onClick={handleReset} className="text-xs text-white/30 hover:text-white/50 transition-colors">
            Generate another link
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
