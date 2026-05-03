'use client';

import { useState } from 'react';
import type { UIMessage } from 'ai';
import { ToolResult } from '@/components/ToolResult';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      aria-label={copied ? 'Copied to clipboard' : 'Copy message'}
      title={copied ? 'Copied!' : 'Copy message'}
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
        </svg>
      )}
    </button>
  );
}

interface MessageBubbleProps {
  message: UIMessage & { createdAt?: Date };
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    // Headers
    if (line.startsWith('### ')) return <h4 key={i} className="text-[var(--text)] font-semibold text-sm mt-3 mb-1">{formatInline(line.slice(4))}</h4>;
    if (line.startsWith('## ')) return <h3 key={i} className="text-[var(--text)] font-semibold text-base mt-3 mb-1">{formatInline(line.slice(3))}</h3>;
    // Code blocks (inline single-line)
    if (line.startsWith('```') && line.endsWith('```') && line.length > 6) {
      return <code key={i} className="block bg-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono text-[var(--text)] my-1">{line.slice(3, -3)}</code>;
    }
    // List items
    if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-[var(--text)]">{formatInline(line.slice(2))}</li>;
    if (/^\d+\. /.test(line)) return <li key={i} className="ml-4 list-decimal text-[var(--text)]">{formatInline(line.replace(/^\d+\. /, ''))}</li>;
    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') return <hr key={i} className="border-white/[0.1] my-2" />;
    // Empty line
    if (!line.trim()) return <div key={i} className="h-2" />;
    // Regular paragraph
    return <p key={i} className="mb-1">{formatInline(line)}</p>;
  });
}

function formatInline(text: string): React.ReactNode[] {
  // Handle inline code, bold, and italic
  const parts = text.split(/(`[^`]+`|\*\*.*?\*\*|\*.*?\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-white/[0.08] rounded px-1.5 py-0.5 text-xs font-mono text-[#A78BFA]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[var(--text)]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} className="text-[var(--text-secondary)]">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const textParts = message.parts?.filter((p): p is { type: 'text'; text: string } => p.type === 'text') || [];
  // AI SDK v6: tool parts use type `tool-<toolName>` instead of `tool-invocation`
  const toolParts = message.parts?.filter((p) => p.type.startsWith('tool-') && p.type !== 'tool-invocation') || [];

  const text = textParts.map((p) => p.text).join('');
  const hasContent = text || toolParts.length > 0;

  if (!hasContent) return null;

  if (isUser) {
    return (
      <div className="flex justify-end mb-3 animate-slide-up">
        <div className="chat-bubble-user max-w-[85%] sm:max-w-[75%] bg-gradient-to-br from-[#6366F1] to-[#A78BFA] rounded-[16px_16px_4px_16px] px-4 py-2.5 text-white text-sm leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start mb-3 animate-slide-up">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold" aria-hidden="true">
        AI
      </div>
      <div className="flex-1 chat-bubble-ai max-w-[90%] sm:max-w-[80%] group">
        {/* Tool results */}
        {toolParts.map((part) => {
          const toolPart = part as unknown as { type: string; toolName?: string; state?: string; result?: Record<string, unknown>; input?: Record<string, unknown> };
          const toolName = toolPart.toolName ?? toolPart.type.replace(/^tool-/, '');
          const state = toolPart.state;
          const result = toolPart.result;

          if (state === 'result' && result) {
            return <ToolResult key={toolName + JSON.stringify(result)} toolName={toolName} result={result} />;
          }

          if (state === 'call' || state === 'partial-call') {
            return (
              <div key={toolName} className="my-2 flex items-center gap-2 text-sm text-[var(--text-muted)]" role="status" aria-label="Looking up your information">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Looking up your information…</span>
              </div>
            );
          }

          return null;
        })}

        {/* Text content */}
        {text && (
          <div className="bg-white/[0.06] border border-white/[0.08] rounded-[4px_16px_16px_16px] px-4 py-2.5 text-[var(--text)] text-sm leading-relaxed">
            {renderMarkdown(text)}
          </div>
        )}

        <div className="flex items-center gap-1 mt-1.5">
          {message.createdAt && (
            <p className="text-[11px] text-[var(--text-muted)]">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
          {text && <CopyButton text={text} />}
        </div>
      </div>
    </div>
  );
}
