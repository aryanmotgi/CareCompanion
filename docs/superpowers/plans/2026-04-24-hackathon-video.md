# CareCompanion Hackathon Demo Video — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 2.5-minute Remotion video app in `apps/video/` that renders a cinematic hackathon demo of CareCompanion using real app screenshots, animated typography, and iPhone device frames.

**Architecture:** Each scene is an isolated Remotion composition component. A `FullVideo` sequence stitches all scenes together with `<Series>`. Shared components (IPhoneFrame, CalloutLabel, BadgePill) are reused across scenes. Screenshots are used now; screen recordings drop in later via a `videoSrc` fallback pattern.

**Tech Stack:** Remotion 4.x, React 18, TypeScript, Bun, existing monorepo workspace

---

## File Map

```
apps/video/
  package.json
  remotion.config.ts
  tsconfig.json
  src/
    index.ts                          # entry point, calls registerRoot
    Root.tsx                          # registers all compositions
    sequences/
      FullVideo.tsx                   # main <Series> of all scenes
    compositions/
      01-Hook.tsx                     # "53M Americans" animated stats
      02-HomeScreen.tsx               # iPhone + Home screenshot + callouts
      03-CareTab.tsx                  # iPhone + Care tab screenshots
      04-TreatmentJourney.tsx         # iPhone + Timeline screenshot, word reveal
      05-AICompanion.tsx              # iPhone + Chat screenshot + shimmer
      06-ScanHealth.tsx               # Split-screen iPhone frames
      07-CredibilityStack.tsx         # Animated badge pills
      08-EmergencyCard.tsx            # iPhone + Emergency + red pulse
      09-Closing.tsx                  # Logo + URL + tagline
    components/
      IPhoneFrame.tsx                 # iPhone 15 Pro bezel wrapper
      CalloutLabel.tsx                # Animated text annotation
      BadgePill.tsx                   # Credential badge with glow
      KenBurnsImage.tsx               # Slow zoom/pan on static image
  public/
    screenshots/                      # Drop PNG screenshots here
      home.png
      chat.png
      care-meds.png
      care-labs.png
      care-appts.png
      timeline.png
      scan.png
      health-summary.png
      emergency.png
    audio/                            # Drop MP3 voiceovers here (optional)
    logo.png
```

---

## Chunk 1: Project Scaffold

### Task 1: Create `apps/video` workspace

**Files:**
- Create: `apps/video/package.json`
- Create: `apps/video/remotion.config.ts`
- Create: `apps/video/tsconfig.json`
- Create: `apps/video/src/index.ts`

- [ ] **Step 1: Create `apps/video/package.json`**

```json
{
  "name": "@carecompanion/video",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "preview": "remotion studio",
    "render": "remotion render FullVideo out/carecompanion-demo.mp4",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@remotion/core": "^4.0.0",
    "@remotion/player": "^4.0.0",
    "@remotion/cli": "^4.0.0",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/react": "~18.3.12",
    "@types/react-dom": "~18.3.0",
    "typescript": "^5",
    "remotion": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/video/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/video/remotion.config.ts`**

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

- [ ] **Step 4: Create `apps/video/src/index.ts`**

```ts
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
```

- [ ] **Step 5: Install dependencies**

```bash
cd apps/video && bun install
```

Expected: `node_modules` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/video/package.json apps/video/remotion.config.ts apps/video/tsconfig.json apps/video/src/index.ts
git commit -m "feat(video): scaffold Remotion workspace"
```

---

## Chunk 2: Shared Components

### Task 2: IPhoneFrame component

**Files:**
- Create: `apps/video/src/components/IPhoneFrame.tsx`

- [ ] **Step 1: Create `IPhoneFrame.tsx`**

This renders a CSS-only iPhone 15 Pro bezel. The child goes inside the screen area.

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";

interface Props {
  children: React.ReactNode;
  scale?: number;
}

export const IPhoneFrame: React.FC<Props> = ({ children, scale = 1 }) => {
  const W = 393 * scale;
  const H = 852 * scale;
  const bezel = 12 * scale;
  const radius = 50 * scale;
  const notchW = 120 * scale;
  const notchH = 34 * scale;

  return (
    <div
      style={{
        width: W + bezel * 2,
        height: H + bezel * 2,
        background: "#1a1a1a",
        borderRadius: radius,
        boxShadow: `0 0 0 ${bezel}px #2a2a2a, 0 40px 80px rgba(0,0,0,0.7)`,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: "absolute",
          top: bezel,
          left: "50%",
          transform: "translateX(-50%)",
          width: notchW,
          height: notchH,
          background: "#1a1a1a",
          borderRadius: notchH,
          zIndex: 10,
        }}
      />
      {/* Screen */}
      <div
        style={{
          position: "absolute",
          inset: bezel,
          borderRadius: radius - bezel,
          overflow: "hidden",
          background: "#0a0e1a",
        }}
      >
        {children}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/video/src/components/IPhoneFrame.tsx
