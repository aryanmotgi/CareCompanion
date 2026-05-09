import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { AnimatedGradient } from "../components/AnimatedGradient";
import { Particles } from "../components/Particles";
import { TypewriterText } from "../components/TypewriterText";

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlOpacity = interpolate(frame, [45, 65], [0, 1], {
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
        gap: 24,
      }}
    >
      <AnimatedGradient accentRgb="110,231,183" />
      <Particles />
      <Img
        src={staticFile("logo.png")}
        style={{ width: 220, opacity: logoOpacity, position: "relative", zIndex: 3 }}
      />
      <div
        style={{
          opacity: urlOpacity,
          color: "#6ee7b7",
          fontSize: 30,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.04em",
          position: "relative",
          zIndex: 3,
        }}
      >
        carecompanionai.org
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 3,
          marginTop: 6,
          minHeight: 36,
        }}
      >
        <TypewriterText
          text="Built for the 53 million quietly holding healthcare together."
          startFrame={80}
          speed={0.5}
          style={{
            color: "#475569",
            fontSize: 20,
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            maxWidth: 720,
            textAlign: "center",
            lineHeight: 1.6,
            display: "block",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
