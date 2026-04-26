import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, Video } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { AnimatedGradient } from "../components/AnimatedGradient";
import { Particles } from "../components/Particles";
import { SceneTitle } from "../components/SceneTitle";
import { MetricCallout } from "../components/MetricCallout";

export const HealthKit: React.FC = () => {
  const frame = useCurrentFrame();

  const phoneY = interpolate(frame, [0, 30], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glow = Math.sin(frame * 0.09) * 0.4 + 0.6;

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AnimatedGradient accentRgb="244,63,94" />
      <Particles />

      <div
        style={{
          transform: `translateY(${phoneY}px)`,
          opacity,
          position: "relative",
          zIndex: 3,
          filter: `drop-shadow(0 0 ${18 + glow * 14}px rgba(244,63,94,0.3))`,
        }}
      >
        <IPhoneFrame scale={0.65}>
          <Video
            src={staticFile("healthkit.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </IPhoneFrame>
      </div>

      <MetricCallout
        value="Medical records"
        label="Auto-synced from Apple Health"
        delay={55}
        x={1130}
        y={320}
        color="#f43f5e"
        slideFrom="right"
      />
      <MetricCallout
        value="AWS"
        label="HIPAA-compliant storage"
        delay={90}
        x={590}
        y={460}
        color="#fb923c"
        slideFrom="left"
      />
      <SceneTitle subtitle="HEALTH DATA" title="Apple HealthKit Integration" showUntil={370} />
    </AbsoluteFill>
  );
};
