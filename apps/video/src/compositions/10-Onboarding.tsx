import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AnimatedGradient } from "../components/AnimatedGradient";
import { Particles } from "../components/Particles";
import { TypewriterText } from "../components/TypewriterText";

interface BadgeProps {
  label: string;
  color: string;
  bg: string;
  delay: number;
}

const Badge: React.FC<BadgeProps> = ({ label, color, bg, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prog = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
  const y = interpolate(prog, [0, 1], [20, 0]);
  const opacity = Math.min(1, prog * 1.5);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        background: bg,
        border: `1px solid ${color}44`,
        borderRadius: 12,
        padding: "12px 24px",
        color,
        fontSize: 18,
        fontWeight: 700,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        position: "relative",
        zIndex: 3,
      }}
    >
      {label}
    </div>
  );
};

export const Onboarding: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [10, 35], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const metricOpacity = interpolate(frame, [55, 80], [0, 1], {
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
        gap: 32,
      }}
    >
      <AnimatedGradient accentRgb="241,245,249" />
      <Particles />

      {/* Apple icon + headline */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          position: "relative",
          zIndex: 3,
        }}
      >
        <div
          style={{
            fontSize: 72,
            lineHeight: 1,
            marginBottom: 12,
          }}
        >

        </div>
        <div
          style={{
            color: "#f1f5f9",
            fontSize: 52,
            fontWeight: 700,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
            letterSpacing: "0.01em",
          }}
        >
          Sign in with Apple
        </div>
        <div
          style={{
            color: "#475569",
            fontSize: 22,
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            marginTop: 10,
          }}
        >
          Healthcare-grade authentication
        </div>
      </div>

      {/* Metric */}
      <div
        style={{
          opacity: metricOpacity,
          display: "flex",
          gap: 20,
          alignItems: "center",
          position: "relative",
          zIndex: 3,
        }}
      >
        <div
          style={{
            background: "rgba(110,231,183,0.08)",
            border: "1px solid rgba(110,231,183,0.25)",
            borderLeft: "3px solid #6ee7b7",
            borderRadius: 12,
            padding: "16px 28px",
          }}
        >
          <div
            style={{
              color: "#6ee7b7",
              fontSize: 42,
              fontWeight: 800,
              fontFamily: "-apple-system, sans-serif",
              lineHeight: 1,
            }}
          >
            {"< 3 min"}
          </div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginTop: 6,
              fontFamily: "-apple-system, sans-serif",
            }}
          >
            Typical onboarding time
          </div>
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
        <Badge label="HIPAA Compliant" color="#6ee7b7" bg="rgba(110,231,183,0.07)" delay={100} />
        <Badge label="Face ID Secured" color="#f1f5f9" bg="rgba(241,245,249,0.06)" delay={125} />
        <Badge label="End-to-End Encrypted" color="#60a5fa" bg="rgba(96,165,250,0.07)" delay={150} />
      </div>

      {/* Typewriter quote from script */}
      <div style={{ position: "relative", zIndex: 3, textAlign: "center", maxWidth: 900 }}>
        <TypewriterText
          text={"Connecting caregivers to their health provider — securely, in minutes."}
          startFrame={190}
          speed={0.5}
          style={{
            color: "#475569",
            fontSize: 22,
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontStyle: "italic",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
