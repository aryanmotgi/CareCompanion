import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Onboarding } from "../compositions/10-Onboarding";
import { HealthKit } from "../compositions/11-HealthKit";
import { TechStack } from "../compositions/12-TechStack";
import { Website } from "../compositions/13-Website";
import { Closing2 } from "../compositions/14-Closing2";
import { Watermark } from "../components/Watermark";

const TOTAL_FRAMES = 1500;
const FADE = fade();
const TIMING = linearTiming({ durationInFrames: 30 });

// 🎵 Drop music.mp3 into public/ and uncomment to enable
// const MusicTrack: React.FC = () => {
//   const frame = useCurrentFrame();
//   const volume = interpolate(frame, [0, 60, TOTAL_FRAMES - 90, TOTAL_FRAMES], [0, 0.18, 0.18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
//   return <Audio src={staticFile("music.mp3")} volume={volume} />;
// };

export const FullVideo2: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* <MusicTrack /> */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={330}>
          <Onboarding />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={390}>
          <HealthKit />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={270}>
          <TechStack />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={390}>
          <Website />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={FADE} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={240}>
          <Closing2 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Watermark />
    </AbsoluteFill>
  );
};
