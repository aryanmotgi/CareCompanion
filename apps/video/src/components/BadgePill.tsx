import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  label: string;
  delay?: number;
  color?: string;
  bg?: string;
}

export const BadgePill: React.FC<Props> = ({
  label,
  delay = 0,
  color = "#6ee7b7",
  bg = "#0d2b22",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 200 },
    from: 0,
    to: 1,
  });

  const glow = interpolate(frame - delay, [0, 10, 25], [1, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        background: bg,
        border: `1px solid ${color}`,
        borderRadius: 100,
        padding: "10px 24px",
        color,
        fontSize: 18,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 700,
        boxShadow: `0 0 ${glow * 30}px ${color}`,
        letterSpacing: "0.05em",
        textTransform: "uppercase" as const,
      }}
    >
      {label}
    </div>
  );
};
