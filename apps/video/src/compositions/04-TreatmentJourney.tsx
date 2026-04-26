import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { IPhoneFrame } from "../components/IPhoneFrame";
import { BlurredBackground } from "../components/BlurredBackground";
import { Particles } from "../components/Particles";
import { SceneTitle } from "../components/SceneTitle";

const WORDS = [
  "Every", "medication.", "Every", "lab", "result.",
  "Every", "symptom.", "In", "sequence.",
];

export const TreatmentJourney: React.FC = () => {
  const frame = useCurrentFrame();

  const scrollY = interpolate(frame, [60, 500], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const phoneOpacity = interpolate(frame, [0, 20], [0, 1], {
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
      <BlurredBackground src={staticFile("screenshots/timeline.png")} glowColor="rgba(96,165,250,0.12)" />
      <Particles />
      <div style={{ opacity: phoneOpacity, position: "relative", zIndex: 3 }}>
        <IPhoneFrame scale={0.65}>
          <Img
            src={staticFile("screenshots/timeline.png")}
            style={{
              width: "100%",
              height: "120%",
              objectFit: "cover",
              objectPosition: `center ${scrollY}%`,
            }}
          />
        </IPhoneFrame>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 110,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "0 200px",
          zIndex: 10,
        }}
      >
        {WORDS.map((word, i) => {
          const delay = 120 + i * 18;
          const wordOpacity = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <span
              key={i}
              style={{
                opacity: wordOpacity,
                color: "#f1f5f9",
                fontSize: 30,
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      <SceneTitle subtitle="TIMELINE" title="The Complete Treatment Journey" showUntil={580} />
    </AbsoluteFill>
  );
};
