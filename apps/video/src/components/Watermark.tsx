import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";

export const Watermark: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [60, 90], [0, 0.65], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 32,
        left: 44,
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{ width: 28, height: 28, objectFit: "contain" }}
      />
      <span
        style={{
          color: "#f1f5f9",
          fontSize: 17,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        CareCompanion
      </span>
    </div>
  );
};
