import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { KenBurnsImage } from "../components/KenBurnsImage";
import { Particles } from "../components/Particles";
import { SceneTitle } from "../components/SceneTitle";

const Caption: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      textAlign: "center",
      marginTop: 18,
      color: "#64748b",
      fontSize: 16,
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
    }}
  >
    {text}
  </div>
);

export const ScanHealth: React.FC = () => {
  const frame = useCurrentFrame();

  const leftX = interpolate(frame, [0, 30], [-220, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightX = interpolate(frame, [0, 30], [220, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 80,
      }}
    >
      <Particles />
      <div style={{ transform: `translateX(${leftX}px)`, opacity, position: "relative", zIndex: 3 }}>
        <IPhoneFrame scale={0.72}>
          <KenBurnsImage src={staticFile("screenshots/scan.png")} />
        </IPhoneFrame>
        <Caption text="Scan Documents" />
      </div>

      <div style={{ transform: `translateX(${rightX}px)`, opacity, position: "relative", zIndex: 3 }}>
        <IPhoneFrame scale={0.72}>
          <KenBurnsImage src={staticFile("screenshots/health-summary.png")} />
        </IPhoneFrame>
        <Caption text="Health Summary" />
      </div>
      <SceneTitle subtitle="SCAN & ANALYZE" title="Documents Made Simple" showUntil={520} />
    </AbsoluteFill>
  );
};
