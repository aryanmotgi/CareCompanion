import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AnimatedGradient } from "../components/AnimatedGradient";
import { Particles } from "../components/Particles";
import { TypewriterText } from "../components/TypewriterText";

const Counter: React.FC = () => {
  const frame = useCurrentFrame();
  const count = Math.round(
    interpolate(frame, [20, 90], [0, 53], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const opacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity,
        fontSize: 100,
        color: "#ffffff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        fontWeight: 800,
        lineHeight: 1,
        textAlign: "center",
        letterSpacing: "-0.02em",
        position: "relative",
        zIndex: 3,
      }}
    >
      {count}
      <span style={{ fontSize: 60, color: "#6ee7b7", marginLeft: 10 }}>million</span>
    </div>
  );
};

const Line: React.FC<{
  text: string;
  delay: number;
  size?: number;
  color?: string;
}> = ({ text, delay, size = 28, color = "#f1f5f9" }) => {
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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        fontWeight: size > 40 ? 800 : 400,
        lineHeight: 1.3,
        textAlign: "center",
        maxWidth: 1000,
        position: "relative",
        zIndex: 3,
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
        padding: 120,
      }}
    >
      <AnimatedGradient accentRgb="110,231,183" />
      <Particles />
      <Counter />
      <Line text="Americans are unpaid family caregivers." delay={95} size={44} color="#94a3b8" />
      <Line
        text="Every day, they manage medications, interpret lab results,"
        delay={130}
        size={26}
        color="#64748b"
      />
      <Line
        text="coordinate appointments, and respond to medical emergencies"
        delay={150}
        size={26}
        color="#64748b"
      />
      <Line
        text="— with no infrastructure to support them."
        delay={170}
        size={26}
        color="#64748b"
      />
      <div style={{ position: "relative", zIndex: 3, marginTop: 10 }}>
        <TypewriterText
          text="That's why we built CareCompanion."
          startFrame={280}
          speed={0.6}
          style={{
            fontSize: 38,
            color: "#6ee7b7",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
            fontWeight: 700,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
