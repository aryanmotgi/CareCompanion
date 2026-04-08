'use client';

import { useState, useCallback } from 'react';
import type { Appointment } from '@/lib/types';

interface VisitPrepViewProps {
  appointments: Appointment[];
}

type PrepState = Record<string, {
  content: string | null;
  loading: boolean;
  error: string | null;
}>;

function formatDateTime(dt: string | null): string {
  if (!dt) return 'No date set';
  return new Date(dt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function daysUntil(dt: string | null): string {
  if (!dt) return '';
  const diff = Math.ceil((new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Past';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

/** Simple markdown renderer matching the existing VisitPrepSheet pattern */
function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### '))
      return <h3 key={i} className="text-sm font-bold text-[var(--text)] mt-4 mb-1">{line.replace('### ', '')}</h3>;
    if (line.startsWith('## '))
      return <h2 key={i} className="text-base font-bold text-[var(--text)] mt-5 mb-2">{line.replace('## ', '')}</h2>;
    if (line.startsWith('# '))
      return <h1 key={i} className="text-lg font-bold text-[var(--text)] mt-4 mb-2">{line.replace('# ', '')}</h1>;

    if (line.match(/^- \[ \]/))
      return (
        <label key={i} className="flex items-start gap-2 py-0.5 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" className="mt-1 accent-[#6366F1]" />
          <span>{line.replace(/^- \[ \] /, '')}</span>
        </label>
      );
    if (line.match(/^- \[x\]/i))
      return (
        <label key={i} className="flex items-start gap-2 py-0.5 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" defaultChecked className="mt-1 accent-[#6366F1]" />
          <span>{line.replace(/^- \[x\] /i, '')}</span>
        </label>
      );

    if (line.match(/^[-*] /)) {
      const content = line.replace(/^[-*] /, '');
      const parts = content.split(/(\*\*.*?\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={j} className="text-[var(--text)]">{part.slice(2, -2)}</strong>;
        return part;
      });
      return <li key={i} className="text-sm text-[var(--text-secondary)] ml-4 py-0.5 list-disc">{parts}</li>;
    }

    if (line.includes('|') && !line.match(/^[-|: ]+$/)) {
      const cells = line.split('|').filter(Boolean).map((c) => c.trim());
      return (
        <div key={i} className="grid gap-2 text-xs py-1 border-b border-white/[0.04]" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
          {cells.map((cell, j) => (
            <span key={j} className={j === 0 ? 'text-[var(--text)] font-medium' : 'text-[var(--text-secondary)]'}>{cell}</span>
          ))}
        </div>
      );
    }

    if (line.match(/^[-|: ]+$/)) return null;
    if (!line.trim()) return <div key={i} className="h-2" />;

    const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={j} className="text-[var(--text)]">{part.slice(2, -2)}</strong>;
      return part;
    });
    return <p key={i} className="text-sm text-[var(--text-secondary)] py-0.5">{parts}</p>;
  });
}

