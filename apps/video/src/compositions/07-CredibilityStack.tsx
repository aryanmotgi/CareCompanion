import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BadgePill } from "../components/BadgePill";
import { AnimatedGradient } from "../components/AnimatedGradient";
import { Particles } from "../components/Particles";

const BADGES = [
  { label: "HIPAA Compliant",    color: "#6ee7b7", bg: "#0d2b22", delay: 20  },
  { label: "AWS Infrastructure", color: "#fb923c", bg: "#2c1400", delay: 80  },
  { label: "Apple HealthKit",    color: "#f1f5f9", bg: "#1e2230", delay: 140 },
  { label: "Powered by Claude",  color: "#a78bfa", bg: "#1e1b4b", delay: 200 },
];

export const CredibilityStack: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
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
        gap: 28,
      }}
    >
      <AnimatedGradient accentRgb="110,231,183" />
      <Particles />
      <div
        style={{
          opacity: titleOpacity,
          color: "#475569",
          fontSize: 14,
          fontFamily: "-apple-system, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginBottom: 8,
          position: "relative",
          zIndex: 3,
        }}
      >
        Built on
      </div>
      {BADGES.map((b) => (
        <BadgePill key={b.label} {...b} />
      ))}
    </AbsoluteFill>
  );
};
