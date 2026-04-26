import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  value: string;
  label: string;
  delay: number;
  x: number;
  y: number;
  color?: string;
  slideFrom?: "left" | "right";
}

export const MetricCallout: React.FC<Props> = ({
  value,
  label,
  delay,
  x,
  y,
  color = "#6ee7b7",
  slideFrom = "right",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.8 },
  });

  const slideX = interpolate(progress, [0, 1], [slideFrom === "right" ? 32 : -32, 0]);
  const opacity = Math.min(1, progress * 1.2);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translateX(${slideX}px)`,
        opacity,
        background: "rgba(5,8,16,0.85)",
        border: `1px solid ${color}33`,
        borderLeft: slideFrom === "right" ? `3px solid ${color}` : `1px solid ${color}33`,
        borderRight: slideFrom === "left" ? `3px solid ${color}` : `1px solid ${color}33`,
        borderRadius: 12,
        padding: "14px 20px",
        minWidth: 150,
        zIndex: 10,
      }}
    >
      <div
        style={{
          color,
          fontSize: 28,
          fontWeight: 800,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          marginTop: 5,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </div>
    </div>
  );
};
