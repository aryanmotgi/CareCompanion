import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { AnimatedChat } from "../components/AnimatedChat";
import { BlurredBackground } from "../components/BlurredBackground";
import { Particles } from "../components/Particles";
import { SceneTitle } from "../components/SceneTitle";
import { MetricCallout } from "../components/MetricCallout";

export const AICompanion: React.FC = () => {
  const frame = useCurrentFrame();

  const phoneOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glow = Math.sin(frame * 0.1) * 0.5 + 0.5;

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BlurredBackground src={staticFile("screenshots/chat.png")} glowColor="rgba(167,139,250,0.15)" />
      <Particles />
      <div
        style={{
          position: "relative",
          opacity: phoneOpacity,
          filter: `drop-shadow(0 0 ${20 + glow * 15}px rgba(167,139,250,0.35))`,
          zIndex: 3,
        }}
      >
        <IPhoneFrame scale={0.65}>
          <AnimatedChat />
        </IPhoneFrame>

        <div
          style={{
            position: "absolute",
            top: 20,
            right: -170,
            opacity: badgeOpacity,
            background: "rgba(88,28,135,0.92)",
            border: "1px solid #a78bfa",
            borderRadius: 10,
            padding: "8px 16px",
            color: "#a78bfa",
            fontSize: 15,
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          ✦ Powered by Claude
        </div>
      </div>
      <MetricCallout value="< 3s" label="AI response time" delay={60} x={1130} y={320} color="#a78bfa" slideFrom="right" />
      <MetricCallout value="100%" label="Private & secure" delay={95} x={580} y={460} color="#a78bfa" slideFrom="left" />
      <SceneTitle subtitle="AI-POWERED" title="Your Medical Companion" showUntil={520} />
    </AbsoluteFill>
  );
};
