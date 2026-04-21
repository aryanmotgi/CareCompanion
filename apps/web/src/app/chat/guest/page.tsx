'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Link from 'next/link';
import { MessageBubble } from '@/components/MessageBubble';
import { TypingIndicator } from '@/components/TypingIndicator';

const STARTER_PROMPTS = [
  { icon: '💊', text: 'What side effects should I expect from chemo?', desc: 'Common regimens explained' },
  { icon: '🔬', text: 'Help me understand my tumor markers', desc: 'CEA, CA-125, HER2, PSA and more' },
  { icon: '📋', text: 'What questions should I ask my oncologist?', desc: 'Prep for your next visit' },
  { icon: '🤝', text: 'Tips for supporting a family member with cancer', desc: 'Caregiver guidance' },
];

export default function GuestChatPage() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat/guest' }),
  });

  const isStreaming = status === 'streaming';
  const isLoading = status === 'submitted' || isStreaming;
  const messageCount = messages.filter((m) => m.role === 'user').length;
  const remaining = Math.max(0, 15 - messageCount);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    setInput('');
    sendMessage({ text: msg });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen min-h-dvh flex flex-col" style={{ background: '#0c0c1a' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">CareCompanion</span>
          </Link>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/40">
            Guest
          </span>
        </div>
        <Link
          href="/login"
          className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white font-semibold hover:opacity-90 transition-opacity"
        >
          Sign up free
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#6366F1]/20 to-[#A78BFA]/20 rounded-2xl flex items-center justify-center mb-5 border border-white/[0.08]">
              <svg className="w-8 h-8 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ask anything about cancer care</h2>
            <p className="text-sm text-white/40 mb-8 max-w-sm">
              No account needed. Ask about chemo side effects, lab results, medications, or how to support a loved one.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handleSend(prompt.text)}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-left hover:bg-white/[0.07] hover:border-[#A78BFA]/20 transition-all group"
                >
                  <span className="text-xl flex-shrink-0">{prompt.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-white/90 group-hover:text-[#A78BFA] transition-colors leading-tight">{prompt.text}</p>
                    <p className="text-xs text-white/30 mt-0.5">{prompt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <TypingIndicator />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Upgrade nudge — shown after 5+ messages */}
      {messageCount >= 5 && (
        <div className="px-4 sm:px-6 pb-2">
          <div className="max-w-3xl mx-auto rounded-xl bg-gradient-to-r from-[#6366F1]/10 to-[#A78BFA]/10 border border-[#A78BFA]/20 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-white/60">
              <span className="text-white font-medium">Create a free account</span> to save this conversation, track your medications, and get personalized care guidance.
            </p>
            <Link
              href="/login"
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Sign up free
            </Link>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 sm:px-6 py-2">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm text-red-400 text-center">Something went wrong. Please try again.</p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/[0.06] px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Rate limit notice */}
          {remaining <= 5 && remaining > 0 && (
            <p className="text-xs text-white/30 text-center">
              {remaining} guest message{remaining === 1 ? '' : 's'} remaining.{' '}
              <Link href="/login" className="text-[#A78BFA] hover:underline">Sign up free</Link> for unlimited.
            </p>
          )}
          {remaining === 0 && (
            <p className="text-xs text-amber-400/80 text-center">
              Guest limit reached.{' '}
              <Link href="/login" className="text-[#A78BFA] hover:underline">Create a free account</Link> to continue.
            </p>
          )}
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about cancer care, medications, side effects..."
              disabled={remaining === 0}
              className="flex-1 bg-transparent text-[#e2e8f0] text-sm outline-none placeholder:text-[#64748b] min-h-[32px] disabled:opacity-40"
            />
            {isStreaming ? (
              <button
                onClick={() => stop()}
                className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-white/50 hover:bg-white/[0.12] transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading || remaining === 0}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white disabled:opacity-40 transition-opacity flex-shrink-0"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-center text-[11px] text-white/20">
            Not a doctor. Always consult your care team for medical decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
