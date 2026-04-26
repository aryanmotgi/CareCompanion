import React from "react";
import { Img } from "remotion";

interface Props {
  src: string;
  glowColor?: string;
  blur?: number;
  brightness?: number;
}

export const BlurredBackground: React.FC<Props> = ({
  src,
  glowColor = "rgba(110,231,183,0.15)",
  blur = 40,
  brightness = 0.3,
}) => {
  return (
    <>
      {/* Blurred screenshot full-width */}
      <div
        style={{
          position: "absolute",
          inset: -60,
          overflow: "hidden",
          zIndex: 0,
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: `blur(${blur}px) brightness(${brightness})`,
            transform: "scale(1.1)",
          }}
        />
      </div>
      {/* Radial glow centered */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${glowColor}, transparent 70%)`,
          zIndex: 1,
        }}
      />
    </>
  );
};
