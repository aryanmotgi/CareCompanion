'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { useSearchParams } from 'next/navigation';
import { MessageBubble } from '@/components/MessageBubble';
import { TypingIndicator } from '@/components/TypingIndicator';
import { DocumentScanner } from '@/components/DocumentScanner';
import { ChatSearch } from '@/components/ChatSearch';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';

interface ChatInterfaceProps {
  initialMessages: UIMessage[];
  patientName: string;
}

export function ChatInterface({ initialMessages, patientName }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [promptSent, setPromptSent] = useState(false);
  const [, setIsNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchParams = useSearchParams();
  const promptFromUrl = searchParams.get('prompt');

  const { messages, sendMessage, status, error, regenerate, stop, setMessages } = useChat({
    messages: initialMessages,
  });

  const handleNewChat = () => {
    setMessages([]);
    setIsNewChat(true);
    setInput('');
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

  // Cmd+F / Ctrl+F opens search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
  ])

  const isAllowedPrompt = (prompt: string) =>
    ALLOWED_PROMPTS.has(prompt) ||
    prompt.startsWith('Help me prepare for my ') ||
    prompt.startsWith('Help me manage my ') ||
    prompt.startsWith('Explain my ') ||
    prompt.startsWith('Help me understand') ||
    prompt.startsWith('I have a scheduling conflict') ||
    prompt.startsWith('Help me find local')

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

  const starterPrompts = [
    { icon: '💉', text: 'What should I expect this chemo cycle?', desc: 'Side effects, timing, what to watch for' },
    { icon: '📊', text: 'Explain my tumor markers', desc: 'CEA, CA-125, PSA trends explained' },
    { icon: '📅', text: 'Prep for oncology appointment', desc: 'Questions to ask your oncologist' },
    { icon: '🧠', text: 'Help me understand my treatment plan', desc: 'Plain-language explanations' },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] lg:h-[calc(100dvh-100px)] -mx-4 sm:-mx-8 -mb-6">
      {/* Header bar — New Chat + Search buttons */}
      {messages.length > 0 && (
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[var(--text-secondary)] text-xs hover:bg-white/[0.08] hover:text-[var(--text)] transition-colors"
            title="Start a new conversation"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
          </button>
        </div>
      )}
      {/* Chat search overlay */}
      <ChatSearch
        messages={messages}
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onScrollToMessage={handleScrollToMessage}
      />
      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll px-4 sm:px-8 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#6366F1]/20 to-[#A78BFA]/20 rounded-2xl flex items-center justify-center mb-5 border border-[var(--border)]">
              <svg className="w-8 h-8 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-semibold text-[var(--text)] mb-2">
              Hi, how can I help?
            </h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-sm text-sm">
              Ask me anything about {patientName}&apos;s care, medications, appointments, or health records.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handleSend(prompt.text)}
                  className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-left hover:bg-[var(--bg-elevated)] hover:border-[#A78BFA]/20 transition-all active:scale-[0.97] group"
                >
                  <span className="text-lg">{prompt.icon}</span>
                  <span className="text-[13px] font-medium text-[var(--text)] group-hover:text-[#A78BFA] transition-colors leading-tight">{prompt.text}</span>
                  <span className="text-[11px] text-[var(--text-muted)] leading-tight">{prompt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
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
        <div className="px-4 sm:px-8 py-3 bg-red-500/10 border-t border-red-500/20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <p className="text-sm text-red-400">Something went wrong.</p>
            <button onClick={() => regenerate()} className="text-sm font-medium text-red-400 hover:text-red-800 underline">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-card)] px-4 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto">
          {/* Starter prompts — shown above input when conversation is empty */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handleSend(prompt.text)}
                  className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-elevated)] hover:border-[#A78BFA]/20 transition-colors animate-press"
                >
                  {prompt.icon} {prompt.text}
                </button>
              ))}
            </div>
          )}
          {/* Glass input bar */}
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
            {/* Scan button */}
            <button
              onClick={() => setShowScanner(true)}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors flex-shrink-0"
              title="Scan a document"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
              </svg>
            </button>
            {/* Voice input button */}
            {mounted && voiceSupported && (
              <button
                onClick={toggleListening}
                className={`p-1.5 transition-colors flex-shrink-0 ${
                  isListening
                    ? 'text-red-400 animate-pulse'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
              </button>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your health..."
              className="flex-1 bg-transparent text-[#e2e8f0] text-sm outline-none placeholder:text-[#64748b] min-h-[32px]"
            />
            {isStreaming ? (
              <button
                onClick={() => stop()}
                className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-[var(--text-secondary)] hover:bg-white/[0.12] transition-colors flex-shrink-0"
                title="Stop"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white disabled:opacity-40 transition-opacity animate-press flex-shrink-0"
                title="Send"
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
