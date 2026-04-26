import React from "react";
import { useCurrentFrame } from "remotion";

interface Props {
  accentRgb?: string; // "r,g,b" e.g. "110,231,183"
}

export const AnimatedGradient: React.FC<Props> = ({ accentRgb = "110,231,183" }) => {
  const frame = useCurrentFrame();

  const x1 = Math.sin(frame * 0.013) * 25 + 50;
  const y1 = Math.cos(frame * 0.009) * 18 + 48;
  const x2 = Math.cos(frame * 0.007) * 20 + 52;
  const y2 = Math.sin(frame * 0.011) * 18 + 54;

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background: `radial-gradient(ellipse 75% 55% at ${x1}% ${y1}%, rgba(${accentRgb},0.07), transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background: `radial-gradient(ellipse 50% 65% at ${x2}% ${y2}%, rgba(96,165,250,0.04), transparent 55%)`,
        }}
      />
    </>
  );
};
