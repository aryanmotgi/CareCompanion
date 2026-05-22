'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessageBubble } from '@/components/MessageBubble';
import { TypingIndicator } from '@/components/TypingIndicator';
import { DocumentScanner } from '@/components/DocumentScanner';
import { ChatSearch } from '@/components/ChatSearch';
import { useVoiceInput } from '@/hooks/useVoiceInput';

interface RecentConversation {
  id: string;
  title: string | null;
  lastMessagePreview: string | null;
  updatedAt: Date | null;
}

interface ChatInterfaceProps {
  initialMessages: UIMessage[];
  patientName?: string;
  recentConversations?: RecentConversation[];
  nadirCycle?: { dayOfCycle: number; cycleNumber: number } | null;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getMessageText(msg: UIMessage): string {
  for (const part of msg.parts) {
    if (part.type === 'text' && 'text' in part) {
      return (part as { type: 'text'; text: string }).text;
    }
  }
  return '';
}

export function ChatInterface({ initialMessages, patientName, recentConversations = [], nadirCycle = null }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [promptSent, setPromptSent] = useState(false);
  const [, setIsNewChat] = useState(false);
  const [confirmingNewChat, setConfirmingNewChat] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [pulsingCard, setPulsingCard] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchParams = useSearchParams();
  const router = useRouter();
  const promptFromUrl = searchParams.get('prompt');

  const { messages, sendMessage, status, error, regenerate, stop, setMessages } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // Read the CSRF cookie at request time so the token is always fresh.
      headers: () => ({
        'x-csrf-token': document.cookie.match(/(^| )cc-csrf-token=([^;]+)/)?.[2] ?? '',
      }),
    }),
  });

  const handleNewChat = async () => {
    if (messages.length === 0) return;
    if (!confirmingNewChat) {
      setConfirmingNewChat(true);
      setTimeout(() => setConfirmingNewChat(false), 3000);
      return;
    }
    setConfirmingNewChat(false);

    // Extract title + preview from current messages for archiving
    const firstUserMsg = messages.find(m => m.role === 'user');
    const title = firstUserMsg ? getMessageText(firstUserMsg).slice(0, 100) : 'Conversation';
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    const lastMessagePreview = lastAssistantMsg ? getMessageText(lastAssistantMsg).slice(0, 200) : '';

    setMessages([]);
    setIsNewChat(true);
    setInput('');

    // Archive conversation, then refresh server component to update recent list
    try {
      await fetch('/api/chat/history', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': document.cookie.match(/(^| )cc-csrf-token=([^;]+)/)?.[2] ?? '',
        },
        body: JSON.stringify({ title, lastMessagePreview }),
      });
    } catch {}
    router.refresh();
  };

  const isStreaming = status === 'streaming';
  const isLoading = status === 'submitted' || isStreaming;

  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceInput({
    onTranscript: (text) => {
      setInput((prev) => (prev ? prev + ' ' + text : text));
    },
    onInterimTranscript: (text) => {
      setInput(text);
    },
  });

  // Fix hydration mismatch — voice button only renders after mount
  useEffect(() => { setMounted(true) }, []);

  // Cycle the pulsing emoji card every 3s
  useEffect(() => {
    const interval = setInterval(() => setPulsingCard(p => (p + 1) % 4), 3000);
    return () => clearInterval(interval);
  }, []);

  // Cmd+F / Ctrl+F opens search; Escape closes it
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showSearch]);

  const handleScrollToMessage = (messageId: string) => {
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight flash
      el.classList.add('ring-2', 'ring-[#6366F1]/60', 'rounded-xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#6366F1]/60', 'rounded-xl');
      }, 2000);
    }
  };

  // Allowlisted prompts for auto-send from URL
  const ALLOWED_PROMPTS = new Set([
    'Prepare for my appointment',
    'Explain my lab results',
    'What should I ask my doctor?',
    'How are my vitals?',
    'Prepare for my next appointment',
    'Explain my medications',
    'Help me understand my diagnosis',
    'Log today\'s symptoms',
    'Prep for oncology appointment',
    'Track medication side effects',
    'Review my treatment timeline',
    'Explain my tumor markers',
    'What should I expect this chemo cycle?',
    'Help me understand my treatment plan',
    'What does low hemoglobin mean?',
    'Prep me for my oncology appointment',
    'What side effects should I watch for?',
  ])

  const isAllowedPrompt = (prompt: string) =>
    ALLOWED_PROMPTS.has(prompt) ||
    prompt.startsWith('Help me prepare for my ') ||
    prompt.startsWith('Help me manage my ') ||
    prompt.startsWith('Explain my ') ||
    prompt.startsWith('Help me understand') ||
    prompt.startsWith('I have a scheduling conflict') ||
    prompt.startsWith('Help me find local') ||
    prompt.startsWith('Add my ') ||
    prompt.startsWith('Update my ') ||
    prompt.startsWith('Log my ')

  // Auto-send prompt from URL (from dashboard or alert cards)
  useEffect(() => {
    if (promptFromUrl && !promptSent && isAllowedPrompt(promptFromUrl)) {
      setPromptSent(true);
      sendMessage({ text: promptFromUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptFromUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;
    setInput('');
    sendMessage({ text: messageText });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    { icon: '🧪', text: 'Explain my tumor markers' },
    { icon: '❤️', text: 'What does low hemoglobin mean?' },
    { icon: '📋', text: 'Prep me for my oncology appointment' },
    { icon: '⚠️', text: 'What side effects should I watch for?' },
  ];

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - var(--top-bar-height, 56px) - var(--bottom-nav-height, 96px))' }}>
      {/* Header bar — New Chat + Search buttons */}
      <div className="flex justify-end gap-2 px-4 sm:px-8 pt-3 pb-1">
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[var(--text-secondary)] text-xs hover:bg-white/[0.08] hover:text-[var(--text)] transition-colors"
          title="Search messages (Cmd+F)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          Search
        </button>
        <button
          onClick={handleNewChat}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
            confirmingNewChat
              ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
              : 'bg-white/[0.04] border-white/[0.08] text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text)]'
          }`}
          aria-label={confirmingNewChat ? 'Click again to clear conversation' : 'Start a new conversation'}
          title={confirmingNewChat ? 'Click again to confirm' : 'Start a new conversation'}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {confirmingNewChat ? 'Confirm?' : 'New Chat'}
        </button>
      </div>
      {/* Chat search overlay */}
      <ChatSearch
        messages={messages}
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onScrollToMessage={handleScrollToMessage}
      />
      {/* Nadir context card — gated to days 7-14 server-side */}
      {nadirCycle && (
        <div
          role="note"
          aria-live="polite"
          className="mx-4 sm:mx-6 lg:mx-8 mt-2 mb-1"
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: 'linear-gradient(180deg, rgba(254,243,199,0.08) 0%, rgba(180,83,9,0.10) 100%)',
            border: '1px solid rgba(180, 83, 9, 0.32)',
            boxShadow: '0 1px 8px rgba(120, 53, 15, 0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }} aria-hidden="true">🌡️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', letterSpacing: '-0.01em', marginBottom: 2 }}>
              {patientName ? `${patientName} is in nadir` : 'In nadir'} — Day {nadirCycle.dayOfCycle} of cycle
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'rgba(252,211,77,0.85)' }}>
              Immune system is at its lowest. Mention any fever, chills, or unusual symptoms right away.
            </div>
          </div>
        </div>
      )}
      {/* SR-only status region: announces when streaming completes without reading every token */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isStreaming ? '' : messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' ? 'Response received' : ''}
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll px-4 sm:px-6 lg:px-8 py-6" role="log" aria-label="Conversation" aria-live="off">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {/* Sparkle icon */}
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(167,139,250,0.15) 100%)',
              border: '1px solid rgba(167,139,250,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              boxShadow: '0 0 40px rgba(139,92,246,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
              position: 'relative',
              animation: 'chatFadeUp 0.4s ease forwards',
              opacity: 0,
            }}>
              <div style={{ position: 'absolute', inset: -12, borderRadius: 34, background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', filter: 'blur(8px)' }} />
              <svg style={{ width: 36, height: 36, color: '#A78BFA', position: 'relative' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
            </div>

            {/* Greeting */}
            <p
              className="text-[12px] font-medium uppercase tracking-widest mb-1"
              style={{ color: '#A78BFA', opacity: 0, animation: 'chatFadeUp 0.4s ease 60ms forwards' }}
            >
              {getGreeting()}
            </p>

            {/* Heading */}
            <h2
              className="font-display text-[22px] font-bold text-[var(--text)] mb-2"
              style={{ letterSpacing: '-0.02em', opacity: 0, animation: 'chatFadeUp 0.4s ease 100ms forwards' }}
            >
              Ask anything about {patientName ? `${patientName}’s care` : 'your care'}
            </h2>

            {/* Subtext */}
            <p
              className="text-[var(--text-secondary)] mb-5 text-[13px] leading-relaxed max-w-[260px]"
              style={{ opacity: 0, animation: 'chatFadeUp 0.4s ease 140ms forwards' }}
            >
              Medications, lab results, appointments, side effects — I know the full picture.
            </p>

            {/* 2×2 prompt grid */}
            <div
              className="grid grid-cols-2 gap-2 w-full max-w-[320px]"
              style={{ opacity: 0, animation: 'chatFadeUp 0.4s ease 180ms forwards' }}
            >
              {quickPrompts.map((prompt, i) => (
                <button
                  key={prompt.text}
                  onClick={() => handleSend(prompt.text)}
                  className="flex flex-col gap-1.5 px-3 py-3 rounded-xl text-left active:scale-95 transition-all min-h-[72px]"
                  style={{
                    background: 'rgba(167,139,250,0.06)',
                    border: '1px solid rgba(167,139,250,0.15)',
                    boxShadow: '0 1px 8px rgba(99,102,241,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <span className={pulsingCard === i ? 'emoji-pulse' : ''} style={{ fontSize: 16, lineHeight: 1 }}>
                    {prompt.icon}
                  </span>
                  <span className="text-[12px] font-medium leading-snug text-[var(--text-secondary)]" style={{ lineHeight: '1.35' }}>
                    {prompt.text}
                  </span>
                </button>
              ))}
            </div>

            {/* Recent conversations */}
            {recentConversations.length > 0 && (
              <div
                className="w-full max-w-[320px] mt-5"
                style={{ opacity: 0, animation: 'chatFadeUp 0.4s ease 260ms forwards' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-left mb-1.5 px-0.5" style={{ color: 'rgba(167,139,250,0.45)' }}>
                  Recent
                </p>
                <div className="flex flex-col gap-0.5">
                  {recentConversations.map((convo) => (
                    <div
                      key={convo.id}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(167,139,250,0.06)' }}
                    >
                      <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(167,139,250,0.4)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                      </svg>
                      <span className="flex-1 truncate text-[12px] text-left" style={{ color: 'rgba(226,232,240,0.6)' }}>
                        {convo.title ?? 'Conversation'}
                      </span>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(167,139,250,0.35)' }}>
                        {formatRelativeTime(convo.updatedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                ref={(el) => {
                  if (el) {
                    messageRefs.current.set(message.id, el);
                  } else {
                    messageRefs.current.delete(message.id);
                  }
                }}
                className="transition-all duration-300"
              >
                <MessageBubble message={message} />
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <TypingIndicator />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 sm:px-6 lg:px-8 py-3 bg-red-500/10 border-t border-red-500/20" role="alert" aria-live="assertive">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <p className="text-sm text-red-400">Having trouble connecting. You can try again below.</p>
            <button onClick={() => regenerate()} className="text-sm font-medium text-red-400 hover:text-red-300 underline">
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t px-4 sm:px-6 lg:px-8 py-4" style={{ borderColor: 'rgba(139,92,246,0.1)', background: 'linear-gradient(to top, rgba(10,8,20,0.95), rgba(10,8,20,0.8))', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-5xl mx-auto">
          {/* Glass input bar */}
          <div className="flex items-center gap-2 rounded-2xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: inputFocused ? '0 0 0 2px rgba(139,92,246,0.4), 0 0 20px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 0 20px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.05)', transition: 'box-shadow 0.2s ease' }}>
            {/* Scan button */}
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center justify-center w-11 h-11 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors flex-shrink-0"
              title="Upload document to chat"
              aria-label="Upload document to chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
              </svg>
            </button>
            {/* Voice input button — wrapper always rendered to prevent layout shift */}
            <div style={{ width: '2.75rem', visibility: (mounted && voiceSupported) ? 'visible' : 'hidden', flexShrink: 0 }}>
              {mounted && voiceSupported && (
                <button
                  onClick={toggleListening}
                  className={`flex items-center justify-center w-11 h-11 transition-colors ${
                    isListening
                      ? 'text-red-400 animate-pulse'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                  }`}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </button>
              )}
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Ask about your care, how you're feeling, or what to expect…"
              aria-label="Message CareCompanion AI"
              data-testid="chat-input"
              className="flex-1 bg-transparent text-[#e2e8f0] text-sm outline-none placeholder:text-[#64748b] min-h-[32px]"
            />
            {isStreaming ? (
              <button
                onClick={() => stop()}
                className="w-11 h-11 rounded-full bg-white/[0.08] flex items-center justify-center text-[var(--text-secondary)] hover:bg-white/[0.12] transition-colors flex-shrink-0"
                aria-label="Stop response"
                title="Stop response"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white disabled:opacity-40 transition-opacity animate-press flex-shrink-0"
                aria-label="Send message"
                title="Send message"
                data-testid="send-button"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {showScanner && <DocumentScanner onClose={() => setShowScanner(false)} />}
    </div>
  );
}
