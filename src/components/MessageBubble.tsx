'use client';

import type { UIMessage } from 'ai';
import { ToolResult } from '@/components/ToolResult';

interface MessageBubbleProps {
  message: UIMessage & { createdAt?: Date };
}

function renderMarkdown(text: string) {
  // Simple markdown: bold, italic, lists, headers
  return text.split('\n').map((line, i) => {
    // Headers
    if (line.startsWith('### ')) return <h4 key={i} className="text-[#f1f5f9] font-semibold text-sm mt-2 mb-1">{line.slice(4)}</h4>;
    if (line.startsWith('## ')) return <h3 key={i} className="text-[#f1f5f9] font-semibold text-base mt-2 mb-1">{line.slice(3)}</h3>;
    // List items
    if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc">{formatInline(line.slice(2))}</li>;
    if (/^\d+\. /.test(line)) return <li key={i} className="ml-4 list-decimal">{formatInline(line.replace(/^\d+\. /, ''))}</li>;
    // Empty line
    if (!line.trim()) return <br key={i} />;
    // Regular paragraph
    return <p key={i} className="mb-1">{formatInline(line)}</p>;
  });
}

function formatInline(text: string): React.ReactNode[] {
  // Bold and italic
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-[#f1f5f9]">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const textParts = message.parts?.filter((p): p is { type: 'text'; text: string } => p.type === 'text') || [];
  const toolParts = message.parts?.filter((p) => p.type === 'tool-invocation') || [];

  const text = textParts.map((p) => p.text).join('');
  const hasContent = text || toolParts.length > 0;

  if (!hasContent) return null;

  if (isUser) {
    return (
      <div className="flex justify-end mb-3 animate-slide-up">
        <div className="max-w-[75%] bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-[16px_16px_4px_16px] px-4 py-2.5 text-white text-sm leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start mb-3 animate-slide-up">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
        AI
      </div>
      <div className="flex-1 max-w-[80%]">
        {/* Tool results */}
        {toolParts.map((part) => {
          const toolPart = part as unknown as { type: 'tool-invocation'; toolInvocation: { toolName: string; state: string; result?: Record<string, unknown> } };
          const { toolName, state, result } = toolPart.toolInvocation;

          if (state === 'result' && result) {
            return <ToolResult key={toolName + JSON.stringify(result)} toolName={toolName} result={result} />;
          }

          // Show a pending state while tool is running
          if (state === 'call' || state === 'partial-call') {
            return (
              <div key={toolName} className="my-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <span className="animate-pulse">⏳</span>
                <span>Working on it...</span>
              </div>
            );
          }

          return null;
        })}

        {/* Text content */}
        {text && (
          <div className="bg-white/[0.06] border border-white/[0.08] rounded-[4px_16px_16px_16px] px-4 py-2.5 text-[#e2e8f0] text-sm leading-relaxed">
            {renderMarkdown(text)}
          </div>
        )}

        {message.createdAt && (
          <p className="text-[11px] mt-1.5 text-[var(--text-muted)]">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