git commit -m "feat(video): add IPhoneFrame component"
```

---

### Task 3: KenBurnsImage component

**Files:**
- Create: `apps/video/src/components/KenBurnsImage.tsx`

- [ ] **Step 1: Create `KenBurnsImage.tsx`**

Slow zoom-in on a static image. Used as fallback when no screen recording exists.

```tsx
import React from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  src: string;
  startScale?: number;
  endScale?: number;
}

export const KenBurnsImage: React.FC<Props> = ({
  src,
  startScale = 1,
  endScale = 1.08,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [startScale, endScale]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/video/src/components/KenBurnsImage.tsx
git commit -m "feat(video): add KenBurnsImage component"
```

---

### Task 4: CalloutLabel component

**Files:**
- Create: `apps/video/src/components/CalloutLabel.tsx`

- [ ] **Step 1: Create `CalloutLabel.tsx`**

Fades in an annotation label at a given frame offset.

```tsx
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  text: string;
  x: number; // % from left
  y: number; // % from top
  delay?: number; // frame offset
  color?: string;
}

export const CalloutLabel: React.FC<Props> = ({
  text,
  x,
  y,
  delay = 0,
  color = "#6ee7b7",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame - delay, [0, 15], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        opacity,
        transform: `translateY(${translateY}px)`,
        background: "rgba(0,0,0,0.75)",
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: "4px 10px",
        color,
        fontSize: 14,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 600,
        whiteSpace: "nowrap",
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/video/src/components/CalloutLabel.tsx
git commit -m "feat(video): add CalloutLabel component"
```

---

### Task 5: BadgePill component

**Files:**
- Create: `apps/video/src/components/BadgePill.tsx`

- [ ] **Step 1: Create `BadgePill.tsx`**

Spring-animated badge with brief glow on entry.

```tsx
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  label: string;
  delay?: number;
  color?: string;
  bg?: string;
}

export const BadgePill: React.FC<Props> = ({
  label,
  delay = 0,
  color = "#6ee7b7",
  bg = "#0d2b22",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 200 },
    from: 0,
    to: 1,
  });

  const glow = interpolate(frame - delay, [0, 10, 25], [1, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        background: bg,
        border: `1px solid ${color}`,
        borderRadius: 100,
        padding: "10px 24px",
        color,
        fontSize: 18,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 700,
        boxShadow: `0 0 ${glow * 30}px ${color}`,
        letterSpacing: "0.05em",
        textTransform: "uppercase" as const,
      }}
    >
      {label}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/video/src/components/BadgePill.tsx
git commit -m "feat(video): add BadgePill component"
```

---

## Chunk 3: Scenes 1–3

### Task 6: Scene 1 — The Hook

**Files:**
- Create: `apps/video/src/compositions/01-Hook.tsx`

Duration: 660 frames (22s @ 30fps)

- [ ] **Step 1: Create `01-Hook.tsx`**

```tsx
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const Line: React.FC<{ text: string; delay: number; size?: number; color?: string }> = ({
  text,
  delay,
  size = 28,
  color = "#f1f5f9",
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [delay, delay + 20], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        fontSize: size,
        color,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: size > 40 ? 800 : 400,
        lineHeight: 1.3,
        textAlign: "center",
        maxWidth: 900,
      }}
    >
      {text}
    </div>
  );
};

export const Hook: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 20,
        padding: 80,
      }}
    >
      <Line text="53 million Americans" delay={20} size={72} color="#ffffff" />
      <Line text="are unpaid family caregivers." delay={40} size={40} color="#94a3b8" />
      <Line text="Every day, they manage medications, interpret lab results," delay={100} size={24} color="#64748b" />
      <Line text="coordinate appointments, and respond to medical emergencies" delay={120} size={24} color="#64748b" />
      <Line text="— with no infrastructure to support them." delay={140} size={24} color="#64748b" />
      <Line text="That's why we built CareCompanion." delay={240} size={36} color="#6ee7b7" />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Preview in Remotion Studio**

