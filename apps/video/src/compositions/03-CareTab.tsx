import React from "react";
import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { KenBurnsImage } from "../components/KenBurnsImage";
import { BlurredBackground } from "../components/BlurredBackground";
import { Particles } from "../components/Particles";
import { SceneTitle } from "../components/SceneTitle";

const TABS = [
  { src: staticFile("screenshots/care-meds.png"), label: "Medications" },
  { src: staticFile("screenshots/care-labs.png"), label: "Lab Results" },
  { src: staticFile("screenshots/care-appts.png"), label: "Appointments" },
];

const SWITCH_EVERY = 210; // 7 seconds at 30fps

export const CareTab: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const index = Math.min(Math.floor(frame / SWITCH_EVERY), TABS.length - 1);
  const localFrame = frame - index * SWITCH_EVERY;
  const current = TABS[index];

  const screenOpacity = interpolate(localFrame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const barOpacity = interpolate(frame, [20, 45], [0, 1], {
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
      <BlurredBackground src={current.src} glowColor="rgba(110,231,183,0.12)" />
      <Particles />

      <div style={{ opacity: screenOpacity, position: "relative", zIndex: 3 }}>
        <IPhoneFrame scale={0.65}>
          <KenBurnsImage src={current.src} />
        </IPhoneFrame>
      </div>

      {/* Animated tab selector */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          display: "flex",
          gap: 10,
          opacity: barOpacity,
          zIndex: 10,
        }}
      >
        {TABS.map((tab, i) => {
          const isActive = i === index;
          const tabActiveFr = isActive ? frame - index * SWITCH_EVERY : 0;
          const bounce = spring({
            frame: tabActiveFr,
            fps,
            config: { damping: 12, stiffness: 150, mass: 0.8 },
          });
          const scale = isActive ? interpolate(bounce, [0, 1], [0.85, 1.0]) : 1.0;
          const bgAlpha = isActive ? Math.min(1, bounce) : 0;

          return (
            <div
              key={i}
              style={{
                background: isActive
                  ? `rgba(110,231,183,${bgAlpha})`
                  : "rgba(255,255,255,0.08)",
                color: isActive ? "#050810" : "#64748b",
                padding: "8px 22px",
                borderRadius: 24,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                transform: `scale(${scale})`,
                border: isActive ? "none" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {tab.label}
            </div>
          );
        })}
      </div>

      <SceneTitle subtitle="MANAGING CARE" title="Medications, Labs & Appointments" showUntil={640} />
    </AbsoluteFill>
  );
};
