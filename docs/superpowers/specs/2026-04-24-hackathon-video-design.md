# CareCompanion Hackathon Demo Video — Design Spec

## Overview

A 2.5-minute cinematic demo video built with Remotion (React-based video framework). Hybrid format: Remotion handles all titles, transitions, typography, and overlays; actual app screenshots and screen recordings are embedded as assets. Voiceover-only delivery (no face cam). Dark mode, premium Apple-product pacing.

## Tech Stack

- **Remotion** (`@remotion/core`, `@remotion/player`) — video composition
- **Location:** `apps/video/` (new workspace package)
- **Aspect ratio:** 1920×1080 (16:9), 30fps
- **Total runtime:** ~2 min 39 sec (~4740 frames)
- **Assets:** `apps/video/public/recordings/` — screenshots + screen recordings

## Scene Structure

| # | Speaker | Title | Treatment | Duration |
|---|---------|-------|-----------|----------|
| 1 | Aryan | The Hook | Pure Remotion — animated stat typography, black bg | ~22s |
| 2 | Shrey | Home Screen | iPhone frame + Home recording + callout overlays | ~20s |
| 3 | Kaushik | Care Tab | iPhone frame + Care tab recording + tab highlight | ~22s |
| 4 | Aryan | Treatment Journey | iPhone frame + scrolling timeline + word-reveal text | ~20s |
| 5 | Shreymoney | AI Companion | iPhone frame + Chat recording + Claude badge + shimmer | ~18s |
| 6 | Kaushik | Scan + Health Summary | Split-screen iPhone frames (2x recordings) | ~18s |
| 7 | Aryan | Credibility Stack | Pure Remotion — HIPAA / AWS / HealthKit / Claude badges | ~15s |
| 8 | Aryan | Emergency Card | iPhone frame + recording + red pulse border | ~12s |
| 9 | Aryan | Close | Pure Remotion — logo reveal + URL + tagline fade | ~12s |

## Remotion Project Structure

```
apps/video/
  src/
    Root.tsx                 # registerRoot, all compositions
    compositions/
      Hook.tsx               # Scene 1 — animated stats
      HomeScreen.tsx         # Scene 2 — iPhone + recording
      CareTab.tsx            # Scene 3 — iPhone + tab highlight
      TreatmentJourney.tsx   # Scene 4 — iPhone + scroll
      AICompanion.tsx        # Scene 5 — iPhone + shimmer
      ScanHealth.tsx         # Scene 6 — split screen
      CredibilityStack.tsx   # Scene 7 — badge animations
      EmergencyCard.tsx      # Scene 8 — iPhone + red pulse
      Closing.tsx            # Scene 9 — logo reveal
    components/
      IPhoneFrame.tsx        # Reusable iPhone 15 Pro frame wrapper
      CalloutLabel.tsx       # Animated text callout overlay
      BadgePill.tsx          # Animated credential badge
    sequences/
      FullVideo.tsx          # Main composition — all scenes in sequence
  public/
    recordings/              # .mp4 screen recordings (drop in when ready)
    screenshots/             # .png app screenshots (used as fallback/Ken Burns)
    logo.png
  package.json
  remotion.config.ts
```

## Shared Components

**IPhoneFrame** — renders a CSS iPhone 15 Pro bezel with a `<Video>` or `<Img>` slot inside. Accepts `src`, `type: 'video' | 'image'`, and optional `kenBurns` prop for slow zoom on static screenshots.

**CalloutLabel** — animated text label that fades in at a given frame offset. Used for scene annotations.

**BadgePill** — pill-shaped badge that scales in with a spring animation + brief glow. Used in Scene 7.

## Asset Strategy

- Screenshots from this session are used immediately with Ken Burns zoom animation
- Screen recordings dropped into `public/recordings/` auto-replace screenshot fallbacks
- Each scene component accepts both `videoSrc` and `imgSrc` — renders video if present, image otherwise

## Voiceover Integration

Voiceover audio files go in `public/audio/` named by scene (`01-hook.mp3`, `02-home.mp3`, etc.). Each scene composition has a matching `<Audio>` track. Record audio separately; sync by matching scene duration to audio length.

## Build & Export

```bash
cd apps/video
bun install
bun run preview          # Remotion Studio at localhost:3000
bun run render           # exports full video to out/carecompanion-demo.mp4
```
