'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ActionCard {
  icon: string;
  label: string;
  href: string;
}

const PRIORITY_CARDS: Record<string, ActionCard> = {
  medications:  { icon: '💊', label: 'Set up medication reminders',  href: '/care' },
  appointments: { icon: '📅', label: 'Prep for your next appointment', href: '/care' },
  lab_results:  { icon: '🔬', label: 'Review your lab results',       href: '/labs' },
  side_effects: { icon: '📋', label: 'Log today\'s side effects',      href: '/journal' },
  insurance:    { icon: '💰', label: 'Check your insurance claims',    href: '/insurance' },
  emotional:    { icon: '💜', label: 'Chat with your AI companion',    href: '/chat' },
};

const DEFAULT_CARDS: ActionCard[] = [
  { icon: '🤖', label: 'Ask the AI',              href: '/chat' },
  { icon: '📋', label: 'Add medications',          href: '/medications' },
];

export function OnboardingWelcomeBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cards, setCards] = useState<ActionCard[]>([]);

  useEffect(() => {
    const justCompleted = localStorage.getItem('onboarding_just_completed');
    const alreadyDismissed = localStorage.getItem('welcome_banner_dismissed');

    if (justCompleted !== 'true' || alreadyDismissed === 'true') return;

    // Parse priorities and build action cards
    let actionCards: ActionCard[] = [];
    try {
      const raw = localStorage.getItem('onboarding_priorities');
      if (raw) {
        const priorities: string[] = JSON.parse(raw);
        actionCards = priorities
          .filter((p) => p in PRIORITY_CARDS)
          .slice(0, 3)
          .map((p) => PRIORITY_CARDS[p]);
      }
    } catch {
      // fall through to defaults
    }

    if (actionCards.length === 0) {
      actionCards = DEFAULT_CARDS;
    }

    setCards(actionCards);
    setVisible(true);

    // Trigger opacity transition after a brief delay
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem('welcome_banner_dismissed', 'true');
    setMounted(false);
    // Wait for fade-out before removing from DOM
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  return (
    <div
      className="px-4 sm:px-5 pt-5 sm:pt-6"
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 300ms ease',
      }}
    >
      <div
        className="relative rounded-2xl p-px overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #6366F1 0%, #A78BFA 100%)',
        }}
      >
        {/* Inner card */}
        <div
          className="rounded-[calc(1rem-1px)] p-4 sm:p-5"
          style={{ background: 'var(--bg-card, #0f172a)' }}
        >
          {/* Dismiss button */}
          <button
            onClick={dismiss}
            aria-label="Dismiss welcome banner"
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-muted,#64748b)] hover:text-[var(--text-secondary,#94a3b8)] hover:bg-white/[0.08] transition-colors text-base leading-none"
          >
            ×
          </button>

          {/* Heading */}
          <h2
            className="text-sm font-semibold pr-8 mb-3"
            style={{
              background: 'linear-gradient(90deg, #6366F1, #A78BFA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Welcome to CareCompanion! Here&apos;s where to start.
          </h2>

          {/* Action cards */}
          <div className="flex flex-wrap gap-2">
            {cards.map((card) => (
              <Link
                key={card.href + card.label}
                href={card.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:bg-white/[0.08] active:scale-95"
                style={{
                  borderColor: 'var(--border, rgba(255,255,255,0.1))',
                  color: 'var(--text-secondary, #94a3b8)',
                  background: 'rgba(99,102,241,0.08)',
                }}
              >
                <span>{card.icon}</span>
                <span>{card.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
