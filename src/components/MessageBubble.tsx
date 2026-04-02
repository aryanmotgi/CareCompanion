'use client';

import type { UIMessage } from 'ai';

interface MessageBubbleProps {
  message: UIMessage & { createdAt?: Date };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const text = message.parts
    ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('') || '';

  if (!text) return null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-card-in`}>
      <div className={`max-w-[80%] px-4 py-3 ${
        isUser
          ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
          : 'bg-[var(--bg-card)] text-[var(--text)] rounded-2xl rounded-bl-md border border-[var(--border)]'
      }`}>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{text}</p>
        {message.createdAt && (
          <p className={`text-[11px] mt-1.5 ${isUser ? 'text-blue-200' : 'text-[var(--text-muted)]'}`}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
