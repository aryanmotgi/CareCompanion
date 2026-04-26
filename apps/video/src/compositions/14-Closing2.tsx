import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { AnimatedGradient } from "../components/AnimatedGradient";
import { Particles } from "../components/Particles";
import { TypewriterText } from "../components/TypewriterText";

export const Closing2: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headlineOpacity = interpolate(frame, [25, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(frame, [25, 55], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlOpacity = interpolate(frame, [60, 80], [0, 1], {
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
        gap: 22,
      }}
    >
      <AnimatedGradient accentRgb="110,231,183" />
      <Particles />

      <div
        style={{
          opacity: logoOpacity,
          filter: `drop-shadow(0 0 ${16 + glow * 20}px rgba(110,231,183,0.5))`,
          position: "relative",
          zIndex: 3,
        }}
      >
        <Img src={staticFile("logo.png")} style={{ width: 100 }} />
      </div>

      <div
        style={{
          opacity: headlineOpacity,
          transform: `translateY(${headlineY}px)`,
          color: "#f1f5f9",
          fontSize: 44,
          fontWeight: 800,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
          letterSpacing: "0.01em",
          textAlign: "center",
          position: "relative",
          zIndex: 3,
        }}
      >
        Not a prototype.
        <span style={{ color: "#6ee7b7" }}> A live product.</span>
      </div>

      <div
        style={{
          opacity: urlOpacity,
          color: "#6ee7b7",
          fontSize: 26,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.04em",
          position: "relative",
          zIndex: 3,
        }}
      >
        carecompanionai.org
      </div>

      <div style={{ position: "relative", zIndex: 3, textAlign: "center", maxWidth: 900 }}>
        <TypewriterText
          text="Infrastructure designed for the 53 million caregivers quietly holding our healthcare system together."
          startFrame={95}
          speed={0.48}
          style={{
            color: "#475569",
            fontSize: 19,
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            lineHeight: 1.7,
            display: "block",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
