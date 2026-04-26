import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, Video } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { AnimatedGradient } from "../components/AnimatedGradient";
import { Particles } from "../components/Particles";
import { SceneTitle } from "../components/SceneTitle";

const SWITCH_FRAME = 210; // switch from landing to demo at 7s

export const Website: React.FC = () => {
  const frame = useCurrentFrame();

  const frameIn = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scaleIn = interpolate(frameIn, [0, 1], [0.92, 1]);
  const translateY = interpolate(frameIn, [0, 1], [30, 0]);

  const switchOpacity = interpolate(
    frame,
    [SWITCH_FRAME - 15, SWITCH_FRAME, SWITCH_FRAME + 15],
    [1, 0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const showDemo = frame >= SWITCH_FRAME;

  return (
    <AbsoluteFill
      style={{
        background: "#050810",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AnimatedGradient accentRgb="96,165,250" />
      <Particles />

      <div
        style={{
          transform: `scale(${scaleIn}) translateY(${translateY}px)`,
          opacity: frameIn * switchOpacity,
          position: "relative",
          zIndex: 3,
        }}
      >
        <BrowserFrame width={1380} height={800} url="carecompanionai.org">
          <Video
            src={staticFile(showDemo ? "demo.mp4" : "landing.mp4")}
            startFrom={0}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </BrowserFrame>
      </div>

      <SceneTitle
        subtitle={showDemo ? "LIVE DEMO" : "LIVE PRODUCT"}
        title={showDemo ? "See It In Action" : "carecompanionai.org"}
        showUntil={370}
      />
    </AbsoluteFill>
  );
};