```bash
cd apps/video && bun run preview
```

Open `http://localhost:3000`, select Hook composition, scrub through to verify text animates correctly.

- [ ] **Step 3: Commit**

```bash
git add apps/video/src/compositions/01-Hook.tsx
git commit -m "feat(video): add Hook scene"
```

---

### Task 7: Scene 2 — Home Screen

**Files:**
- Create: `apps/video/src/compositions/02-HomeScreen.tsx`

Duration: 600 frames (20s @ 30fps)

- [ ] **Step 1: Copy Home screenshot into public folder**

```bash
# Copy the home screenshot — rename it home.png
cp <path-to-screenshot> apps/video/public/screenshots/home.png
```

- [ ] **Step 2: Create `02-HomeScreen.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { KenBurnsImage } from "../components/KenBurnsImage";
import { CalloutLabel } from "../components/CalloutLabel";

export const HomeScreen: React.FC = () => {
  const frame = useCurrentFrame();

  const phoneY = interpolate(frame, [0, 30], [120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `translateY(${phoneY}px)`,
          opacity,
          position: "relative",
        }}
      >
        <IPhoneFrame scale={0.85}>
          <KenBurnsImage src={require("../../public/screenshots/home.png")} />
        </IPhoneFrame>
        <CalloutLabel text="Today's priorities" x={55} y={18} delay={60} />
        <CalloutLabel text="Upcoming care" x={55} y={50} delay={100} />
        <CalloutLabel text="Ask your AI companion" x={55} y={75} delay={140} />
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Add to Root.tsx and preview**

Verify phone slides in and callouts appear at correct positions.

- [ ] **Step 4: Commit**

```bash
git add apps/video/src/compositions/02-HomeScreen.tsx apps/video/public/screenshots/home.png
git commit -m "feat(video): add HomeScreen scene"
```

---

### Task 8: Scene 3 — Care Tab

**Files:**
- Create: `apps/video/src/compositions/03-CareTab.tsx`

Duration: 660 frames (22s @ 30fps)

- [ ] **Step 1: Copy Care screenshots**

```bash
cp <meds-screenshot> apps/video/public/screenshots/care-meds.png
cp <labs-screenshot> apps/video/public/screenshots/care-labs.png
cp <appts-screenshot> apps/video/public/screenshots/care-appts.png
```

- [ ] **Step 2: Create `03-CareTab.tsx`**

Cycles through 3 screenshots (Meds → Labs → Appts), crossfading every 7 seconds.

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { KenBurnsImage } from "../components/KenBurnsImage";

const screenshots = [
  { src: require("../../public/screenshots/care-meds.png"), label: "Medications" },
  { src: require("../../public/screenshots/care-labs.png"), label: "Lab Results" },
  { src: require("../../public/screenshots/care-appts.png"), label: "Appointments" },
];

const SWITCH_EVERY = 210; // 7 seconds

export const CareTab: React.FC = () => {
  const frame = useCurrentFrame();
  const index = Math.min(Math.floor(frame / SWITCH_EVERY), screenshots.length - 1);
  const localFrame = frame - index * SWITCH_EVERY;

  const opacity = interpolate(localFrame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const current = screenshots[index];

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ opacity, position: "relative" }}>
        <IPhoneFrame scale={0.85}>
          <KenBurnsImage src={current.src} />
        </IPhoneFrame>
      </div>
      {/* Section label bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 80,
          opacity: labelOpacity,
          color: "#6ee7b7",
          fontSize: 20,
          fontFamily: "-apple-system, sans-serif",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {current.label}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Preview and verify crossfade**

- [ ] **Step 4: Commit**

```bash
git add apps/video/src/compositions/03-CareTab.tsx apps/video/public/screenshots/care-*.png
git commit -m "feat(video): add CareTab scene"
```

---

## Chunk 4: Scenes 4–6

### Task 9: Scene 4 — Treatment Journey

**Files:**
- Create: `apps/video/src/compositions/04-TreatmentJourney.tsx`

Duration: 600 frames (20s @ 30fps)

- [ ] **Step 1: Copy screenshot**

```bash
cp <timeline-screenshot> apps/video/public/screenshots/timeline.png
```

- [ ] **Step 2: Create `04-TreatmentJourney.tsx`**

Shows timeline screenshot with a slow scroll simulation (via objectPosition) and word-by-word text reveal.

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { Img } from "remotion";

const WORDS = ["Every", "medication.", "Every", "lab", "result.", "Every", "symptom.", "In", "sequence."];

export const TreatmentJourney: React.FC = () => {
  const frame = useCurrentFrame();

  // Simulate scroll by shifting objectPosition
  const scrollY = interpolate(frame, [60, 500], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <IPhoneFrame scale={0.85}>
        <Img
          src={require("../../public/screenshots/timeline.png")}
          style={{
            width: "100%",
            height: "120%",
            objectFit: "cover",
            objectPosition: `center ${scrollY}%`,
          }}
        />
      </IPhoneFrame>

      {/* Word-by-word reveal */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "0 80px",
        }}
      >
        {WORDS.map((word, i) => {
          const delay = 120 + i * 18;
          const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <span
              key={i}
              style={{
                opacity,
                color: "#f1f5f9",
                fontSize: 28,
                fontFamily: "-apple-system, sans-serif",
                fontWeight: 600,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Preview**

- [ ] **Step 4: Commit**

```bash
git add apps/video/src/compositions/04-TreatmentJourney.tsx apps/video/public/screenshots/timeline.png
git commit -m "feat(video): add TreatmentJourney scene"
```

---

### Task 10: Scene 5 — AI Companion

**Files:**
- Create: `apps/video/src/compositions/05-AICompanion.tsx`

Duration: 540 frames (18s @ 30fps)

- [ ] **Step 1: Copy screenshot**

```bash
cp <chat-screenshot> apps/video/public/screenshots/chat.png
```

- [ ] **Step 2: Create `05-AICompanion.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { KenBurnsImage } from "../components/KenBurnsImage";

