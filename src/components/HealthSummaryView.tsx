'use client';

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCsrfToken } from '@/components/CsrfProvider';

interface HealthSummaryViewProps {
  patientName: string;
}

export function HealthSummaryView({ patientName }: HealthSummaryViewProps) {
  const { showToast } = useToast();
  const csrfToken = useCsrfToken();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateSummary() {
    setLoading(true);
    try {
      const res = await fetch('/api/health-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to generate summary');
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        showToast('Summary generated', 'success');
      }
    } catch {
      showToast('Failed to generate summary', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!summary) return;
    // Try to generate a shareable link first
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ type: 'health_summary' }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (typeof navigator.share === 'function') {
          navigator.share({ title: `Health Summary — ${patientName}`, url });
        } else {
          navigator.clipboard.writeText(url);
        }
        showToast('Summary shared', 'success');
        return;
      }
    } catch {
      // Fall back to text sharing
    }
    if (typeof navigator.share === 'function') {
      navigator.share({ title: `Health Summary — ${patientName}`, text: summary });
    } else {
      navigator.clipboard.writeText(summary);
    }
    showToast('Summary shared', 'success');
  }

  function handlePrint() {
    if (!summary) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Health Summary — ${patientName}</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
        h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; }
        h2 { font-size: 16px; color: #444; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0; }
        th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #eee; }
        th { font-weight: 600; color: #555; }
        li { margin: 2px 0; }
        .abnormal { color: #dc2626; font-weight: 600; }
        @media print { body { margin: 20px; } }
      </style></head><body>
      ${markdownToHtml(summary)}
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  function handleDownloadPDF() {
    if (!summary) return;
    const html = `
      <html><head><title>Health Summary — ${patientName}</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; line-height: 1.6; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #6366F1; padding-bottom: 12px; margin-bottom: 24px; }
        .header h1 { font-size: 20px; color: #1a1a1a; margin: 0; }
        .header .date { font-size: 11px; color: #888; }
        .badge { display: inline-block; background: #6366F1; color: white; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px; }
        h2 { font-size: 15px; color: #6366F1; margin-top: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        h3 { font-size: 13px; color: #444; margin-top: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
        th { font-weight: 600; color: #6366F1; background: #f8f7ff; }
        li { margin: 3px 0; }
        .abnormal { color: #dc2626; font-weight: 600; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #999; text-align: center; }
        .disclaimer { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #92400e; margin-top: 20px; }
      </style></head><body>
      <div class="header">
        <div>
          <div class="badge">CareCompanion AI</div>
          <h1>Health Summary — ${patientName}</h1>
        </div>
        <div class="date">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
      ${markdownToHtml(summary)}
      <div class="disclaimer">
        This summary was generated by CareCompanion AI for informational purposes only. It is not a substitute for professional medical advice. Please verify all information with your healthcare provider.
      </div>
      <div class="footer">
        CareCompanion AI &middot; carecompanionai.org &middot; Generated ${new Date().toLocaleString()}
      </div>
      </body></html>
    `;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    // Auto-trigger print (save as PDF) after a short delay for rendering
    setTimeout(() => win.print(), 500);
  }

  // Simple markdown to HTML
  function markdownToHtml(md: string): string {
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(Boolean).map((c) => c.trim());
        return '<tr>' + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>';
      })
      .replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>')
      .replace(/^(?!<[hultro])(.*\S.*)$/gm, '<p>$1</p>')
      .replace(/\n{2,}/g, '\n');
  }

  // Render markdown for the in-app view
  function renderMarkdown(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-white mt-4 mb-1">{line.replace('### ', '')}</h3>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-white mt-5 mb-2">{line.replace('## ', '')}</h2>;
      if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.replace('# ', '')}</h1>;
      if (line.match(/^[-*] /)) {
        const content = line.replace(/^[-*] /, '');
        const parts = content.split(/(\*\*.*?\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className="text-white">{part.slice(2, -2)}</strong>;
          return part;
        });
        return <li key={i} className="text-sm text-[var(--text-secondary)] ml-4 py-0.5 list-disc">{parts}</li>;
      }
      if (line.includes('|') && !line.match(/^[-|: ]+$/)) {
        const cells = line.split('|').filter(Boolean).map((c) => c.trim());
        return (
          <div key={i} className="grid gap-2 text-xs py-1 border-b border-white/[0.04]" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
            {cells.map((cell, j) => (
              <span key={j} className={`${j === 0 ? 'text-white font-medium' : 'text-[var(--text-secondary)]'} ${cell.includes('⚠') ? 'text-amber-400' : ''}`}>{cell}</span>
            ))}
          </div>
        );
      }
      if (line.match(/^[-|: ]+$/)) return null;
      if (!line.trim()) return <div key={i} className="h-2" />;
      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className="text-white">{part.slice(2, -2)}</strong>;
        return part;
      });
      return <p key={i} className="text-sm text-[var(--text-secondary)] py-0.5">{parts}</p>;
    });
  }

  return (
    <div className="px-5 py-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white mb-1">Health Summary</h2>
      <p className="text-xs text-[var(--text-muted)] mb-5">
        Generate a comprehensive summary of {patientName}&apos;s health to share with doctors.
      </p>

      {!summary ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-2">Generate Health Summary</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-xs mx-auto">
            Creates a complete summary including medications, lab results, conditions, providers, and recent health trends.
          </p>
          <button
            onClick={generateSummary}
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white font-semibold disabled:opacity-50 transition-opacity"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </span>
            ) : 'Generate Summary'}
          </button>
        </div>
      ) : (
        <>
          {/* Action bar */}
          <div className="flex gap-2 mb-5">
            <button onClick={handleDownloadPDF}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save PDF
            </button>
            <button onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.1] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Print
            </button>
            <button onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.1] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935-2.186Z" />
              </svg>
              Share
            </button>
            <button onClick={() => setSummary(null)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.1] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              Regenerate
            </button>
          </div>

          {/* Summary content */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            {renderMarkdown(summary)}
          </div>
        </>
      )}
    </div>
  );
}
