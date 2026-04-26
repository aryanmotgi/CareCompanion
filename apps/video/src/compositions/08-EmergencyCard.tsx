import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { KenBurnsImage } from "../components/KenBurnsImage";
import { BlurredBackground } from "../components/BlurredBackground";
import { Particles } from "../components/Particles";
import { SceneTitle } from "../components/SceneTitle";
import { MetricCallout } from "../components/MetricCallout";

export const EmergencyCard: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
      <BlurredBackground
        src={staticFile("screenshots/emergency.png")}
        glowColor="rgba(220,38,38,0.12)"
      />
      <Particles />
      <div style={{ opacity, position: "relative", zIndex: 3 }}>
        {showPulse && (
          <div
            style={{
              position: "absolute",
              inset: -16,
              borderRadius: 64,
              border: `3px solid rgba(220,38,38,${pulse * 0.85})`,
              boxShadow: `0 0 ${pulse * 45}px rgba(220,38,38,${pulse * 0.35})`,
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        )}
        <IPhoneFrame scale={0.65}>
          <KenBurnsImage src={staticFile("screenshots/emergency.png")} />
        </IPhoneFrame>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 110,
          opacity: textOpacity,
          color: "#94a3b8",
          fontSize: 22,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400,
          fontStyle: "italic",
          zIndex: 10,
        }}
      >
        One tap. In any emergency.
      </div>
      <MetricCallout value="1 tap" label="Emergency SOS" delay={70} x={1130} y={380} color="#ef4444" slideFrom="right" />
      <SceneTitle subtitle="EMERGENCY" title="One Tap. Any Crisis." showUntil={340} />
    </AbsoluteFill>
  );
};