export const AICompanion: React.FC = () => {
  const frame = useCurrentFrame();

  const badgeOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Shimmer pulse around phone
  const glow = Math.sin(frame * 0.1) * 0.5 + 0.5;

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          filter: `drop-shadow(0 0 ${20 + glow * 15}px rgba(167,139,250,0.4))`,
        }}
      >
        <IPhoneFrame scale={0.85}>
          <KenBurnsImage src={require("../../public/screenshots/chat.png")} />
        </IPhoneFrame>

        {/* Claude badge top-right */}
        <div
          style={{
            position: "absolute",
            top: -16,
            right: -80,
            opacity: badgeOpacity,
            background: "rgba(88,28,135,0.9)",
            border: "1px solid #a78bfa",
            borderRadius: 8,
            padding: "6px 14px",
            color: "#a78bfa",
            fontSize: 13,
            fontFamily: "-apple-system, sans-serif",
            fontWeight: 700,
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
          }}
        >
          ✦ Powered by Claude
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Preview and verify glow pulse**

- [ ] **Step 4: Commit**

```bash
git add apps/video/src/compositions/05-AICompanion.tsx apps/video/public/screenshots/chat.png
git commit -m "feat(video): add AICompanion scene"
```

---

### Task 11: Scene 6 — Scan + Health Summary

**Files:**
- Create: `apps/video/src/compositions/06-ScanHealth.tsx`

Duration: 540 frames (18s @ 30fps)

- [ ] **Step 1: Copy screenshots**

```bash
cp <scan-screenshot> apps/video/public/screenshots/scan.png
cp <health-summary-screenshot> apps/video/public/screenshots/health-summary.png
```

