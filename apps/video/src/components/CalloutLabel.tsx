import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  text: string;
  x: number;
  y: number;
  delay?: number;
  color?: string;
}

export const CalloutLabel: React.FC<Props> = ({
  text,
  x,
  y,
  delay = 0,
  color = "#6ee7b7",
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame - delay, [0, 15], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        opacity,
        transform: `translateY(${translateY}px)`,
        background: "rgba(0,0,0,0.75)",
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: "4px 10px",
        color,
        fontSize: 14,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 600,
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
};
