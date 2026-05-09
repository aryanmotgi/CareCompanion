import React from "react";

interface Props {
  children: React.ReactNode;
  scale?: number;
}

export const IPhoneFrame: React.FC<Props> = ({ children, scale = 1 }) => {
  const W = 393 * scale;
  const H = 852 * scale;
  const bezel = 12 * scale;
  const radius = 50 * scale;
  const notchW = 120 * scale;
  const notchH = 34 * scale;

  return (
    <div
      style={{
        width: W + bezel * 2,
        height: H + bezel * 2,
        background: "#1a1a1a",
        borderRadius: radius,
        boxShadow: `0 0 0 ${bezel}px #2a2a2a, 0 40px 80px rgba(0,0,0,0.7)`,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Dynamic Island */}
      <div
        style={{
          position: "absolute",
          top: bezel + 8 * scale,
          left: "50%",
          transform: "translateX(-50%)",
          width: notchW,
          height: notchH,
          background: "#0a0a0a",
          borderRadius: notchH,
          zIndex: 10,
        }}
      />
      {/* Screen */}
      <div
        style={{
          position: "absolute",
          inset: bezel,
          borderRadius: radius - bezel,
          overflow: "hidden",
          background: "#0a0e1a",
        }}
      >
        {children}
      </div>
    </div>
  );
};
