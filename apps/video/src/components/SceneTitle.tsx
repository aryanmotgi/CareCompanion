import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  title: string;
  subtitle?: string;
  showUntil?: number;
}

export const SceneTitle: React.FC<Props> = ({ title, subtitle, showUntil = 50 }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, 15, showUntil - 10, showUntil],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const y = interpolate(frame, [0, 15], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        opacity,
        transform: `translateY(${y}px)`,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          color: "#475569",
          fontSize: 12,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          color: "#f1f5f9",
          fontSize: 22,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {title}
      </div>
    </div>
  );
};