- [ ] **Step 2: Create `06-ScanHealth.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { KenBurnsImage } from "../components/KenBurnsImage";

export const ScanHealth: React.FC = () => {
  const frame = useCurrentFrame();

  const leftX = interpolate(frame, [0, 30], [-200, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightX = interpolate(frame, [0, 30], [200, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 60,
      }}
    >
      <div style={{ transform: `translateX(${leftX}px)`, opacity }}>
        <IPhoneFrame scale={0.72}>
          <KenBurnsImage src={require("../../public/screenshots/scan.png")} />
        </IPhoneFrame>
        <div style={{
          textAlign: "center",
          marginTop: 16,
          color: "#64748b",
          fontSize: 16,
          fontFamily: "-apple-system, sans-serif",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>
          Scan Documents
        </div>
      </div>

      <div style={{ transform: `translateX(${rightX}px)`, opacity }}>
        <IPhoneFrame scale={0.72}>
          <KenBurnsImage src={require("../../public/screenshots/health-summary.png")} />
        </IPhoneFrame>
        <div style={{
          textAlign: "center",
          marginTop: 16,
          color: "#64748b",
          fontSize: 16,
          fontFamily: "-apple-system, sans-serif",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>
          Health Summary
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Preview split-screen**

- [ ] **Step 4: Commit**

```bash
git add apps/video/src/compositions/06-ScanHealth.tsx apps/video/public/screenshots/scan.png apps/video/public/screenshots/health-summary.png
git commit -m "feat(video): add ScanHealth scene"
```

---

## Chunk 5: Scenes 7–9

### Task 12: Scene 7 — Credibility Stack

**Files:**
- Create: `apps/video/src/compositions/07-CredibilityStack.tsx`

Duration: 450 frames (15s @ 30fps)

- [ ] **Step 1: Create `07-CredibilityStack.tsx`**

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { BadgePill } from "../components/BadgePill";

const BADGES = [
  { label: "HIPAA Compliant", color: "#6ee7b7", bg: "#0d2b22", delay: 20 },
  { label: "AWS Infrastructure", color: "#fb923c", bg: "#2c1400", delay: 80 },
  { label: "Apple HealthKit", color: "#f1f5f9", bg: "#1e2230", delay: 140 },
  { label: "Powered by Claude", color: "#a78bfa", bg: "#1e1b4b", delay: 200 },
];

export const CredibilityStack: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {BADGES.map((b) => (
        <BadgePill key={b.label} {...b} />
      ))}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Preview badge spring animations**

- [ ] **Step 3: Commit**

```bash
git add apps/video/src/compositions/07-CredibilityStack.tsx
git commit -m "feat(video): add CredibilityStack scene"
```

---

### Task 13: Scene 8 — Emergency Card

**Files:**
- Create: `apps/video/src/compositions/08-EmergencyCard.tsx`

Duration: 360 frames (12s @ 30fps)

- [ ] **Step 1: Copy screenshot**

```bash
cp <emergency-screenshot> apps/video/public/screenshots/emergency.png
```

- [ ] **Step 2: Create `08-EmergencyCard.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { KenBurnsImage } from "../components/KenBurnsImage";

export const EmergencyCard: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Red pulse border — 3 quick pulses
  const pulse = Math.max(0, Math.sin(frame * 0.25) * 0.5 + 0.5);
  const showPulse = frame < 90;

  const textOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ opacity, position: "relative" }}>
        {/* Red pulse ring */}
        {showPulse && (
          <div
            style={{
              position: "absolute",
              inset: -12,
              borderRadius: 60,
              border: `3px solid rgba(220,38,38,${pulse * 0.8})`,
              boxShadow: `0 0 ${pulse * 40}px rgba(220,38,38,${pulse * 0.4})`,
              pointerEvents: "none",
            }}
          />
        )}
        <IPhoneFrame scale={0.85}>
          <KenBurnsImage src={require("../../public/screenshots/emergency.png")} />
        </IPhoneFrame>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 60,
          opacity: textOpacity,
          color: "#94a3b8",
          fontSize: 20,
          fontFamily: "-apple-system, sans-serif",
          fontWeight: 500,
          fontStyle: "italic",
        }}
      >
        One tap. In any emergency.
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Preview red pulse**

- [ ] **Step 4: Commit**

```bash
git add apps/video/src/compositions/08-EmergencyCard.tsx apps/video/public/screenshots/emergency.png
git commit -m "feat(video): add EmergencyCard scene"
```

---

### Task 14: Scene 9 — Closing

**Files:**
- Create: `apps/video/src/compositions/09-Closing.tsx`

Duration: 360 frames (12s @ 30fps)

- [ ] **Step 1: Add logo**

```bash
cp <logo-file> apps/video/public/logo.png
```

