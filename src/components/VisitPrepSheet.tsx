'use client';

import { useState } from 'react';

interface VisitPrepSheetProps {
  appointmentId: string;
  doctorName: string;
  dateTime: string | null;
  existingPrep: string | null;
}

export function VisitPrepSheet({ appointmentId, doctorName, dateTime, existingPrep }: VisitPrepSheetProps) {
  const [prep, setPrep] = useState<string | null>(existingPrep);
  const [loading, setLoading] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  async function generatePrep() {
    setLoading(true);
    const res = await fetch('/api/visit-prep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: appointmentId }),
    });
    const data = await res.json();
    if (data.prep_sheet) {
      setPrep(data.prep_sheet);
      setShowSheet(true);
    }
    setLoading(false);
  }

  // Simple markdown-to-html (bold, headers, lists, checkboxes)
  function renderMarkdown(text: string) {
    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-white mt-4 mb-1">{line.replace('### ', '')}</h3>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-white mt-5 mb-2">{line.replace('## ', '')}</h2>;
      if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.replace('# ', '')}</h1>;

      // Checkboxes
      if (line.match(/^- \[ \]/)) return (
        <label key={i} className="flex items-start gap-2 py-0.5 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" className="mt-1 accent-blue-500" />
          <span>{line.replace(/^- \[ \] /, '')}</span>
        </label>
      );

      // Bullet points
      if (line.match(/^[-*] /)) {
        const content = line.replace(/^[-*] /, '');
        // Bold text within
        const parts = content.split(/(\*\*.*?\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="text-white">{part.slice(2, -2)}</strong>;
          }
          return part;
        });
        return <li key={i} className="text-sm text-[var(--text-secondary)] ml-4 py-0.5 list-disc">{parts}</li>;
      }

      // Table rows (simple pipe format)
      if (line.includes('|') && !line.match(/^[-|: ]+$/)) {
        const cells = line.split('|').filter(Boolean).map((c) => c.trim());
        return (
          <div key={i} className="grid gap-2 text-xs py-1 border-b border-white/[0.04]" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
            {cells.map((cell, j) => (
              <span key={j} className={j === 0 ? 'text-white font-medium' : 'text-[var(--text-secondary)]'}>{cell}</span>
            ))}
          </div>
        );
      }

      // Skip table separator lines
      if (line.match(/^[-|: ]+$/)) return null;

      // Empty lines
      if (!line.trim()) return <div key={i} className="h-2" />;

      // Regular paragraphs with bold support
      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} className="text-white">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      return <p key={i} className="text-sm text-[var(--text-secondary)] py-0.5">{parts}</p>;
    });
  }

  return (
    <>
      <button
        onClick={prep ? () => setShowSheet(true) : generatePrep}
        disabled={loading}
        className="w-full text-center py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generating prep sheet...
          </span>
        ) : prep ? (
          'View Prep Sheet'
        ) : (
          'Generate Visit Prep'
        )}
      </button>

      {/* Full-screen prep sheet overlay */}
      {showSheet && prep && (
        <div className="fixed inset-0 z-50 bg-[#0f172a] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-[#0f172a]/95 backdrop-blur-lg border-b border-white/[0.06] px-5 py-3 flex items-center justify-between z-10">
            <div>
              <h1 className="text-white font-bold text-base">Visit Prep Sheet</h1>
              <p className="text-[var(--text-muted)] text-xs">
                {doctorName}{dateTime ? ` — ${new Date(dateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (typeof navigator.share === 'function') {
                    navigator.share({ title: `Visit Prep — ${doctorName}`, text: prep });
                  } else {
                    navigator.clipboard.writeText(prep);
                  }
                }}
                className="p-2 rounded-lg bg-white/[0.06] text-[var(--text-secondary)] hover:text-white transition-colors"
                title="Share or copy"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935-2.186Z" />
                </svg>
              </button>
              <button
                onClick={() => setShowSheet(false)}
                className="p-2 rounded-lg bg-white/[0.06] text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-6 max-w-lg mx-auto">
            {renderMarkdown(prep)}

            {/* Post-visit section */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <h2 className="text-base font-bold text-white mb-2">After the Visit</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                When you get home, tell CareCompanion what happened and any changes the doctor made.
              </p>
              <a
                href={`/chat?prompt=${encodeURIComponent(`I just got back from my appointment with ${doctorName}. Here's what happened:`)}`}
                className="block w-full text-center py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.1] transition-colors"
              >
                Log Visit Notes
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
