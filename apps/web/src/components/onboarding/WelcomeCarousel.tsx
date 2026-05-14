'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DriftOrbs, FadeIn, GradientButton, NoiseVeil } from '@/components/motion';
import { MedsScene } from './scenes/MedsScene';
import { ChatScene } from './scenes/ChatScene';
import { TrialsScene } from './scenes/TrialsScene';
import { TimelineScene } from './scenes/TimelineScene';

const SCENES = [
  { Component: MedsScene,     title: 'Never miss a dose.',                subtitle: 'Smart reminders that adapt to your schedule — no more forgotten meds.' },
  { Component: ChatScene,     title: 'An AI that knows your case.',       subtitle: 'Trained on your records. Answers in seconds. No medical jargon.' },
  { Component: TrialsScene,   title: 'Trials, matched for you.',          subtitle: "We scan thousands of clinical trials so you don't have to." },
  { Component: TimelineScene, title: 'Every milestone, in one view.',     subtitle: 'From diagnosis to remission. Your whole journey, finally organized.' },
];

const AUTO_ADVANCE_MS = 4500;

interface WelcomeCarouselProps {
  onFinish: () => void;
  onSceneChange?: (idx: number) => void;
  startSceneIdx?: number;
}

export function WelcomeCarousel({ onFinish, onSceneChange, startSceneIdx = 0 }: WelcomeCarouselProps) {
  const [idx, setIdx] = useState(startSceneIdx);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    onSceneChange?.(idx);
  }, [idx, onSceneChange]);

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => {
      if (idx < SCENES.length - 1) setIdx(idx + 1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(t);
  }, [idx, paused]);

  const scene = SCENES[idx];
  const SceneComp = scene.Component;
  const isLast = idx === SCENES.length - 1;

  return (
    <div
      className="relative flex min-h-[100svh] w-full flex-col"
      style={{ background: 'var(--bg)' }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => window.setTimeout(() => setPaused(false), 1500)}
    >
      <DriftOrbs opacity={0.4} />
      <NoiseVeil opacity={0.02} />

      {/* Scene area */}
      <div className="relative z-10 flex-1 px-4 pt-12">
        <div className="relative mx-auto h-[55vh] max-w-md">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0"
            >
              <SceneComp />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Text + CTA footer */}
      <div className="relative z-10 px-6 pb-10 pt-4">
        <div className="mx-auto max-w-md">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`text-${idx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="mb-6 text-center"
            >
              <h1
                className="mb-3 text-2xl font-bold tracking-tight"
                style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}
              >
                {scene.title}
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {scene.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {SCENES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Go to scene ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === idx ? 24 : 6,
                  background: i === idx ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
          </div>

          {/* CTA row */}
          <FadeIn delayMs={300}>
            <div className="flex flex-col gap-2">
              <GradientButton
                onClick={() => {
                  if (isLast) onFinish();
                  else setIdx(idx + 1);
                }}
              >
                {isLast ? 'Get started' : 'Next'}
              </GradientButton>
              <GradientButton variant="ghost" onClick={onFinish}>
                Skip
              </GradientButton>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
