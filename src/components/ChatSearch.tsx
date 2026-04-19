'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { UIMessage } from 'ai';

interface SearchResult {
  messageId: string;
  role: 'user' | 'assistant';
  text: string;
  matchStart: number;
  matchEnd: number;
  createdAt?: Date;
}

interface ChatSearchProps {
  messages: UIMessage[];
  isOpen: boolean;
  onClose: () => void;
  onScrollToMessage: (messageId: string) => void;
}

function extractText(message: UIMessage): string {
  const textParts = message.parts?.filter(
    (p): p is { type: 'text'; text: string } => p.type === 'text'
  ) || [];
  return textParts.map((p) => p.text).join('');
}

function highlightMatch(text: string, start: number, end: number) {
  const match = text.slice(start, end);
  // Trim preview to ~80 chars around the match
  const previewStart = Math.max(0, start - 40);
  const previewEnd = Math.min(text.length, end + 40);
  const trimmedBefore = (previewStart > 0 ? '...' : '') + text.slice(previewStart, start);
  const trimmedAfter = text.slice(end, previewEnd) + (previewEnd < text.length ? '...' : '');

  return (
    <span className="text-sm leading-relaxed">
      <span className="text-[#94a3b8]">{trimmedBefore}</span>
      <span className="bg-[#6366F1]/30 text-[#f1f5f9] rounded px-0.5">{match}</span>
      <span className="text-[#94a3b8]">{trimmedAfter}</span>
    </span>
  );
}

export function ChatSearch({ messages, isOpen, onClose, onScrollToMessage }: ChatSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to let the animation start
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      setQuery('');
      setResults([]);
      setDebouncedQuery('');
    }
  }, [isOpen]);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search messages when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const needle = debouncedQuery.toLowerCase();
    const found: SearchResult[] = [];

    for (const message of messages) {
      const text = extractText(message);
      if (!text) continue;

      const lowerText = text.toLowerCase();
      const idx = lowerText.indexOf(needle);
      if (idx !== -1) {
        found.push({
          messageId: message.id,
          role: message.role as 'user' | 'assistant',
          text,
          matchStart: idx,
          matchEnd: idx + needle.length,
          createdAt: (message as UIMessage & { createdAt?: Date }).createdAt
            ? new Date((message as UIMessage & { createdAt?: Date }).createdAt!)
            : undefined,
        });
      }
    }

    setResults(found);
  }, [debouncedQuery, messages]);

  // Keyboard shortcut: Escape to close (works even when input not focused)
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="relative z-20" role="search" aria-label="Search messages">
      {/* Search bar */}
      <div className="px-4 sm:px-8 pt-3 pb-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2.5">
            {/* Search icon */}
            <svg className="w-4 h-4 text-[#94a3b8] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search messages..."
              className="flex-1 bg-transparent text-[#f1f5f9] text-sm outline-none placeholder:text-[#64748b]"
            />
            {/* Result count */}
            {debouncedQuery.trim() && (
              <span className="text-xs text-[#94a3b8] flex-shrink-0 tabular-nums">
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </span>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1 text-[#94a3b8] hover:text-[#f1f5f9] transition-colors flex-shrink-0"
              aria-label="Close search"
              title="Close search (Esc)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Results dropdown */}
          {results.length > 0 && (
            <div className="mt-2 bg-[#1e293b] border border-white/[0.08] rounded-xl shadow-xl max-h-72 overflow-y-auto chat-scroll">
              {results.map((result) => (
                <button
                  key={result.messageId}
                  onClick={() => {
                    onScrollToMessage(result.messageId);
                    onClose();
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-b-0 group"
                >
                  {/* Role badge + timestamp */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-medium uppercase tracking-wider ${
                      result.role === 'user' ? 'text-[#A78BFA]' : 'text-[#6366F1]'
                    }`}>
                      {result.role === 'user' ? 'You' : 'AI'}
                    </span>
                    {result.createdAt && (
                      <span className="text-[11px] text-[#64748b]">
                        {result.createdAt.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        {' '}
                        {result.createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {/* Preview with highlighted match */}
                  <div className="line-clamp-2">
                    {highlightMatch(result.text, result.matchStart, result.matchEnd)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {debouncedQuery.trim() && results.length === 0 && (
            <div className="mt-2 bg-[#1e293b] border border-white/[0.08] rounded-xl shadow-xl px-4 py-6 text-center">
              <p className="text-sm text-[#94a3b8]">No messages match &ldquo;{debouncedQuery}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
