import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { KenBurnsImage } from "../components/KenBurnsImage";
import { BlurredBackground } from "../components/BlurredBackground";
import { Particles } from "../components/Particles";
import { SceneTitle } from "../components/SceneTitle";
import { MetricCallout } from "../components/MetricCallout";

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
      <BlurredBackground src={staticFile("screenshots/home.png")} glowColor="rgba(110,231,183,0.12)" />
      <Particles />
      <div
        style={{
          transform: `translateY(${phoneY}px)`,
          opacity,
          position: "relative",
          zIndex: 3,
        }}
      >
        <IPhoneFrame scale={0.65}>
          <KenBurnsImage src={staticFile("screenshots/home.png")} />
        </IPhoneFrame>
      </div>
      <MetricCallout value="23" label="Meds tracked" delay={60} x={1130} y={340} color="#6ee7b7" slideFrom="right" />
      <MetricCallout value="4" label="Appts this week" delay={90} x={590} y={460} color="#60a5fa" slideFrom="left" />
      <SceneTitle subtitle="INTRODUCING" title="Your Care Dashboard" showUntil={580} />
    </AbsoluteFill>
  );
};
