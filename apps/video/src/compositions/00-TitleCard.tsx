import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { AnimatedGradient } from "../components/AnimatedGradient";
import { Particles } from "../components/Particles";

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoScale = interpolate(frame, [0, 35], [0.75, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textOpacity = interpolate(frame, [22, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagOpacity = interpolate(frame, [50, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glow = Math.sin(frame * 0.08) * 0.4 + 0.6;

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <AnimatedGradient accentRgb="110,231,183" />
      <Particles />
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          filter: `drop-shadow(0 0 ${18 + glow * 22}px rgba(110,231,183,0.55))`,
          position: "relative",
          zIndex: 3,
        }}
      >
        <Img src={staticFile("logo.png")} style={{ width: 110 }} />
      </div>
      <div
        style={{
          opacity: textOpacity,
          color: "#f1f5f9",
          fontSize: 60,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
          fontWeight: 700,
          letterSpacing: "0.01em",
          position: "relative",
          zIndex: 3,
        }}
      >
        CareCompanion
      </div>
      <div
        style={{
          opacity: tagOpacity,
          color: "#475569",
          fontSize: 19,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          position: "relative",
          zIndex: 3,
        }}
      >
        Care Intelligence · Powered by AI
      </div>
    </AbsoluteFill>
  );
};
