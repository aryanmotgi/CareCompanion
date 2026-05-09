import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

// Global frame start for each scene (10 scenes, 30-frame crossfade overlaps)
// TitleCard:0, Hook:120, HomeScreen:750, CareTab:1320, TreatmentJourney:1950,
// AICompanion:2520, ScanHealth:3030, CredibilityStack:3540, EmergencyCard:3960, Closing:4290
const SCENE_STARTS = [0, 120, 750, 1320, 1950, 2520, 3030, 3540, 3960, 4290];

export const ProgressDots: React.FC = () => {
  const frame = useCurrentFrame();

  const currentScene = SCENE_STARTS.reduce(
    (acc, start, i) => (frame >= start ? i : acc),
    0
  );

  const opacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 22,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 7,
        zIndex: 50,
        opacity,
        pointerEvents: "none",
      }}
    >
      {SCENE_STARTS.map((_, i) => {
        const isActive = i === currentScene;
        const isPast = i < currentScene;
        return (
          <div
            key={i}
            style={{
              width: isActive ? 22 : 6,
              height: 6,
              borderRadius: 3,
              background: isActive
                ? "#6ee7b7"
                : isPast
                ? "rgba(110,231,183,0.35)"
                : "rgba(255,255,255,0.18)",
              boxShadow: isActive ? "0 0 8px rgba(110,231,183,0.7)" : "none",
            }}
          />
        );
      })}
    </div>
  );
};