- [ ] **Step 2: Create `09-Closing.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineOpacity = interpolate(frame, [80, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <Img
        src={require("../../public/logo.png")}
        style={{ width: 200, opacity: logoOpacity }}
      />
      <div
        style={{
          opacity: urlOpacity,
          color: "#6ee7b7",
          fontSize: 28,
          fontFamily: "-apple-system, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.05em",
        }}
      >
        carecompanionai.org
      </div>
      <div
        style={{
          opacity: taglineOpacity,
          color: "#475569",
          fontSize: 18,
          fontFamily: "-apple-system, sans-serif",
          fontWeight: 400,
          maxWidth: 700,
          textAlign: "center",
          lineHeight: 1.5,
          marginTop: 8,
        }}
      >
        Built for the 53 million quietly holding healthcare together.
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Preview**

- [ ] **Step 4: Commit**

```bash
git add apps/video/src/compositions/09-Closing.tsx apps/video/public/logo.png
git commit -m "feat(video): add Closing scene"
```

---

## Chunk 6: Root + Full Composition + Render

### Task 15: Wire everything into Root.tsx

**Files:**
- Create: `apps/video/src/Root.tsx`
- Create: `apps/video/src/sequences/FullVideo.tsx`

- [ ] **Step 1: Create `FullVideo.tsx`**

```tsx
import React from "react";
import { Series } from "@remotion/core";
import { Hook } from "../compositions/01-Hook";
import { HomeScreen } from "../compositions/02-HomeScreen";
import { CareTab } from "../compositions/03-CareTab";
import { TreatmentJourney } from "../compositions/04-TreatmentJourney";
import { AICompanion } from "../compositions/05-AICompanion";
import { ScanHealth } from "../compositions/06-ScanHealth";
import { CredibilityStack } from "../compositions/07-CredibilityStack";
import { EmergencyCard } from "../compositions/08-EmergencyCard";
import { Closing } from "../compositions/09-Closing";

export const FullVideo: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={660}><Hook /></Series.Sequence>
      <Series.Sequence durationInFrames={600}><HomeScreen /></Series.Sequence>
      <Series.Sequence durationInFrames={660}><CareTab /></Series.Sequence>
      <Series.Sequence durationInFrames={600}><TreatmentJourney /></Series.Sequence>
      <Series.Sequence durationInFrames={540}><AICompanion /></Series.Sequence>
      <Series.Sequence durationInFrames={540}><ScanHealth /></Series.Sequence>
      <Series.Sequence durationInFrames={450}><CredibilityStack /></Series.Sequence>
      <Series.Sequence durationInFrames={360}><EmergencyCard /></Series.Sequence>
      <Series.Sequence durationInFrames={360}><Closing /></Series.Sequence>
    </Series>
  );
};
```

- [ ] **Step 2: Create `Root.tsx`**

```tsx
import React from "react";
import { Composition } from "remotion";
import { FullVideo } from "./sequences/FullVideo";
import { Hook } from "./compositions/01-Hook";
// ... import all scenes for individual previewing

export const Root: React.FC = () => {
  return (
    <>
      {/* Full video */}
      <Composition
        id="FullVideo"
        component={FullVideo}
        durationInFrames={4770}
        fps={30}
        width={1920}
        height={1080}
      />
      {/* Individual scenes for easy preview */}
      <Composition id="Hook" component={Hook} durationInFrames={660} fps={30} width={1920} height={1080} />
    </>
  );
};
```

- [ ] **Step 3: Preview full video end-to-end**

```bash
cd apps/video && bun run preview
```

Select `FullVideo`, play through all 9 scenes.

- [ ] **Step 4: Commit**

```bash
git add apps/video/src/Root.tsx apps/video/src/sequences/FullVideo.tsx
git commit -m "feat(video): wire all scenes into FullVideo composition"
```

---

### Task 16: Render final video

- [ ] **Step 1: Copy all app screenshots into public/screenshots/**

Use the screenshots shared in this session. Filenames must match exactly what's in each composition.

- [ ] **Step 2: Run render**

```bash
cd apps/video && bun run render
```

Output: `apps/video/out/carecompanion-demo.mp4`

- [ ] **Step 3: Check output**

Open `out/carecompanion-demo.mp4`, watch full 2:39 playback.

- [ ] **Step 4: Final commit**

```bash
git add apps/video/public/screenshots/
git commit -m "feat(video): add app screenshots and render final demo video"
```

---

## Adding Voiceover (Optional — when audio is recorded)

- [ ] Drop MP3 files into `apps/video/public/audio/` named `01-hook.mp3`, `02-home.mp3`, etc.
- [ ] In each scene component, add:
  ```tsx
  import { Audio } from "remotion";
  // Inside the component:
  <Audio src={require("../../public/audio/01-hook.mp3")} />
  ```
- [ ] Re-render: `bun run render`
