import React from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  src: string;
  startScale?: number;
  endScale?: number;
}

export const KenBurnsImage: React.FC<Props> = ({
  src,
  startScale = 1,
  endScale = 1.08,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [startScale, endScale]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );
};