export function VisitPrepView({ appointments }: VisitPrepViewProps) {
  const [prepState, setPrepState] = useState<PrepState>(() => {
    const initial: PrepState = {};
    for (const appt of appointments) {
      initial[appt.id] = {
        content: appt.prep_notes || null,
        loading: false,
        error: null,
      };
    }
    return initial;
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generatePrep = useCallback(async (appointmentId: string) => {
    setPrepState((prev) => ({
      ...prev,
      [appointmentId]: { ...prev[appointmentId], loading: true, error: null },
    }));

    try {
      const res = await fetch('/api/visit-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointmentId }),
      });

      if (!res.ok) throw new Error('Failed to generate prep sheet');

      const data = await res.json();

      if (data.success && data.prep_sheet) {
        setPrepState((prev) => ({
          ...prev,
          [appointmentId]: { content: data.prep_sheet, loading: false, error: null },
        }));
        setExpandedId(appointmentId);
      } else {
        throw new Error(data.error || 'Failed to generate prep sheet');
      }
    } catch (err) {
      setPrepState((prev) => ({
        ...prev,
        [appointmentId]: {
          ...prev[appointmentId],
          loading: false,
          error: err instanceof Error ? err.message : 'Something went wrong',
        },
      }));
    }
  }, []);

  const handleShare = useCallback(async (appt: Appointment, content: string) => {
    const title = `Visit Prep — ${appt.doctor_name || 'Appointment'}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: content });
        return;
      } catch {
        // User cancelled or share not supported, fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(content);
    setCopiedId(appt.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handlePrint = useCallback((appt: Appointment, content: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const doctorName = esc(appt.doctor_name || 'Appointment');
    const dateStr = appt.date_time ? ` &mdash; ${esc(formatDateTime(appt.date_time))}` : '';
    const locationStr = appt.location ? `<br>${esc(appt.location)}` : '';
    const safeContent = esc(content).replace(/\n/g, '<br>');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Visit Prep — ${doctorName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
            h1 { font-size: 1.4rem; border-bottom: 2px solid #6366F1; padding-bottom: 0.5rem; }
            h2 { font-size: 1.1rem; margin-top: 1.5rem; }
            h3 { font-size: 1rem; margin-top: 1rem; }
            li { margin: 0.25rem 0; }
            .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Visit Prep Sheet</h1>
          <div class="meta">
            ${doctorName}${dateStr}
            ${locationStr}
          </div>
          ${safeContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, []);

  // Empty state
  if (appointments.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--text)]">Visit Prep</h2>
          <p className="text-sm text-[var(--text-secondary)]">Prepare for upcoming appointments</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] px-5 py-12 text-center">
          <svg className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
          </svg>
          <p className="text-sm text-[var(--text-secondary)] mb-1">No upcoming appointments</p>
          <p className="text-xs text-[var(--text-muted)]">Appointments in the next 30 days will appear here for prep</p>
          <a
            href="/appointments"
            className="inline-block mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold animate-press"
          >
            Add an Appointment
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-display text-lg font-bold text-[var(--text)]">Visit Prep</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {appointments.length} upcoming appointment{appointments.length !== 1 ? 's' : ''} in the next 30 days
        </p>
      </div>

      {/* Appointment cards */}
      <div className="space-y-3">
        {appointments.map((appt, index) => {
          const state = prepState[appt.id] || { content: null, loading: false, error: null };
          const isExpanded = expandedId === appt.id;
          const hasPrep = !!state.content;
          const badge = daysUntil(appt.date_time);

          return (
            <div
              key={appt.id}
              className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden animate-card-in"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Card header */}
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[var(--text)] truncate">
                        {appt.doctor_name || 'Appointment'}
                      </h3>
                      {appt.specialty && (
                        <span className="flex-shrink-0 text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-[#6366F1]/15 text-[#A78BFA]">
                          {appt.specialty}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                        {formatDateTime(appt.date_time)}
                      </span>
                      {appt.location && (
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                          </svg>
                          <span className="truncate max-w-[180px]">{appt.location}</span>
                        </span>
                      )}
                    </div>

                    {appt.purpose && (
                      <p className="text-sm text-[var(--text-secondary)] mt-1.5">{appt.purpose}</p>
                    )}
                  </div>

                  {badge && (
                    <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg ${
                      badge === 'Today'
                        ? 'bg-red-500/15 text-red-400'
                        : badge === 'Tomorrow'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-white/[0.06] text-[var(--text-muted)]'
                    }`}>
                      {badge}
                    </span>
                  )}
                </div>

                {/* Error message */}
                {state.error && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    {state.error}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-4">
                  {!hasPrep ? (
                    <button
                      onClick={() => generatePrep(appt.id)}
                      disabled={state.loading}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold disabled:opacity-50 transition-opacity animate-press"
                    >
                      {state.loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </span>
                      ) : (
                        'Generate Prep Sheet'
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : appt.id)}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold animate-press"
                      >
                        {isExpanded ? 'Hide Prep Sheet' : 'View Prep Sheet'}
                      </button>
                      <button
                        onClick={() => generatePrep(appt.id)}
                        disabled={state.loading}
                        className="py-2.5 px-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-[var(--text-secondary)] text-sm font-medium hover:bg-white/[0.1] transition-colors disabled:opacity-50 animate-press"
                        title="Regenerate"
                      >
                        {state.loading ? (
                          <span className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin inline-block" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Loading skeleton */}
              {state.loading && !hasPrep && (
                <div className="px-5 pb-5 space-y-3">
                  <div className="h-2 w-3/4 rounded bg-white/[0.04] animate-pulse" />
                  <div className="h-2 w-full rounded bg-white/[0.04] animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2/3 rounded bg-white/[0.04] animate-pulse" style={{ animationDelay: '300ms' }} />
                  <div className="h-2 w-5/6 rounded bg-white/[0.04] animate-pulse" style={{ animationDelay: '450ms' }} />
                  <div className="h-2 w-1/2 rounded bg-white/[0.04] animate-pulse" style={{ animationDelay: '600ms' }} />
                </div>
              )}

              {/* Expanded prep sheet */}
              {isExpanded && hasPrep && state.content && (
                <div className="border-t border-white/[0.06]">
                  {/* Prep sheet toolbar */}
                  <div className="flex items-center justify-end gap-2 px-5 pt-3">
                    <button
                      onClick={() => handleShare(appt, state.content!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-[var(--text-secondary)] text-xs font-medium hover:bg-white/[0.1] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" />
                      </svg>
                      {copiedId === appt.id ? 'Copied!' : 'Share'}
                    </button>
                    <button
                      onClick={() => handlePrint(appt, state.content!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-[var(--text-secondary)] text-xs font-medium hover:bg-white/[0.1] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                      </svg>
                      Print
                    </button>
                  </div>

                  {/* Rendered markdown */}
                  <div className="px-5 pb-5 pt-2">
                    {renderMarkdown(state.content)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
